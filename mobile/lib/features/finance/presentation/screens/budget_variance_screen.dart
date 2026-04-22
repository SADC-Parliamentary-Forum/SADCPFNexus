import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/utils/date_format.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  SCREEN  (Audit Log — wired to /admin/audit-logs)
// ─────────────────────────────────────────────────────────────────────────────
class BudgetVarianceScreen extends ConsumerStatefulWidget {
  const BudgetVarianceScreen({super.key});

  @override
  ConsumerState<BudgetVarianceScreen> createState() =>
      _BudgetVarianceScreenState();
}

class _BudgetVarianceScreenState extends ConsumerState<BudgetVarianceScreen> {
  final _searchCtrl = TextEditingController();
  String _query = '';

  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _entries = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get<Map<String, dynamic>>(
        '/admin/audit-logs',
        queryParameters: {'per_page': 50},
      );
      final data = res.data?['data'] as List<dynamic>? ?? [];
      setState(() {
        _entries = data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _error = 'Failed to load audit log.';
        _loading = false;
      });
    }
  }

  // Group entries by date string (e.g. "TODAY  11 APR 2026")
  List<_AuditGroup> get _grouped {
    final q = _query.toLowerCase();
    final filtered = _entries.where((e) {
      if (q.isEmpty) return true;
      final action = (e['action'] as String? ?? '').toLowerCase();
      final module = (e['module'] as String? ?? '').toLowerCase();
      final actor  = ((e['user'] as Map?)?.containsKey('name') == true
          ? (e['user']['name'] as String? ?? '')
          : '').toLowerCase();
      return action.contains(q) || module.contains(q) || actor.contains(q);
    }).toList();

    final groups = <String, List<Map<String, dynamic>>>{};
    for (final e in filtered) {
      final label = _dateLabel(e['created_at'] as String? ?? '');
      groups.putIfAbsent(label, () => []).add(e);
    }
    return groups.entries
        .map((kv) => _AuditGroup(dateLabel: kv.key, entries: kv.value))
        .toList();
  }

  String _dateLabel(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final d     = DateTime(dt.year, dt.month, dt.day);
      if (d == today) return 'TODAY  ${AppDateFormatter.short(iso)}';
      if (d == today.subtract(const Duration(days: 1))) {
        return 'YESTERDAY  ${AppDateFormatter.short(iso)}';
      }
      return AppDateFormatter.short(iso).toUpperCase();
    } catch (_) {
      return iso;
    }
  }

  Color _moduleColor(String module) {
    switch (module.toLowerCase()) {
      case 'travelrequest':
      case 'travel':
        return AppColors.primary;
      case 'imprest':
      case 'imprestrequest':
        return AppColors.warning;
      case 'leave':
      case 'leaverequest':
        return AppColors.success;
      case 'procurement':
      case 'procurementrequest':
        return AppColors.danger;
      default:
        return AppColors.textSecondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: AppColors.textPrimary, size: 18),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text(
          'Audit Log',
          style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded,
                color: AppColors.textSecondary),
            onPressed: _load,
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Immutable Ledger Banner ──────────────────────────────────
          Container(
            margin: const EdgeInsets.fromLTRB(16, 4, 16, 0),
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                  color: AppColors.success.withValues(alpha: 0.35)),
            ),
            child: Row(
              children: [
                const Icon(Icons.lock_rounded,
                    color: AppColors.success, size: 16),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'IMMUTABLE LEDGER ACTIVE',
                    style: TextStyle(
                        color: AppColors.success,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    _loading
                        ? 'Loading…'
                        : '${_entries.length} Records',
                    style: const TextStyle(
                        color: AppColors.success,
                        fontSize: 10,
                        fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // ── Search Bar ───────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: TextField(
              controller: _searchCtrl,
              onChanged: (v) => setState(() => _query = v),
              style: const TextStyle(
                  color: AppColors.textPrimary, fontSize: 13),
              decoration: InputDecoration(
                hintText: 'Search by module, action, or user…',
                hintStyle: const TextStyle(
                    color: AppColors.textMuted, fontSize: 13),
                prefixIcon: const Icon(Icons.search_rounded,
                    color: AppColors.textMuted, size: 18),
                filled: true,
                fillColor: AppColors.bgSurface,
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(
                      color: AppColors.primary, width: 1.5),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // ── Timeline List ────────────────────────────────────────────
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(
                        color: AppColors.primary))
                : _error != null
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.error_outline_rounded,
                                color: AppColors.danger, size: 40),
                            const SizedBox(height: 12),
                            Text(_error!,
                                style: const TextStyle(
                                    color: AppColors.textSecondary)),
                            const SizedBox(height: 12),
                            TextButton(
                              onPressed: _load,
                              child: const Text('Retry',
                                  style:
                                      TextStyle(color: AppColors.primary)),
                            ),
                          ],
                        ),
                      )
                    : _grouped.isEmpty
                        ? const Center(
                            child: Text('No audit entries found.',
                                style: TextStyle(
                                    color: AppColors.textMuted)))
                        : ListView.builder(
                            padding:
                                const EdgeInsets.fromLTRB(16, 0, 16, 100),
                            itemCount: _grouped.length,
                            itemBuilder: (context, gi) {
                              final group = _grouped[gi];
                              return Column(
                                crossAxisAlignment:
                                    CrossAxisAlignment.start,
                                children: [
                                  Padding(
                                    padding: const EdgeInsets.only(
                                        bottom: 10, top: 4),
                                    child: Text(
                                      group.dateLabel,
                                      style: const TextStyle(
                                          color: AppColors.textMuted,
                                          fontSize: 10,
                                          fontWeight: FontWeight.w700,
                                          letterSpacing: 1.2),
                                    ),
                                  ),
                                  ...group.entries.map((e) =>
                                      _AuditEntryCard(
                                          entry: e,
                                          moduleColor: _moduleColor(
                                              e['module'] as String? ??
                                                  ''))),
                                  const SizedBox(height: 8),
                                ],
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────
class _AuditGroup {
  final String dateLabel;
  final List<Map<String, dynamic>> entries;
  const _AuditGroup({required this.dateLabel, required this.entries});
}

// ─────────────────────────────────────────────────────────────────────────────
//  ENTRY CARD
// ─────────────────────────────────────────────────────────────────────────────
class _AuditEntryCard extends StatelessWidget {
  final Map<String, dynamic> entry;
  final Color moduleColor;
  const _AuditEntryCard({required this.entry, required this.moduleColor});

  @override
  Widget build(BuildContext context) {
    final action  = entry['action']  as String? ?? '—';
    final module  = entry['module']  as String? ?? '—';
    final desc    = entry['description'] as String?;
    final actor   = (entry['user'] as Map?)?.containsKey('name') == true
        ? entry['user']['name'] as String? ?? 'System'
        : 'System';
    final ip      = entry['ip_address'] as String? ?? '';
    final created = entry['created_at'] as String? ?? '';
    final timeStr = _timeOnly(created);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Module badge + time
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: moduleColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                      color: moduleColor.withValues(alpha: 0.4)),
                ),
                child: Text(
                  module.toUpperCase(),
                  style: TextStyle(
                      color: moduleColor,
                      fontSize: 9,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.5),
                ),
              ),
              const Spacer(),
              Text(timeStr,
                  style: const TextStyle(
                      color: AppColors.textMuted, fontSize: 11)),
            ],
          ),
          const SizedBox(height: 8),

          // Action
          Text(
            action,
            style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 3),

          // Actor + IP
          Row(
            children: [
              const Icon(Icons.person_rounded,
                  color: AppColors.textMuted, size: 12),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  ip.isNotEmpty ? '$actor · $ip' : actor,
                  style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 11,
                      fontWeight: FontWeight.w600),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),

          // Description
          if (desc != null && desc.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              desc,
              style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 11,
                  height: 1.5),
            ),
          ],

          // Entry ID tag
          const SizedBox(height: 8),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: AppColors.bgDark,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.link_rounded,
                    color: AppColors.textMuted, size: 11),
                const SizedBox(width: 4),
                Text(
                  'ID: ${entry['id']}',
                  style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 10,
                      fontFamily: 'monospace'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _timeOnly(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      final h  = dt.hour.toString().padLeft(2, '0');
      final m  = dt.minute.toString().padLeft(2, '0');
      return '$h:$m';
    } catch (_) {
      return iso;
    }
  }
}
