import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/utils/date_format.dart' show AppDateFormatter;

class ProcurementDetailScreen extends ConsumerStatefulWidget {
  const ProcurementDetailScreen({super.key, this.requestId});
  final String? requestId;

  @override
  ConsumerState<ProcurementDetailScreen> createState() => _ProcurementDetailScreenState();
}

class _ProcurementDetailScreenState extends ConsumerState<ProcurementDetailScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _request;
  bool _actionLoading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final id = widget.requestId;
    if (id == null) {
      setState(() { _loading = false; _error = 'No request ID provided.'; });
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final r = await dio.get<Map<String, dynamic>>('/procurement/requests/$id');
      if (!mounted) return;
      setState(() { _request = r.data; _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString().contains('404') ? 'Request not found.' : 'Failed to load request.';
      });
    }
  }

  void _safePopOrGoHome() {
    if (context.canPop()) { context.pop(); }
    else { context.go('/requests'); }
  }

  Future<void> _submit() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgSurface,
        title: const Text('Submit for approval?', style: TextStyle(color: AppColors.textPrimary)),
        content: const Text('The request will be sent to your Head of Department for review.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            child: const Text('Submit', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _actionLoading = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.post('/procurement/requests/${widget.requestId}/submit');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Request submitted for approval.'), backgroundColor: AppColors.success),
      );
      _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().contains('422') ? 'Cannot submit this request.' : 'Submission failed. Try again.'),
            backgroundColor: AppColors.danger),
      );
    } finally {
      if (mounted) setState(() => _actionLoading = false);
    }
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgSurface,
        title: const Text('Delete request?', style: TextStyle(color: AppColors.textPrimary)),
        content: const Text('This draft will be permanently deleted. This cannot be undone.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            child: const Text('Delete', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _actionLoading = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.delete('/procurement/requests/${widget.requestId}');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Request deleted.'), backgroundColor: AppColors.bgSurface),
      );
      _safePopOrGoHome();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().contains('422') ? 'Only draft requests can be deleted.' : 'Delete failed.'),
            backgroundColor: AppColors.danger),
      );
      setState(() => _actionLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary),
          onPressed: _safePopOrGoHome,
        ),
        title: const Text('Procurement Request',
            style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
      ),
      body: _loading
          ? _buildSkeleton()
          : _error != null
              ? _buildError()
              : _buildBody(),
    );
  }

  Widget _buildSkeleton() => ListView(
    padding: const EdgeInsets.all(16),
    children: List.generate(4, (i) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        height: i == 0 ? 100 : 80,
        decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14)),
      ),
    )),
  );

  Widget _buildError() => Center(
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      const Icon(Icons.error_outline, color: AppColors.danger, size: 40),
      const SizedBox(height: 12),
      Text(_error!, style: const TextStyle(color: AppColors.textSecondary, fontSize: 14)),
      const SizedBox(height: 16),
      ElevatedButton(onPressed: _load,
        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
        child: const Text('Retry', style: TextStyle(color: Colors.white))),
    ]),
  );

  Widget _buildBody() {
    final r = _request!;
    final status = (r['status'] as String? ?? 'draft').toLowerCase();
    final isDraft = status == 'draft';
    final isSubmitted = status == 'submitted';
    final isRejected = status == 'rejected';

    final statusConfig = _statusConfig(status);
    final items = (r['items'] as List? ?? []).cast<Map<String, dynamic>>();
    final quotes = (r['quotes'] as List? ?? []).cast<Map<String, dynamic>>();
    final awardedQuoteId = r['awarded_quote_id'];

    final currency = r['currency'] as String? ?? 'N\$';
    final estimated = (r['estimated_value'] as num?)?.toDouble() ?? 0;

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Status header ──────────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [statusConfig.color.withValues(alpha: 0.08), AppColors.bgSurface]),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: statusConfig.color.withValues(alpha: 0.25)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusConfig.color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(statusConfig.icon, color: statusConfig.color, size: 12),
                    const SizedBox(width: 4),
                    Text(statusConfig.label,
                        style: TextStyle(color: statusConfig.color, fontSize: 11, fontWeight: FontWeight.w700)),
                  ]),
                ),
                const Spacer(),
                Text(r['reference_number'] as String? ?? '', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
              ]),
              const SizedBox(height: 12),
              Text(r['title'] as String? ?? '',
                  style: const TextStyle(color: AppColors.textPrimary, fontSize: 17, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text(_headerSubtitle(r, status),
                  style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
              if (isRejected && r['rejection_reason'] != null) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.danger.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(8)),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Icon(Icons.cancel_outlined, color: AppColors.danger, size: 14),
                    const SizedBox(width: 6),
                    Expanded(child: Text(r['rejection_reason'] as String,
                        style: const TextStyle(color: AppColors.danger, fontSize: 12))),
                  ]),
                ),
              ],
            ]),
          ),
          const SizedBox(height: 16),

          // ── Requisition details ────────────────────────────────────────────
          _card(children: [
            _sectionHeader('Requisition Details', Icons.description_outlined, AppColors.primary),
            _row('Category', _titleCase(r['category'] as String? ?? '')),
            _row('Method', _titleCase((r['procurement_method'] as String? ?? '').replaceAll('_', ' '))),
            if (r['budget_line'] != null) _row('Budget Line', r['budget_line'] as String),
            _row('Estimated Value', '$currency ${estimated.toStringAsFixed(2)}'),
            if (r['required_by_date'] != null)
              _row('Required By', AppDateFormatter.short(r['required_by_date'] as String)),
            if (r['requester'] != null)
              _row('Requested By', r['requester']['name'] as String? ?? ''),
            if (r['description'] != null && (r['description'] as String).isNotEmpty) ...[
              const Divider(color: AppColors.border, height: 20, indent: 14, endIndent: 14),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                child: Text(r['description'] as String,
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
              ),
            ] else
              const SizedBox(height: 12),
          ]),
          const SizedBox(height: 12),

          // ── Line items ────────────────────────────────────────────────────
          if (items.isNotEmpty) ...[
            _card(children: [
              _sectionHeader('Items Requested', Icons.list_alt_outlined, AppColors.warning),
              ...items.map((item) => _itemRow(item, currency)),
              const Divider(color: AppColors.border, height: 20, indent: 14, endIndent: 14),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                child: Row(children: [
                  const Text('Estimated Total', style: TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
                  const Spacer(),
                  Text('$currency ${estimated.toStringAsFixed(2)}',
                      style: const TextStyle(color: AppColors.primary, fontSize: 15, fontWeight: FontWeight.w800)),
                ]),
              ),
            ]),
            const SizedBox(height: 12),
          ],

          // ── Supplier quotes ────────────────────────────────────────────────
          if (quotes.isNotEmpty) ...[
            _card(children: [
              _sectionHeader('Supplier Quotes', Icons.compare_outlined, AppColors.success),
              ...quotes.asMap().entries.map((entry) {
                final q = entry.value;
                final isAwarded = awardedQuoteId != null && q['id'] == awardedQuoteId;
                final rank = entry.key + 1;
                return _quoteRow(q, rank, isAwarded, currency);
              }),
              const SizedBox(height: 4),
            ]),
            const SizedBox(height: 12),
          ],

          // ── Approval chain ────────────────────────────────────────────────
          _card(children: [
            _sectionHeader('Approval Chain', Icons.account_tree_outlined, AppColors.info),
            _approvalStep(
              role: 'Requester',
              name: r['requester']?['name'] as String? ?? 'You',
              done: true,
              isLast: false,
            ),
            _approvalStep(
              role: 'Head of Department',
              name: r['hod'] != null ? r['hod']['name'] as String? ?? 'Pending' : 'Pending',
              done: ['hod_approved', 'rfq_issued', 'evaluated', 'awarded', 'po_issued', 'completed']
                  .contains(status),
              isLast: false,
            ),
            _approvalStep(
              role: 'Procurement Officer',
              name: status == 'awarded' || status == 'po_issued' || status == 'completed'
                  ? (r['approver']?['name'] as String? ?? 'Approved')
                  : 'Pending',
              done: ['awarded', 'po_issued', 'completed'].contains(status),
              isLast: false,
            ),
            _approvalStep(
              role: 'Finance / Director',
              name: status == 'completed' ? 'Approved' : 'Awaiting',
              done: status == 'completed',
              isLast: true,
            ),
          ]),
          const SizedBox(height: 20),

          // ── Action buttons ─────────────────────────────────────────────────
          if (isDraft || isSubmitted) ...[
            if (_actionLoading)
              const Center(child: CircularProgressIndicator(color: AppColors.primary))
            else
              Row(children: [
                if (isDraft) ...[
                  Expanded(child: OutlinedButton.icon(
                    onPressed: _delete,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.danger,
                      side: const BorderSide(color: AppColors.danger),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    icon: const Icon(Icons.delete_outline, size: 16),
                    label: const Text('Delete', style: TextStyle(fontWeight: FontWeight.w700)),
                  )),
                  const SizedBox(width: 12),
                  Expanded(child: ElevatedButton.icon(
                    onPressed: _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    icon: const Icon(Icons.send_outlined, size: 16),
                    label: const Text('Submit', style: TextStyle(fontWeight: FontWeight.w700)),
                  )),
                ],
                if (isSubmitted)
                  Expanded(child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      color: AppColors.warning.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
                    ),
                    child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(Icons.hourglass_empty, color: AppColors.warning, size: 16),
                      SizedBox(width: 8),
                      Text('Awaiting HOD Approval',
                          style: TextStyle(color: AppColors.warning, fontWeight: FontWeight.w700)),
                    ]),
                  )),
              ]),
          ],

          const SizedBox(height: 32),
        ],
      ),
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  String _headerSubtitle(Map<String, dynamic> r, String status) {
    final submitted = r['submitted_at'] as String?;
    final quotes = (r['quotes'] as List?)?.length ?? 0;
    final parts = <String>[];
    if (submitted != null) parts.add('Submitted ${AppDateFormatter.short(submitted)}');
    if (quotes > 0) parts.add('$quotes quote${quotes == 1 ? '' : 's'} received');
    return parts.isNotEmpty ? parts.join('  ·  ') : _titleCase(status.replaceAll('_', ' '));
  }

  _StatusConfig _statusConfig(String status) {
    switch (status) {
      case 'draft':       return _StatusConfig(AppColors.textMuted, Icons.edit_outlined, 'Draft');
      case 'submitted':   return _StatusConfig(AppColors.warning, Icons.hourglass_empty, 'Pending HOD');
      case 'hod_approved':return _StatusConfig(AppColors.info, Icons.thumb_up_outlined, 'HOD Approved');
      case 'rfq_issued':  return _StatusConfig(AppColors.info, Icons.send_outlined, 'RFQ Issued');
      case 'evaluated':   return _StatusConfig(AppColors.primary, Icons.compare_outlined, 'Evaluated');
      case 'awarded':     return _StatusConfig(AppColors.success, Icons.emoji_events_outlined, 'Awarded');
      case 'po_issued':   return _StatusConfig(AppColors.success, Icons.receipt_long_outlined, 'PO Issued');
      case 'completed':   return _StatusConfig(AppColors.success, Icons.check_circle_outlined, 'Completed');
      case 'rejected':    return _StatusConfig(AppColors.danger, Icons.cancel_outlined, 'Rejected');
      case 'cancelled':   return _StatusConfig(AppColors.textMuted, Icons.block_outlined, 'Cancelled');
      default:            return _StatusConfig(AppColors.textMuted, Icons.inventory_2_outlined, _titleCase(status));
    }
  }

  String _titleCase(String s) =>
    s.split(' ').map((w) => w.isEmpty ? '' : '${w[0].toUpperCase()}${w.substring(1)}').join(' ');

  Widget _card({required List<Widget> children}) => Container(
    decoration: BoxDecoration(
      color: AppColors.bgSurface,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: AppColors.border),
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
  );

  Widget _sectionHeader(String title, IconData icon, Color color) => Padding(
    padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
    child: Row(children: [
      Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
        child: Icon(icon, color: color, size: 14)),
      const SizedBox(width: 8),
      Text(title, style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
    ]),
  );

  Widget _row(String label, String value) => Padding(
    padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(width: 130,
          child: Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 12))),
      Expanded(child: Text(value,
          style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w500))),
    ]),
  );

  Widget _itemRow(Map<String, dynamic> item, String currency) {
    final qty = item['quantity'] as int? ?? 1;
    final unit = (item['unit'] as String?)?.isNotEmpty == true ? item['unit'] as String : '';
    final unitPrice = (item['estimated_unit_price'] as num?)?.toDouble() ?? 0;
    final total = qty * unitPrice;
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 6, 14, 2),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(item['description'] as String? ?? '',
            style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w500)),
        const SizedBox(height: 2),
        Row(children: [
          Text('Qty: $qty${unit.isNotEmpty ? "  $unit" : ""}',
              style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
          if (unitPrice > 0) ...[
            const Text('  ×  ', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
            Text('$currency ${unitPrice.toStringAsFixed(2)}',
                style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
          ],
          const Spacer(),
          if (total > 0)
            Text('$currency ${total.toStringAsFixed(2)}',
                style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w600)),
        ]),
      ]),
    );
  }

  Widget _quoteRow(Map<String, dynamic> q, int rank, bool isAwarded, String currency) {
    final vendor = q['vendor'] as Map<String, dynamic>?;
    final vendorName = vendor?['name'] as String? ?? 'Vendor $rank';
    final amount = (q['total_amount'] ?? q['amount'] as num? ?? 0).toDouble();
    final rankLabel = isAwarded ? 'Awarded' : '${rank}${rank == 1 ? 'st' : rank == 2 ? 'nd' : 'rd'}';
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 6, 14, 2),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: isAwarded ? AppColors.success.withValues(alpha: 0.05) : AppColors.bgCard,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: isAwarded ? AppColors.success.withValues(alpha: 0.3) : AppColors.border),
        ),
        child: Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(vendorName,
                style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w600)),
            Text(rankLabel,
                style: TextStyle(color: isAwarded ? AppColors.success : AppColors.textMuted, fontSize: 10)),
          ])),
          if (amount > 0)
            Text('$currency ${amount.toStringAsFixed(2)}',
                style: TextStyle(color: isAwarded ? AppColors.success : AppColors.textSecondary,
                    fontSize: 13, fontWeight: FontWeight.w700)),
          if (isAwarded) ...[
            const SizedBox(width: 6),
            const Icon(Icons.check_circle, color: AppColors.success, size: 16),
          ],
        ]),
      ),
    );
  }

  Widget _approvalStep({required String role, required String name, required bool done, required bool isLast}) =>
    Padding(
      padding: const EdgeInsets.fromLTRB(14, 6, 14, 6),
      child: Row(children: [
        Column(children: [
          Container(
            width: 28, height: 28,
            decoration: BoxDecoration(
              color: done ? AppColors.success.withValues(alpha: 0.1) : AppColors.bgCard,
              shape: BoxShape.circle,
              border: Border.all(color: done ? AppColors.success : AppColors.border)),
            child: Icon(done ? Icons.check : Icons.hourglass_empty,
                color: done ? AppColors.success : AppColors.textMuted, size: 14)),
          if (!isLast) Container(width: 1, height: 20, color: AppColors.border),
        ]),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(name,
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
          Text(role, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
        ])),
        if (done)
          const Text('Approved', style: TextStyle(color: AppColors.success, fontSize: 11, fontWeight: FontWeight.w600)),
        if (!done && !isLast)
          const Text('Pending', style: TextStyle(color: AppColors.warning, fontSize: 11, fontWeight: FontWeight.w600)),
        if (!done && isLast)
          const Text('Awaiting', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
      ]),
    );
}

class _StatusConfig {
  final Color color;
  final IconData icon;
  final String label;
  const _StatusConfig(this.color, this.icon, this.label);
}
