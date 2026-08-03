import 'dart:convert';

import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/offline/draft_database.dart';
import '../../../../../core/offline/draft_provider.dart';
import '../../../../../core/offline/draft_sync_outcome.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../features/stock/data/stocktake_draft_queue.dart';
import '../../../../../shared/widgets/stitch_card.dart';
import '../../../../../shared/widgets/stitch_screen.dart';

class OfflineDraftsScreen extends ConsumerStatefulWidget {
  const OfflineDraftsScreen({super.key});

  @override
  ConsumerState<OfflineDraftsScreen> createState() =>
      _OfflineDraftsScreenState();
}

class _OfflineDraftsScreenState extends ConsumerState<OfflineDraftsScreen> {
  bool _syncing = false;
  List<DraftEntry> _drafts = [];
  List<StocktakeDraftLine> _stocktakeQueue = [];
  bool _loading = true;
  String? _error;
  DateTime? _lastSync;

  @override
  void initState() {
    super.initState();
    _loadDrafts();
  }

  Future<void> _loadDrafts() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final db = ref.read(draftDatabaseProvider);
      final list = await (db.select(db.draftEntries)
            ..where((t) => t.syncedAt.isNull())
            ..orderBy([(t) => OrderingTerm.desc(t.createdAt)]))
          .get();
      final stocktakeQueue = await StocktakeDraftQueue.load();
      if (!mounted) return;
      setState(() {
        _drafts = list;
        _stocktakeQueue = stocktakeQueue;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load drafts.';
        _loading = false;
      });
    }
  }

  Future<void> _syncAll() async {
    if (_drafts.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_stocktakeQueue.isEmpty
              ? 'No drafts to sync.'
              : 'Open Stock Scan to sync queued stocktake lines.'),
          backgroundColor: AppColors.info,
        ),
      );
      return;
    }
    setState(() => _syncing = true);
    final dio = ref.read(apiClientProvider).dio;
    final db = ref.read(draftDatabaseProvider);
    int synced = 0;
    int failed = 0;
    for (final draft in List<DraftEntry>.from(_drafts)) {
      try {
        final payload = jsonDecode(draft.payload) as Map<String, dynamic>?;
        if (payload == null) {
          failed++;
          continue;
        }
        String endpoint;
        Map<String, dynamic> requestBody = payload;
        switch (draft.type.toLowerCase()) {
          case 'travel':
            endpoint = '/travel/requests';
            break;
          case 'leave':
            endpoint = '/leave/requests';
            break;
          case 'imprest':
            endpoint = '/imprest/requests';
            break;
          case 'procurement':
            endpoint = '/procurement/requests';
            break;
          case 'salary_advance':
            endpoint = '/finance/advances';
            requestBody = {
              'advance_type': _purposeToAdvanceType(
                  payload['purpose']?.toString() ?? 'Other'),
              'amount': payload['amount'],
              'currency': 'NAD',
              'repayment_months': payload['repayment_months'] ?? 3,
              'purpose': payload['purpose'] ?? 'Other',
              'justification': 'Offline salary advance draft submission.',
            };
            break;
          case 'pif':
            endpoint = '/programmes';
            requestBody = {
              'title': payload['title'],
              'background': payload['background'],
              'overall_objective': payload['overall_objective'],
              'primary_currency': 'NAD',
              'total_budget': _sumBudgetLines(payload['budget_lines']),
              'funding_source': 'SADC PF',
              'member_states': payload['location'] == null ||
                      payload['location'].toString().isEmpty
                  ? []
                  : [payload['location'].toString()],
              'budget_lines': payload['budget_lines'] ?? [],
            };
            break;
          default:
            failed++;
            continue;
        }
        final response =
            await dio.post<Map<String, dynamic>>(endpoint, data: requestBody);
        final createdId = response.data?['data']?['id'];
        if (draft.type.toLowerCase() == 'salary_advance' && createdId != null) {
          await dio.post('/finance/advances/$createdId/submit');
        } else if (draft.type.toLowerCase() == 'pif' && createdId != null) {
          await dio.post('/programmes/$createdId/submit');
        }
        await (db.delete(db.draftEntries)..where((t) => t.id.equals(draft.id)))
            .go();
        synced++;
        if (mounted) _drafts.removeWhere((d) => d.id == draft.id);
      } catch (_) {
        failed++;
      }
    }
    if (mounted) {
      setState(() {
        _syncing = false;
        _lastSync = DateTime.now();
      });
      final outcome = DraftSyncOutcome(synced: synced, failed: failed);
      if (!outcome.nothingToDo) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(outcome.snackbarMessage()),
            backgroundColor: outcome.allFailed
                ? AppColors.danger
                : (outcome.partialSuccess
                    ? AppColors.warning
                    : AppColors.success),
          ),
        );
      }
      _loadDrafts();
    }
  }

  void _continueEditing(DraftEntry draft) {
    Map<String, dynamic> payload;
    try {
      payload = jsonDecode(draft.payload) as Map<String, dynamic>;
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Invalid draft data.'),
            backgroundColor: AppColors.danger),
      );
      return;
    }
    final extra = {'payload': payload, 'draftId': draft.id};
    switch (draft.type.toLowerCase()) {
      case 'travel':
        context.push('/requests/travel/new', extra: extra);
        break;
      case 'leave':
        context.push('/requests/leave/new', extra: extra);
        break;
      case 'imprest':
        context.push('/imprest/form', extra: extra);
        break;
      case 'procurement':
        context.push('/procurement/form', extra: extra);
        break;
      case 'salary_advance':
        context.push('/salary/advance/new', extra: extra);
        break;
      case 'pif':
        context.push('/pif/form', extra: extra);
        break;
      default:
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Unknown draft type.'),
              backgroundColor: AppColors.warning),
        );
    }
  }

  Future<void> _deleteDraft(DraftEntry draft) async {
    try {
      final db = ref.read(draftDatabaseProvider);
      await (db.delete(db.draftEntries)..where((t) => t.id.equals(draft.id)))
          .go();
      if (mounted) setState(() => _drafts.removeWhere((d) => d.id == draft.id));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Failed to delete draft.'),
              backgroundColor: AppColors.danger),
        );
      }
    }
  }

  Future<void> _confirmDeleteDraft(DraftEntry draft) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete draft?'),
        content: Text(
          'Delete "${draft.title}" from Offline Drafts? This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await _deleteDraft(draft);
    }
  }

  static String _typeLabel(String type) {
    switch (type.toLowerCase()) {
      case 'travel':
        return 'Travel Request';
      case 'leave':
        return 'Leave Request';
      case 'imprest':
        return 'Imprest';
      case 'procurement':
        return 'Procurement';
      case 'salary_advance':
        return 'Salary Advance';
      case 'pif':
        return 'PIF';
      default:
        return type;
    }
  }

  static IconData _typeIcon(String type) {
    switch (type.toLowerCase()) {
      case 'travel':
        return Icons.flight_takeoff;
      case 'leave':
        return Icons.beach_access;
      case 'imprest':
        return Icons.account_balance_wallet_outlined;
      case 'procurement':
        return Icons.inventory_2_outlined;
      case 'salary_advance':
        return Icons.account_balance_wallet_outlined;
      case 'pif':
        return Icons.assignment_outlined;
      default:
        return Icons.edit_note;
    }
  }

  static Color _typeColor(String type) {
    switch (type.toLowerCase()) {
      case 'travel':
        return const Color(0xFF13EC80);
      case 'leave':
        return const Color(0xFF3B82F6);
      case 'imprest':
        return const Color(0xFFD4AF37);
      case 'procurement':
        return const Color(0xFFEF4444);
      case 'salary_advance':
        return const Color(0xFF13EC80);
      case 'pif':
        return const Color(0xFF3B82F6);
      default:
        return AppColors.primary;
    }
  }

  static String _timeAgo(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays} days ago';
    return '${dt.day}/${dt.month}/${dt.year}';
  }

  @override
  Widget build(BuildContext context) {
    return StitchScreen(
      title: 'Offline Drafts',
      floatingActionButton: FloatingActionButton.extended(
        onPressed: (_syncing || _loading) ? null : _syncAll,
        backgroundColor: AppColors.primary,
        icon: _syncing
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: AppColors.bgDark))
            : const Icon(Icons.sync),
        label: Text(_syncing ? 'Syncing...' : 'Sync All'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.warning.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
              border:
                  Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
            ),
            child: const Row(
              children: [
                Icon(Icons.wifi_off, color: AppColors.warning, size: 18),
                SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Working Offline',
                          style: TextStyle(
                              color: AppColors.warning,
                              fontSize: 12,
                              fontWeight: FontWeight.w700)),
                      Text('Drafts are saved locally. Sync when connected.',
                          style: TextStyle(
                              color: AppColors.textSecondary, fontSize: 11)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                  child: _statCard(
                      'Drafts',
                      '${_drafts.length + _stocktakeQueue.length}',
                      AppColors.primary)),
              const SizedBox(width: 10),
              Expanded(
                  child: _statCard(
                      'Last Sync',
                      _lastSync != null ? _timeAgo(_lastSync!) : '—',
                      AppColors.success)),
            ],
          ),
          const SizedBox(height: 20),
          const Text('SAVED DRAFTS',
              style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8)),
          const SizedBox(height: 10),
          if (_stocktakeQueue.isNotEmpty) ...[
            StitchCard(
              onTap: () => context.push('/stock/scan'),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.inventory_2_outlined,
                        color: AppColors.primary, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Stocktake offline queue',
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${_stocktakeQueue.length} line(s) waiting. Open Stock Scan to sync.',
                          style: const TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right,
                      color: AppColors.textMuted, size: 20),
                ],
              ),
            ),
            const SizedBox(height: 10),
          ],
          if (_loading)
            const SizedBox(
                height: 180, child: StitchLoadingState(label: 'Loading drafts'))
          else if (_error != null)
            SizedBox(
                height: 200,
                child: StitchErrorState(message: _error!, onRetry: _loadDrafts))
          else if (_drafts.isEmpty && _stocktakeQueue.isEmpty)
            const SizedBox(
              height: 220,
              child: StitchEmptyState(
                icon: Icons.edit_note_outlined,
                title: 'No drafts',
                message: 'Save forms as draft when offline.',
              ),
            )
          else
            ..._drafts.map((d) => _draftTile(d)),
        ],
      ),
    );
  }

  Widget _statCard(String label, String val, Color color) => StitchCard(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Column(
          children: [
            Text(val,
                style: TextStyle(
                    color: color, fontSize: 18, fontWeight: FontWeight.w800)),
            Text(label,
                style:
                    const TextStyle(color: AppColors.textMuted, fontSize: 10)),
          ],
        ),
      );

  Widget _draftTile(DraftEntry d) {
    final color = _typeColor(d.type);
    return Semantics(
      label:
          'Draft ${d.title}, ${_typeLabel(d.type)}, saved ${_timeAgo(d.createdAt)}',
      child: StitchCard(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(_typeIcon(d.type), color: color, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(d.title,
                      style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(_typeLabel(d.type),
                      style: const TextStyle(
                          color: AppColors.textMuted, fontSize: 11)),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.access_time,
                          color: AppColors.textMuted, size: 10),
                      const SizedBox(width: 3),
                      Text(_timeAgo(d.createdAt),
                          style: const TextStyle(
                              color: AppColors.textMuted, fontSize: 10)),
                    ],
                  ),
                ],
              ),
            ),
            PopupMenuButton<String>(
              color: AppColors.bgSurface,
              icon: const Icon(Icons.more_vert,
                  color: AppColors.textMuted, size: 20),
              onSelected: (val) {
                if (val == 'continue') _continueEditing(d);
                if (val == 'delete') _confirmDeleteDraft(d);
              },
              itemBuilder: (_) => [
                const PopupMenuItem(
                    value: 'continue',
                    child: Text('Continue Editing',
                        style: TextStyle(
                            color: AppColors.textPrimary, fontSize: 13))),
                const PopupMenuItem(
                    value: 'delete',
                    child: Text('Delete Draft',
                        style:
                            TextStyle(color: AppColors.danger, fontSize: 13))),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

String _purposeToAdvanceType(String purpose) {
  const map = {
    'Personal Emergency': 'other',
    'Medical Expenses': 'medical',
    'Education': 'school',
    'Home Repair': 'other',
    'Other': 'other',
  };
  return map[purpose] ?? 'other';
}

double _sumBudgetLines(dynamic rawLines) {
  if (rawLines is! List) return 0;
  return rawLines.fold<double>(0, (sum, item) {
    if (item is! Map) return sum;
    final amount = double.tryParse('${item['amount']}') ?? 0;
    return sum + amount;
  });
}
