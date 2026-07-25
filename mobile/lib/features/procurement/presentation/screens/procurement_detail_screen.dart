import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/utils/date_format.dart' show AppDateFormatter;
import '../../data/procurement_api_helpers.dart';

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
  List<Map<String, dynamic>> _quotes = [];
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
      final request = extractObjectData(r.data) ??
          Map<String, dynamic>.from(r.data ?? {});

      List<Map<String, dynamic>> quotes = [];
      try {
        final q = await dio.get<Map<String, dynamic>>(
          '/procurement/requests/$id/quotes',
        );
        quotes = extractListData(q.data);
      } catch (_) {
        quotes = (request['quotes'] as List? ?? [])
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      }

      if (!mounted) return;
      setState(() {
        _request = request;
        _quotes = quotes;
        _loading = false;
      });
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
    else { context.go('/procurement'); }
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
    final sealed = isRequestFinanciallySealed(r);
    final session = ref.watch(authSessionControllerProvider).state;
    final canIssue = canIssueProcurementRfq(
      permissions: session.permissions,
      roles: session.roles,
    );

    final statusConfig = procurementStatusConfig(status);
    final items = (r['items'] as List? ?? []).cast<Map<String, dynamic>>();
    final quotes = _quotes.isNotEmpty
        ? _quotes
        : (r['quotes'] as List? ?? [])
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
    final reservations = (r['budget_reservations'] as List? ??
            r['budgetReservations'] as List? ??
            [])
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    final awardedQuoteId = r['awarded_quote_id'];
    final rfqIssuedAt = r['rfq_issued_at'] as String?;

    final currency = r['currency'] as String? ?? 'NAD';
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

          // ── Budget reservations ────────────────────────────────────────────
          if (reservations.isNotEmpty) ...[
            _card(children: [
              _sectionHeader('Budget Reservations', Icons.account_balance_outlined, AppColors.info),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 0, 14, 8),
                child: Text(
                  'Pull to refresh for the latest reservation status from Finance.',
                  style: TextStyle(
                      color: AppColors.textMuted.withValues(alpha: 0.9),
                      fontSize: 11),
                ),
              ),
              ...reservations.map((res) {
                final amount = (res['reserved_amount'] as num?)?.toDouble() ?? 0;
                final line = res['budget_line'] as String? ?? r['budget_line'] as String? ?? '—';
                final resStatus = budgetReservationStatusLabel(res);
                final notes = res['notes'] as String?;
                final isReleased = resStatus == 'Released';
                return Padding(
                  padding: const EdgeInsets.fromLTRB(14, 4, 14, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(line,
                                    style: const TextStyle(
                                        color: AppColors.textPrimary,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600)),
                                Text(resStatus,
                                    style: TextStyle(
                                        color: isReleased
                                            ? AppColors.textMuted
                                            : AppColors.success,
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700)),
                              ],
                            ),
                          ),
                          Text('$currency ${amount.toStringAsFixed(2)}',
                              style: const TextStyle(
                                  color: AppColors.textPrimary,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700)),
                        ],
                      ),
                      if (notes != null && notes.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(notes,
                            style: const TextStyle(
                                color: AppColors.textMuted, fontSize: 11)),
                      ],
                    ],
                  ),
                );
              }),
              const SizedBox(height: 4),
            ]),
            const SizedBox(height: 12),
          ] else if (r['budget_line'] != null) ...[
            _card(children: [
              _sectionHeader('Budget', Icons.account_balance_outlined, AppColors.info),
              _row('Budget Line', r['budget_line'] as String),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                child: Text(
                  status == 'hod_approved'
                      ? 'No active reservation yet. Awaiting finance budget confirmation (web). Pull to refresh.'
                      : status == 'budget_reserved' || status == 'approved'
                          ? 'No reservation rows returned. Pull to refresh status.'
                          : 'Budget reservation details appear after Finance confirms funds.',
                  style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                ),
              ),
            ]),
            const SizedBox(height: 12),
          ],

          // ── RFQ ────────────────────────────────────────────────────────────
          _card(children: [
            _sectionHeader('RFQ', Icons.send_outlined, AppColors.primary),
            if (rfqIssuedAt != null) ...[
              _row('Issued', AppDateFormatter.short(rfqIssuedAt)),
              if (r['rfq_deadline'] != null)
                _row('Deadline',
                    AppDateFormatter.short(r['rfq_deadline'] as String)),
            ] else
              const Padding(
                padding: EdgeInsets.fromLTRB(14, 0, 14, 8),
                child: Text('RFQ not issued yet.',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 4, 14, 14),
              child: OutlinedButton.icon(
                onPressed: widget.requestId == null
                    ? null
                    : () => context
                        .push('/procurement/rfq/${widget.requestId}')
                        .then((_) => _load()),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: const BorderSide(color: AppColors.primary),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
                icon: Icon(
                  rfqIssuedAt != null
                      ? Icons.visibility_outlined
                      : Icons.send_outlined,
                  size: 16,
                ),
                label: Text(
                  rfqIssuedAt != null
                      ? 'View RFQ'
                      : (canIssue ? 'Issue / view RFQ' : 'RFQ details'),
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            ),
          ]),
          const SizedBox(height: 12),

          // ── Supplier quotes ────────────────────────────────────────────────
          if (quotes.isNotEmpty) ...[
            _card(children: [
              _sectionHeader('Supplier Quotes', Icons.compare_outlined, AppColors.success),
              if (sealed)
                const Padding(
                  padding: EdgeInsets.fromLTRB(14, 0, 14, 8),
                  child: Text(
                    'Financial amounts sealed until open.',
                    style: TextStyle(
                        color: AppColors.warning,
                        fontSize: 11,
                        fontWeight: FontWeight.w600),
                  ),
                ),
              ...quotes.asMap().entries.map((entry) {
                final q = entry.value;
                final isAwarded = awardedQuoteId != null && q['id'] == awardedQuoteId;
                final rank = entry.key + 1;
                return _quoteRow(q, rank, isAwarded, currency, sealed: sealed);
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
              done: [
                'hod_approved',
                'budget_reserved',
                'approved',
                'rfq_issued',
                'evaluated',
                'awarded',
                'po_issued',
                'completed',
              ].contains(status) || rfqIssuedAt != null,
              isLast: false,
            ),
            _approvalStep(
              role: 'Finance (budget)',
              name: [
                'budget_reserved',
                'approved',
                'rfq_issued',
                'evaluated',
                'awarded',
                'po_issued',
                'completed',
              ].contains(status) || reservations.any((res) => budgetReservationStatusLabel(res) == 'Active')
                  ? 'Reserved'
                  : 'Pending',
              done: [
                'budget_reserved',
                'approved',
                'rfq_issued',
                'evaluated',
                'awarded',
                'po_issued',
                'completed',
              ].contains(status) ||
                  reservations.any((res) => budgetReservationStatusLabel(res) == 'Active'),
              isLast: false,
            ),
            _approvalStep(
              role: 'Procurement Officer',
              name: status == 'awarded' || status == 'po_issued' || status == 'completed'
                  ? (r['approver']?['name'] as String? ?? 'Approved')
                  : status == 'approved' || rfqIssuedAt != null
                      ? 'Approved'
                      : 'Pending',
              done: ['approved', 'awarded', 'po_issued', 'completed'].contains(status) ||
                  rfqIssuedAt != null,
              isLast: false,
            ),
            _approvalStep(
              role: 'Completed',
              name: status == 'completed' ? 'Done' : 'Awaiting',
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

  Widget _quoteRow(Map<String, dynamic> q, int rank, bool isAwarded, String currency, {bool sealed = false}) {
    final vendor = q['vendor'] as Map<String, dynamic>?;
    final vendorName = vendor?['name'] as String? ??
        q['vendor_name'] as String? ??
        'Vendor $rank';
    final amount = quoteAmountForDisplay(q, requestSealed: sealed);
    final rankLabel = isAwarded ? 'Awarded' : '$rank${rank == 1 ? 'st' : rank == 2 ? 'nd' : 'rd'}';
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
          Text(
            amount == null
                ? 'Sealed'
                : '$currency ${amount.toStringAsFixed(2)}',
            style: TextStyle(
              color: amount == null
                  ? AppColors.warning
                  : (isAwarded ? AppColors.success : AppColors.textSecondary),
              fontSize: 13,
              fontWeight: FontWeight.w700,
              fontStyle: amount == null ? FontStyle.italic : FontStyle.normal,
            ),
          ),
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
