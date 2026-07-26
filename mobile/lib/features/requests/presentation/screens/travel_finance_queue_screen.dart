import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/router/safe_back.dart';
import '../../../../core/theme/app_theme.dart';

/// Mobile Finance DSA queue — read list; DSA calc remains on web detail / API.
class TravelFinanceQueueScreen extends ConsumerStatefulWidget {
  const TravelFinanceQueueScreen({super.key});

  @override
  ConsumerState<TravelFinanceQueueScreen> createState() =>
      _TravelFinanceQueueScreenState();
}

class _TravelFinanceQueueScreenState
    extends ConsumerState<TravelFinanceQueueScreen> {
  bool _loading = true;
  String? _error;
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
        '/travel/requests',
        queryParameters: {'queue': 'finance', 'per_page': 50},
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
        _error = 'Failed to load finance queue.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Travel Finance Queue'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.safePopOrGoHome(),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? ListView(
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(_error!, style: const TextStyle(color: Colors.red)),
                      ),
                    ],
                  )
                : _rows.isEmpty
                    ? ListView(
                        children: const [
                          SizedBox(height: 80),
                          Center(child: Text('No pending finance DSA items.')),
                        ],
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _rows.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final row = _rows[index];
                          final id = row['id']?.toString() ?? '';
                          return Card(
                            child: ListTile(
                              title: Text(
                                row['reference_number']?.toString() ?? 'Travel #$id',
                                style: const TextStyle(fontWeight: FontWeight.w600),
                              ),
                              subtitle: Text(
                                '${row['purpose'] ?? ''}\n'
                                'Est. DSA: ${row['estimated_dsa'] ?? '—'} ${row['currency'] ?? ''}'
                                ' · ${row['finance_status'] ?? 'awaiting'}',
                              ),
                              isThreeLine: true,
                              trailing: const Icon(Icons.chevron_right),
                              onTap: id.isEmpty
                                  ? null
                                  : () => context.push('/requests/travel/detail?id=$id'),
                            ),
                          );
                        },
                      ),
      ),
      bottomNavigationBar: const Padding(
        padding: EdgeInsets.all(12),
        child: Text(
          'DSA Rate Types 1/2/3 are calculated on the travel detail (web or API). '
          'This queue is read-only on mobile.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
        ),
      ),
    );
  }
}
