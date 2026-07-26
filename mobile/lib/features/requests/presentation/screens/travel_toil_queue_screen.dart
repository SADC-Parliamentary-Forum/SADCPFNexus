import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/router/safe_back.dart';
import '../../../../core/theme/app_theme.dart';

/// Mobile TOIL candidates — confirm/reject paths only. Never auto-creates leave.
class TravelToilQueueScreen extends ConsumerStatefulWidget {
  const TravelToilQueueScreen({super.key});

  @override
  ConsumerState<TravelToilQueueScreen> createState() =>
      _TravelToilQueueScreenState();
}

class _TravelToilQueueScreenState extends ConsumerState<TravelToilQueueScreen> {
  bool _loading = true;
  String? _error;
  String? _toast;
  List<Map<String, dynamic>> _rows = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ref.read(apiClientProvider).dio.get<Map<String, dynamic>>(
        '/travel/toil',
        queryParameters: {'per_page': 50},
      );
      final data = res.data?['data'];
      final list = data is List
          ? data.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
          : <Map<String, dynamic>>[];
      if (!mounted) return;
      setState(() {
        _rows = list;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load TOIL candidates.';
        _loading = false;
      });
    }
  }

  Future<void> _action(int id, String path, {Map<String, dynamic>? body}) async {
    try {
      await ref.read(apiClientProvider).dio.post(
            '/travel/toil/$id/$path',
            data: body,
          );
      if (!mounted) return;
      setState(() => _toast = 'Updated candidate #$id ($path). No leave was auto-created.');
      await _load();
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Action failed for candidate #$id.');
    }
  }

  Future<void> _reject(int id) async {
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reject TOIL candidate'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(labelText: 'Reason'),
          maxLines: 2,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
    if (reason == null || reason.isEmpty) return;
    await _action(id, 'reject', body: {'reason': reason});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Travel TOIL Candidates'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.safePopOrGoHome(),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text(
                    'Candidates only — OT authorise → duty confirm → HR validate. Never auto-creates leave.',
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                  if (_toast != null) ...[
                    const SizedBox(height: 8),
                    Text(_toast!, style: const TextStyle(color: Colors.green, fontSize: 12)),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 8),
                    Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12)),
                  ],
                  const SizedBox(height: 12),
                  if (_rows.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 48),
                      child: Center(child: Text('No TOIL candidates.')),
                    )
                  else
                    ..._rows.map((row) {
                      final id = row['id'] is int ? row['id'] as int : int.tryParse('${row['id']}') ?? 0;
                      final status = row['status']?.toString() ?? 'candidate';
                      final travel = row['travel_request'];
                      final refNo = travel is Map ? travel['reference_number'] : null;
                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${row['candidate_date'] ?? '—'} · ${row['hours'] ?? 8}h · $status',
                                style: const TextStyle(fontWeight: FontWeight.w600),
                              ),
                              Text(
                                'Travel: ${refNo ?? row['travel_request_id'] ?? '—'} · ${row['reason'] ?? ''}',
                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                              ),
                              const SizedBox(height: 8),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: [
                                  if (status == 'candidate')
                                    OutlinedButton(
                                      onPressed: id == 0 ? null : () => _action(id, 'authorise-ot'),
                                      child: const Text('Authorise OT'),
                                    ),
                                  if (status == 'ot_authorised')
                                    OutlinedButton(
                                      onPressed: id == 0 ? null : () => _action(id, 'confirm-duty'),
                                      child: const Text('Confirm duty'),
                                    ),
                                  if (status == 'duty_confirmed')
                                    FilledButton(
                                      onPressed: id == 0 ? null : () => _action(id, 'hr-validate'),
                                      child: const Text('HR validate'),
                                    ),
                                  if (status != 'credited' && status != 'rejected')
                                    TextButton(
                                      onPressed: id == 0 ? null : () => _reject(id),
                                      child: const Text('Reject'),
                                    ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                ],
              ),
      ),
    );
  }
}
