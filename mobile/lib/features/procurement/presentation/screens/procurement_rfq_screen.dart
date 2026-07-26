import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/utils/date_format.dart';
import '../../data/procurement_api_helpers.dart';

/// View / issue RFQ for a procurement request (API-backed only).
class ProcurementRfqScreen extends ConsumerStatefulWidget {
  const ProcurementRfqScreen({super.key, required this.requestId});
  final int requestId;

  @override
  ConsumerState<ProcurementRfqScreen> createState() =>
      _ProcurementRfqScreenState();
}

class _ProcurementRfqScreenState extends ConsumerState<ProcurementRfqScreen> {
  bool _loading = true;
  bool _issuing = false;
  String? _error;
  Map<String, dynamic>? _request;
  List<Map<String, dynamic>> _quotes = [];
  List<Map<String, dynamic>> _categories = [];
  final Set<int> _selectedCategoryIds = {};
  final _deadlineCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _deadlineCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  bool get _canIssue {
    final session = ref.read(authSessionControllerProvider).state;
    return canIssueProcurementRfq(
      permissions: session.permissions,
      roles: session.roles,
    );
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final reqRes = await dio.get<Map<String, dynamic>>(
        '/procurement/requests/${widget.requestId}',
      );
      final request = extractObjectData(reqRes.data) ??
          Map<String, dynamic>.from(reqRes.data ?? {});

      List<Map<String, dynamic>> quotes = [];
      try {
        final quotesRes = await dio.get<Map<String, dynamic>>(
          '/procurement/requests/${widget.requestId}/quotes',
        );
        quotes = extractListData(quotesRes.data);
      } catch (_) {
        // Fall back to embedded quotes; client sealed-guard still applies.
        quotes = (request['quotes'] as List?)
                ?.whereType<Map>()
                .map((e) => Map<String, dynamic>.from(e))
                .toList() ??
            [];
      }

      List<Map<String, dynamic>> categories = [];
      if (_canIssue) {
        try {
          final catRes = await dio.get<Map<String, dynamic>>(
            '/procurement/supplier-categories',
          );
          categories = extractListData(catRes.data);
        } catch (_) {
          categories = [];
        }
      }

      if (!mounted) return;
      final existingCats = (request['supplier_categories'] as List? ??
              request['supplierCategories'] as List? ??
              [])
          .whereType<Map>()
          .map((e) => e['id'])
          .whereType<num>()
          .map((e) => e.toInt());
      setState(() {
        _request = request;
        _quotes = quotes;
        _categories = categories;
        _selectedCategoryIds
          ..clear()
          ..addAll(existingCats);
        _deadlineCtrl.text =
            (request['rfq_deadline'] as String?)?.split('T').first ?? '';
        _notesCtrl.text = request['rfq_notes'] as String? ?? '';
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().contains('403')
            ? 'You do not have access to this RFQ.'
            : e.toString().contains('404')
                ? 'Request not found.'
                : 'Failed to load RFQ.';
        _loading = false;
      });
    }
  }

  Future<void> _pickDeadline() async {
    final now = DateTime.now();
    final initial = DateTime.tryParse(_deadlineCtrl.text) ??
        now.add(const Duration(days: 7));
    final picked = await showDatePicker(
      context: context,
      initialDate: initial.isBefore(now) ? now : initial,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (picked == null || !mounted) return;
    setState(() {
      _deadlineCtrl.text =
          '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
    });
  }

  Future<void> _issueRfq() async {
    if (!_canIssue) return;
    if (_selectedCategoryIds.isEmpty || _selectedCategoryIds.length > 3) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Select between 1 and 3 supplier categories.'),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }
    setState(() => _issuing = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.post(
        '/procurement/requests/${widget.requestId}/issue-rfq',
        data: {
          'category_ids': _selectedCategoryIds.toList(),
          if (_deadlineCtrl.text.isNotEmpty) 'rfq_deadline': _deadlineCtrl.text,
          if (_notesCtrl.text.trim().isNotEmpty)
            'rfq_notes': _notesCtrl.text.trim(),
        },
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('RFQ issued.'),
          backgroundColor: AppColors.success,
        ),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      final msg = e.toString().contains('422')
          ? 'Cannot issue RFQ (budget gate, status, or categories).'
          : e.toString().contains('403')
              ? 'You are not allowed to issue RFQs.'
              : 'Failed to issue RFQ.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: AppColors.danger),
      );
    } finally {
      if (mounted) setState(() => _issuing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new,
              size: 18, color: AppColors.textPrimary),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/procurement');
            }
          },
        ),
        title: const Text('RFQ',
            style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w800)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
            onPressed: _loading ? null : _load,
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null || _request == null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Text(_error ?? 'RFQ not found.',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                color: AppColors.textSecondary)),
                      ),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: _load,
                        style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary),
                        child: const Text('Retry',
                            style: TextStyle(color: Colors.white)),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: _load,
                  child: _buildBody(_request!),
                ),
    );
  }

  Widget _buildBody(Map<String, dynamic> r) {
    final sealed = isRequestFinanciallySealed(r);
    final issuedAt = r['rfq_issued_at'] as String?;
    final status = (r['status'] as String? ?? '').toLowerCase();
    final currency = r['currency'] as String? ?? 'NAD';
    final invitations = (r['rfq_invitations'] as List? ??
            r['rfqInvitations'] as List? ??
            [])
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    final canIssueNow = _canIssue &&
        (status == 'approved' || issuedAt != null);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(r['reference_number'] as String? ?? '',
                  style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 12,
                      fontWeight: FontWeight.w600)),
              const SizedBox(height: 6),
              Text(r['title'] as String? ?? '',
                  style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 17,
                      fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              Text(
                issuedAt != null
                    ? 'RFQ issued ${AppDateFormatter.short(issuedAt)}'
                    : 'RFQ not yet issued',
                style: TextStyle(
                  color: issuedAt != null
                      ? AppColors.success
                      : AppColors.warning,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (r['rfq_deadline'] != null) ...[
                const SizedBox(height: 4),
                Text(
                  'Deadline: ${AppDateFormatter.short(r['rfq_deadline'] as String)}',
                  style: const TextStyle(
                      color: AppColors.textMuted, fontSize: 12),
                ),
              ],
              if (r['rfq_notes'] != null &&
                  (r['rfq_notes'] as String).isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(r['rfq_notes'] as String,
                    style: const TextStyle(
                        color: AppColors.textSecondary, fontSize: 13)),
              ],
              if (sealed) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                        color: AppColors.warning.withValues(alpha: 0.35)),
                  ),
                  child: const Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.lock_outline,
                          color: AppColors.warning, size: 16),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Competitor quote amounts stay hidden while sealed.',
                          style: TextStyle(
                              color: AppColors.warning,
                              fontSize: 12,
                              fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        if (invitations.isNotEmpty) ...[
          const SizedBox(height: 12),
          _sectionCard(
            title: 'Invitations (${invitations.length})',
            child: Column(
              children: invitations.map((inv) {
                final name = inv['invited_name'] as String? ??
                    inv['vendor']?['name'] as String? ??
                    'Supplier';
                final email = inv['invited_email'] as String? ?? '';
                final invStatus = inv['status'] as String? ?? '';
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(name,
                                style: const TextStyle(
                                    color: AppColors.textPrimary,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600)),
                            if (email.isNotEmpty)
                              Text(email,
                                  style: const TextStyle(
                                      color: AppColors.textMuted,
                                      fontSize: 11)),
                          ],
                        ),
                      ),
                      Text(invStatus.toUpperCase(),
                          style: const TextStyle(
                              color: AppColors.textMuted,
                              fontSize: 10,
                              fontWeight: FontWeight.w700)),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
        if (_quotes.isNotEmpty) ...[
          const SizedBox(height: 12),
          _sectionCard(
            title: 'Quotes (${_quotes.length})',
            child: Column(
              children: _quotes.map((q) {
                final vendor = q['vendor'] as Map<String, dynamic>?;
                final name = vendor?['name'] as String? ??
                    q['vendor_name'] as String? ??
                    'Vendor';
                final amount = quoteAmountForDisplay(q, requestSealed: sealed);
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(name,
                            style: const TextStyle(
                                color: AppColors.textPrimary, fontSize: 13)),
                      ),
                      Text(
                        amount == null
                            ? 'Sealed'
                            : '$currency ${amount.toStringAsFixed(2)}',
                        style: TextStyle(
                          color: amount == null
                              ? AppColors.warning
                              : AppColors.textPrimary,
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                          fontStyle:
                              amount == null ? FontStyle.italic : FontStyle.normal,
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
        if (canIssueNow) ...[
          const SizedBox(height: 12),
          _sectionCard(
            title: issuedAt != null ? 'Update RFQ' : 'Issue RFQ',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Select 1ΓÇô3 supplier categories. Finance budget must already be confirmed.',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                ),
                const SizedBox(height: 10),
                if (_categories.isEmpty)
                  const Text(
                    'No supplier categories available.',
                    style: TextStyle(color: AppColors.warning, fontSize: 12),
                  )
                else
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _categories.map((c) {
                      final id = (c['id'] as num?)?.toInt();
                      if (id == null) return const SizedBox.shrink();
                      final selected = _selectedCategoryIds.contains(id);
                      final name = c['name'] as String? ?? 'Category $id';
                      return FilterChip(
                        label: Text(name,
                            style: TextStyle(
                              color: selected
                                  ? AppColors.primaryDark
                                  : AppColors.textSecondary,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            )),
                        selected: selected,
                        onSelected: (v) {
                          setState(() {
                            if (v) {
                              if (_selectedCategoryIds.length >= 3) return;
                              _selectedCategoryIds.add(id);
                            } else {
                              _selectedCategoryIds.remove(id);
                            }
                          });
                        },
                        selectedColor:
                            AppColors.primary.withValues(alpha: 0.2),
                        backgroundColor: AppColors.bgCard,
                        side: BorderSide(
                          color: selected
                              ? AppColors.primary
                              : AppColors.border,
                        ),
                      );
                    }).toList(),
                  ),
                const SizedBox(height: 12),
                TextField(
                  controller: _deadlineCtrl,
                  readOnly: true,
                  onTap: _pickDeadline,
                  style: const TextStyle(
                      color: AppColors.textPrimary, fontSize: 13),
                  decoration: InputDecoration(
                    labelText: 'RFQ deadline',
                    labelStyle: const TextStyle(color: AppColors.textMuted),
                    suffixIcon: const Icon(Icons.calendar_today,
                        size: 16, color: AppColors.textMuted),
                    filled: true,
                    fillColor: AppColors.bgDark,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _notesCtrl,
                  maxLines: 3,
                  style: const TextStyle(
                      color: AppColors.textPrimary, fontSize: 13),
                  decoration: InputDecoration(
                    labelText: 'Notes (optional)',
                    labelStyle: const TextStyle(color: AppColors.textMuted),
                    filled: true,
                    fillColor: AppColors.bgDark,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _issuing ? null : _issueRfq,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _issuing
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : Text(
                            issuedAt != null ? 'Update RFQ' : 'Issue RFQ',
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ] else if (!_canIssue && issuedAt == null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.bgSurface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: const Text(
              'RFQ issue is limited to procurement officers with create/approve permission. You can view issued RFQ details here when available.',
              style: TextStyle(color: AppColors.textMuted, fontSize: 12),
            ),
          ),
        ] else if (status != 'approved' && issuedAt == null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.warning.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                  color: AppColors.warning.withValues(alpha: 0.3)),
            ),
            child: Text(
              status == 'budget_reserved'
                  ? 'Budget reserved. Procurement must approve this request before an RFQ can be issued.'
                  : 'Request must be approved (with budget confirmation) before issuing an RFQ.',
              style: const TextStyle(
                  color: AppColors.warning,
                  fontSize: 12,
                  fontWeight: FontWeight.w600),
            ),
          ),
        ],
        const SizedBox(height: 12),
        TextButton(
          onPressed: () =>
              context.push('/procurement/detail?id=${widget.requestId}'),
          child: const Text('Open full request',
              style: TextStyle(color: AppColors.primary)),
        ),
        const SizedBox(height: 32),
      ],
    );
  }

  Widget _sectionCard({required String title, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }
}