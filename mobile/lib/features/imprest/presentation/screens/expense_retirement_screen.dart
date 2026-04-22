import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/router/safe_back.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/utils/date_format.dart';

class _LineItem {
  String description;
  String amount;
  _LineItem({this.description = '', this.amount = ''});
}

class ExpenseRetirementScreen extends ConsumerStatefulWidget {
  const ExpenseRetirementScreen({super.key, this.requestId});

  final String? requestId;

  @override
  ConsumerState<ExpenseRetirementScreen> createState() =>
      _ExpenseRetirementScreenState();
}

class _ExpenseRetirementScreenState
    extends ConsumerState<ExpenseRetirementScreen> {
  bool _loadingImprest = true;
  bool _submitting = false;
  String? _loadError;
  Map<String, dynamic>? _imprest;

  final List<_LineItem> _items = [_LineItem()];
  final _notesController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadImprest();
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadImprest() async {
    final id = widget.requestId;
    if (id == null || id.isEmpty) {
      setState(() {
        _loadingImprest = false;
        _loadError = 'Missing imprest ID.';
      });
      return;
    }
    try {
      final res = await ref
          .read(apiClientProvider)
          .dio
          .get<Map<String, dynamic>>('/imprest/requests/$id');
      if (!mounted) return;
      setState(() {
        _imprest = res.data == null
            ? <String, dynamic>{}
            : Map<String, dynamic>.from(res.data as Map);
        _loadingImprest = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadError = 'Failed to load imprest request.';
        _loadingImprest = false;
      });
    }
  }

  double get _total => _items.fold(0.0, (sum, item) {
        return sum + (double.tryParse(item.amount) ?? 0.0);
      });

  double get _advance {
    final r = _imprest;
    if (r == null) return 0.0;
    final approved = double.tryParse(r['amount_approved']?.toString() ?? '');
    final requested = double.tryParse(r['amount_requested']?.toString() ?? '');
    return approved ?? requested ?? 0.0;
  }

  double get _variance => _advance - _total;

  String _currency(double v) => 'N\$${v.toStringAsFixed(2)}';

  Future<void> _submit() async {
    final id = widget.requestId;
    if (id == null) return;

    final validItems = _items
        .where((i) =>
            i.description.trim().isNotEmpty &&
            (double.tryParse(i.amount) ?? 0) > 0)
        .toList();

    if (validItems.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Add at least one expense item with an amount.'),
        backgroundColor: AppColors.warning,
      ));
      return;
    }

    setState(() => _submitting = true);
    try {
      await ref.read(apiClientProvider).dio.post(
        '/imprest/requests/$id/retire',
        data: {
          'items': validItems
              .map((i) => {
                    'description': i.description.trim(),
                    'amount': double.tryParse(i.amount) ?? 0,
                  })
              .toList(),
          if (_notesController.text.trim().isNotEmpty)
            'notes': _notesController.text.trim(),
        },
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Retirement submitted for approval.'),
        backgroundColor: AppColors.success,
      ));
      context.safePopOrGoHome();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Submission failed. Please try again.'),
        backgroundColor: AppColors.danger,
      ));
    } finally {
      if (mounted) setState(() => _submitting = false);
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
          onPressed: () => context.safePopOrGoHome(),
        ),
        title: const Text('Expense Retirement',
            style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w700)),
      ),
      body: _loadingImprest
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : _loadError != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.error_outline,
                          color: AppColors.danger, size: 40),
                      const SizedBox(height: 12),
                      Text(_loadError!,
                          style: const TextStyle(
                              color: AppColors.textMuted, fontSize: 14),
                          textAlign: TextAlign.center),
                      const SizedBox(height: 20),
                      ElevatedButton(
                        onPressed: _loadImprest,
                        style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary),
                        child: const Text('Retry'),
                      ),
                    ]),
                  ),
                )
              : _buildBody(),
    );
  }

  Widget _buildBody() {
    final r = _imprest ?? {};
    final purpose = r['purpose']?.toString() ?? '—';
    final ref = r['reference_number']?.toString() ?? '';
    final deadline = AppDateFormatter.short(
        r['expected_liquidation_date']?.toString());

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Retire Imprest',
            style: TextStyle(
                color: AppColors.primary,
                fontSize: 11,
                fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        Text(purpose,
            style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 20,
                fontWeight: FontWeight.w800)),
        if (ref.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text('$ref  ·  Due $deadline',
                style: const TextStyle(
                    color: AppColors.textMuted, fontSize: 11)),
          ),
        const SizedBox(height: 16),

        // Summary bar
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
              color: AppColors.bgSurface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border)),
          child: Row(children: [
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  const Text('Advance Issued',
                      style: TextStyle(
                          color: AppColors.textMuted, fontSize: 10)),
                  Text(_currency(_advance),
                      style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 16,
                          fontWeight: FontWeight.w800)),
                ])),
            Container(width: 1, height: 36, color: AppColors.border),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                  const Text('Total Claimed',
                      style: TextStyle(
                          color: AppColors.textMuted, fontSize: 10)),
                  Text(_currency(_total),
                      style: const TextStyle(
                          color: AppColors.primary,
                          fontSize: 16,
                          fontWeight: FontWeight.w800)),
                ])),
          ]),
        ),
        const SizedBox(height: 20),

        // Line items
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          const Text('Expense Items',
              style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.w700)),
          GestureDetector(
            onTap: () => setState(() => _items.add(_LineItem())),
            child: const Text('+ Add Item',
                style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 12,
                    fontWeight: FontWeight.w600)),
          ),
        ]),
        const SizedBox(height: 10),
        ..._items.asMap().entries.map((entry) {
          final idx = entry.key;
          final item = entry.value;
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border)),
            child: Column(children: [
              Row(children: [
                Expanded(
                  child: TextField(
                    style: const TextStyle(
                        color: AppColors.textPrimary, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Description',
                      hintStyle: const TextStyle(
                          color: AppColors.textMuted, fontSize: 13),
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                    onChanged: (v) => setState(() => item.description = v),
                  ),
                ),
                if (_items.length > 1)
                  GestureDetector(
                    onTap: () => setState(() => _items.removeAt(idx)),
                    child: const Icon(Icons.close,
                        color: AppColors.textMuted, size: 16),
                  ),
              ]),
              const Divider(color: AppColors.border, height: 16),
              Row(children: [
                const Text('N\$',
                    style: TextStyle(
                        color: AppColors.textMuted, fontSize: 13)),
                const SizedBox(width: 4),
                Expanded(
                  child: TextField(
                    keyboardType: const TextInputType.numberWithOptions(
                        decimal: true),
                    style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.w700),
                    decoration: const InputDecoration(
                      hintText: '0.00',
                      hintStyle: TextStyle(
                          color: AppColors.textMuted, fontSize: 15),
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                    onChanged: (v) => setState(() => item.amount = v),
                  ),
                ),
              ]),
            ]),
          );
        }),

        const SizedBox(height: 8),

        // Notes
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
              color: AppColors.bgSurface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border)),
          child: TextField(
            controller: _notesController,
            maxLines: 3,
            style: const TextStyle(
                color: AppColors.textPrimary, fontSize: 13),
            decoration: const InputDecoration(
              hintText: 'Additional notes (optional)',
              hintStyle:
                  TextStyle(color: AppColors.textMuted, fontSize: 13),
              border: InputBorder.none,
              isDense: true,
              contentPadding: EdgeInsets.zero,
            ),
          ),
        ),

        const SizedBox(height: 16),

        // Variance
        if (_total > 0) ...[
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: (_variance >= 0 ? AppColors.success : AppColors.danger)
                  .withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                  color: (_variance >= 0
                          ? AppColors.success
                          : AppColors.danger)
                      .withValues(alpha: 0.3)),
            ),
            child: Row(children: [
              Icon(
                  _variance >= 0
                      ? Icons.arrow_upward
                      : Icons.arrow_downward,
                  color: _variance >= 0
                      ? AppColors.success
                      : AppColors.danger,
                  size: 18),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(
                    '${_currency(_variance.abs())} ${_variance >= 0 ? 'refund due' : 'overspent'}',
                    style: TextStyle(
                        color: _variance >= 0
                            ? AppColors.success
                            : AppColors.danger,
                        fontSize: 13,
                        fontWeight: FontWeight.w700),
                  ),
                  Text(
                    _variance >= 0
                        ? 'You spent less than the advance issued.'
                        : 'Amount exceeds the advance issued.',
                    style: const TextStyle(
                        color: AppColors.textSecondary, fontSize: 11),
                  ),
                ]),
              ),
            ]),
          ),
          const SizedBox(height: 16),
        ],

        SizedBox(
          width: double.infinity,
          height: 50,
          child: ElevatedButton(
            onPressed: _submitting ? null : _submit,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.bgDark,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            child: _submitting
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: AppColors.bgDark))
                : const Text('Submit for Approval',
                    style: TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 15)),
          ),
        ),
        const SizedBox(height: 32),
      ],
    );
  }
}
