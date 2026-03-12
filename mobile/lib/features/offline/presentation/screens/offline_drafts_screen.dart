import 'dart:convert';

import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/offline/draft_database.dart';
import '../../../../../core/offline/draft_provider.dart';
import '../../../../../core/theme/app_theme.dart';

class OfflineDraftsScreen extends ConsumerStatefulWidget {
  const OfflineDraftsScreen({super.key});

  @override
  ConsumerState<OfflineDraftsScreen> createState() => _OfflineDraftsScreenState();
}

class _OfflineDraftsScreenState extends ConsumerState<OfflineDraftsScreen> {
  bool _syncing = false;
  List<DraftEntry> _drafts = [];
  bool _loading = true;
  String? _error;
  DateTime? _lastSync;

  @override
  void initState() {
    super.initState();
    _loadDrafts();
  }

  Future<void> _loadDrafts() async {
    setState(() { _loading = true; _error = null; });
    try {
      final db = ref.read(draftDatabaseProvider);
      final list = await (db.select(db.draftEntries)
            ..where((t) => t.syncedAt.isNull())
            ..orderBy([(t) => OrderingTerm.desc(t.createdAt)]))
          .get();
      if (!mounted) return;
      setState(() { _drafts = list; _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = 'Failed to load drafts.'; _loading = false; });
    }
  }

  Future<void> _syncAll() async {
    if (_drafts.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No drafts to sync.'), backgroundColor: AppColors.info),
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
          default:
            failed++;
            continue;
        }
        await dio.post(endpoint, data: payload);
        await (db.delete(db.draftEntries)..where((t) => t.id.equals(draft.id))).go();
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
      if (synced > 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(failed == 0 ? 'All drafts synced successfully.' : 'Synced $synced draft(s). $failed failed.'),
            backgroundColor: failed > 0 ? AppColors.warning : AppColors.success,
          ),
        );
      }
      if (failed > 0 && synced == 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sync failed. Check connection and try again.'), backgroundColor: AppColors.danger),
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
        const SnackBar(content: Text('Invalid draft data.'), backgroundColor: AppColors.danger),
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
      default:
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Unknown draft type.'), backgroundColor: AppColors.warning),
        );
    }
  }

  Future<void> _deleteDraft(DraftEntry draft) async {
    try {
      final db = ref.read(draftDatabaseProvider);
      await (db.delete(db.draftEntries)..where((t) => t.id.equals(draft.id))).go();
      if (mounted) setState(() => _drafts.removeWhere((d) => d.id == draft.id));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to delete draft.'), backgroundColor: AppColors.danger),
        );
      }
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
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Offline Drafts', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [
          TextButton.icon(
            onPressed: (_syncing || _loading) ? null : _syncAll,
            icon: _syncing
                ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
                : const Icon(Icons.sync, color: AppColors.primary, size: 16),
            label: Text(_syncing ? 'Syncing...' : 'Sync All', style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.warning.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
            ),
            child: const Row(
              children: [
                Icon(Icons.wifi_off, color: AppColors.warning, size: 18),
                SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Working Offline', style: TextStyle(color: AppColors.warning, fontSize: 12, fontWeight: FontWeight.w700)),
                      Text('Drafts are saved locally. Sync when connected.', style: TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _statCard('Drafts', '${_drafts.length}', AppColors.primary)),
              const SizedBox(width: 10),
              Expanded(child: _statCard('Last Sync', _lastSync != null ? _timeAgo(_lastSync!) : '—', AppColors.success)),
            ],
          ),
          const SizedBox(height: 20),
          const Text('SAVED DRAFTS', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 10),
          if (_loading)
            const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator(color: AppColors.primary)))
          else if (_error != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Text(_error!, style: const TextStyle(color: AppColors.danger)),
                  TextButton(onPressed: _loadDrafts, child: const Text('Retry')),
                ],
              ),
            )
          else if (_drafts.isEmpty)
            const Padding(padding: EdgeInsets.all(24), child: Center(child: Text('No drafts. Save forms as draft when offline.', style: TextStyle(color: AppColors.textMuted))))
          else
            ..._drafts.map((d) => _draftTile(d)),
        ],
      ),
    );
  }

  Widget _statCard(String label, String val, Color color) => Container(
    padding: const EdgeInsets.symmetric(vertical: 10),
    decoration: BoxDecoration(
      color: AppColors.bgSurface,
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: AppColors.border),
    ),
    child: Column(
      children: [
        Text(val, style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.w800)),
        Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
      ],
    ),
  );

  Widget _draftTile(DraftEntry d) {
    final color = _typeColor(d.type);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
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
                Text(d.title, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(_typeLabel(d.type), style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.access_time, color: AppColors.textMuted, size: 10),
                    const SizedBox(width: 3),
                    Text(_timeAgo(d.createdAt), style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
                  ],
                ),
              ],
            ),
          ),
          PopupMenuButton<String>(
            color: AppColors.bgSurface,
            icon: const Icon(Icons.more_vert, color: AppColors.textMuted, size: 20),
            onSelected: (val) {
              if (val == 'continue') _continueEditing(d);
              if (val == 'delete') _deleteDraft(d);
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'continue', child: Text('Continue Editing', style: TextStyle(color: AppColors.textPrimary, fontSize: 13))),
              const PopupMenuItem(value: 'delete', child: Text('Delete Draft', style: TextStyle(color: AppColors.danger, fontSize: 13))),
            ],
          ),
        ],
      ),
    );
  }
}
