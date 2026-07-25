import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../data/procurement_api_helpers.dart';

/// Create procurement requisition — aligned with web create (title/desc/category/method/budget).
class ProcurementRequisitionFormScreen extends ConsumerStatefulWidget {
  const ProcurementRequisitionFormScreen({super.key});

  @override
  ConsumerState<ProcurementRequisitionFormScreen> createState() =>
      _ProcurementRequisitionFormScreenState();
}

class _ProcurementRequisitionFormScreenState
    extends ConsumerState<ProcurementRequisitionFormScreen> {
  final _titleCtrl = TextEditingController();
  final _descriptionCtrl = TextEditingController();
  final _justificationCtrl = TextEditingController();
  final _estimatedCtrl = TextEditingController();

  String _category = 'goods';
  String _method = 'quotation';
  String? _budgetLine;
  DateTime? _requiredBy;
  bool _submitting = false;
  bool _budgetsLoading = true;
  List<_BudgetLineOption> _budgetLines = [];

  @override
  void initState() {
    super.initState();
    _loadBudgetLines();
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descriptionCtrl.dispose();
    _justificationCtrl.dispose();
    _estimatedCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadBudgetLines() async {
    try {
      final dio = ref.read(apiClientProvider).dio;
      final budgetsRes =
          await dio.get<Map<String, dynamic>>('/finance/budgets');
      final budgets = extractListData(budgetsRes.data);
      final lines = <_BudgetLineOption>[];

      for (final budget in budgets) {
        final rawLines = budget['lines'] as List<dynamic>? ?? const [];
        if (rawLines.isEmpty) {
          // Fetch detail when list payload omits nested lines.
          try {
            final detail = await dio
                .get<Map<String, dynamic>>('/finance/budgets/${budget['id']}');
            final data = extractObjectData(detail.data) ?? {};
            final nested = data['lines'] as List<dynamic>? ?? const [];
            for (final raw in nested) {
              if (raw is! Map) continue;
              final line = Map<String, dynamic>.from(raw);
              lines.add(_BudgetLineOption.from(budget, line));
            }
          } catch (_) {
            // Skip budgets we cannot expand.
          }
        } else {
          for (final raw in rawLines) {
            if (raw is! Map) continue;
            lines.add(
                _BudgetLineOption.from(budget, Map<String, dynamic>.from(raw)));
          }
        }
      }

      if (!mounted) return;
      setState(() {
        _budgetLines = lines;
        _budgetsLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _budgetsLoading = false);
    }
  }

  bool get _canSubmit =>
      _titleCtrl.text.trim().isNotEmpty &&
      _descriptionCtrl.text.trim().isNotEmpty;

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _requiredBy ?? now.add(const Duration(days: 14)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365 * 3)),
    );
    if (picked != null && mounted) {
      setState(() => _requiredBy = picked);
    }
  }

  Map<String, dynamic> _buildPayload() {
    final estimated = double.tryParse(_estimatedCtrl.text.trim());
    return {
      'title': _titleCtrl.text.trim(),
      'description': _descriptionCtrl.text.trim(),
      'category': _category,
      'procurement_method': _method,
      'currency': 'NAD',
      if (_budgetLine != null && _budgetLine!.isNotEmpty)
        'budget_line': _budgetLine,
      if (_justificationCtrl.text.trim().isNotEmpty)
        'justification': _justificationCtrl.text.trim(),
      if (_requiredBy != null)
        'required_by_date':
            '${_requiredBy!.year.toString().padLeft(4, '0')}-'
            '${_requiredBy!.month.toString().padLeft(2, '0')}-'
            '${_requiredBy!.day.toString().padLeft(2, '0')}',
      if (estimated != null && estimated >= 0) 'estimated_value': estimated,
    };
  }

  Future<void> _save({required bool submit}) async {
    if (!_canSubmit) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Title and description are required.'),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      final createRes = await dio.post<Map<String, dynamic>>(
        '/procurement/requests',
        data: _buildPayload(),
      );
      final created = extractObjectData(createRes.data);
      final id = created?['id'];

      if (submit && id != null) {
        await dio.post('/procurement/requests/$id/submit');
      }

      if (!mounted) return;
      setState(() => _submitting = false);

      if (id != null) {
        context.go('/procurement/detail?id=$id');
      } else {
        context.go('/procurement');
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(submit
              ? 'Procurement request submitted.'
              : 'Draft saved.'),
          backgroundColor: AppColors.success,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      final msg = e.toString().contains('422')
          ? 'Validation failed. Check required fields and try again.'
          : 'Failed to save procurement request.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: AppColors.danger),
      );
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
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: AppColors.textPrimary, size: 18),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/procurement');
            }
          },
        ),
        title: const Text(
          'New Requisition',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
        actions: [
          TextButton(
            onPressed: _submitting ? null : () => _save(submit: false),
            child: const Text(
              'Save Draft',
              style: TextStyle(
                color: AppColors.primaryDark,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
        children: [
          const Text(
            'Submit the requisition first. Quotes and tender actions happen after approval.',
            style: TextStyle(color: AppColors.textMuted, fontSize: 12),
          ),
          const SizedBox(height: 16),
          _SectionCard(
            title: 'Requisition Details',
            icon: Icons.description_outlined,
            iconColor: AppColors.primary,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _label('Title *'),
                _textField(_titleCtrl, 'e.g. Office furniture for chamber'),
                const SizedBox(height: 12),
                _label('Description *'),
                _textField(_descriptionCtrl,
                    'Describe what is being procured and why…',
                    maxLines: 3),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _label('Category *'),
                          _dropdown(
                            value: _category,
                            items: const ['goods', 'services', 'works'],
                            labels: const {
                              'goods': 'Goods',
                              'services': 'Services',
                              'works': 'Works',
                            },
                            onChanged: (v) =>
                                setState(() => _category = v ?? 'goods'),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _label('Method'),
                          _dropdown(
                            value: _method,
                            items: const [
                              'quotation',
                              'tender',
                              'direct',
                            ],
                            labels: const {
                              'quotation': 'RFQ',
                              'tender': 'Open Tender',
                              'direct': 'Direct',
                            },
                            onChanged: (v) =>
                                setState(() => _method = v ?? 'quotation'),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _label('Budget Line'),
                _budgetsLoading
                    ? const Padding(
                        padding: EdgeInsets.symmetric(vertical: 12),
                        child: Center(
                          child: SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                      )
                    : _dropdown(
                        value: _budgetLine,
                        hint: _budgetLines.isEmpty
                            ? 'No budget lines available'
                            : 'Select budget line…',
                        items: _budgetLines.map((l) => l.value).toList(),
                        labels: {
                          for (final l in _budgetLines) l.value: l.label,
                        },
                        onChanged: (v) => setState(() => _budgetLine = v),
                      ),
                if (_budgetLine != null) ...[
                  const SizedBox(height: 6),
                  Builder(builder: (_) {
                    final opt = _budgetLines
                        .where((l) => l.value == _budgetLine)
                        .firstOrNull;
                    if (opt == null || opt.available == null) {
                      return const SizedBox.shrink();
                    }
                    return Text(
                      'Available on line: NAD ${opt.available!.toStringAsFixed(2)}',
                      style: TextStyle(
                        color: opt.available! >= 0
                            ? AppColors.success
                            : AppColors.danger,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    );
                  }),
                ],
                const SizedBox(height: 12),
                _label('Required By'),
                InkWell(
                  onTap: _pickDate,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 14),
                    decoration: BoxDecoration(
                      color: AppColors.bgDark,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Text(
                      _requiredBy == null
                          ? 'Select date…'
                          : '${_requiredBy!.year}-'
                              '${_requiredBy!.month.toString().padLeft(2, '0')}-'
                              '${_requiredBy!.day.toString().padLeft(2, '0')}',
                      style: TextStyle(
                        color: _requiredBy == null
                            ? AppColors.textMuted
                            : AppColors.textPrimary,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                _label('Estimated Value (NAD)'),
                _textField(_estimatedCtrl, '0.00',
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true)),
                const SizedBox(height: 12),
                _label('Justification'),
                _textField(_justificationCtrl,
                    'Business need and expected benefit…',
                    maxLines: 3),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: SizedBox(
            height: 52,
            child: ElevatedButton(
              onPressed: _submitting ? null : () => _save(submit: true),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.bgDark,
                elevation: 0,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.bgDark,
                      ),
                    )
                  : const Text(
                      'Submit for Approval',
                      style:
                          TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                    ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(text,
            style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w600)),
      );

  Widget _textField(
    TextEditingController ctrl,
    String hint, {
    int maxLines = 1,
    TextInputType? keyboardType,
  }) {
    return TextField(
      controller: ctrl,
      maxLines: maxLines,
      keyboardType: keyboardType,
      onChanged: (_) => setState(() {}),
      style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
        filled: true,
        fillColor: AppColors.bgDark,
        contentPadding: const EdgeInsets.all(12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide:
              const BorderSide(color: AppColors.primary, width: 1.5),
        ),
      ),
    );
  }

  Widget _dropdown({
    required String? value,
    required List<String> items,
    required Map<String, String> labels,
    required ValueChanged<String?> onChanged,
    String? hint,
  }) {
    final effectiveValue =
        value != null && items.contains(value) ? value : null;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.bgDark,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: effectiveValue,
          hint: Text(hint ?? 'Select…',
              style:
                  const TextStyle(color: AppColors.textMuted, fontSize: 13)),
          isExpanded: true,
          dropdownColor: AppColors.bgSurface,
          icon: const Icon(Icons.keyboard_arrow_down_rounded,
              color: AppColors.textMuted),
          style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 13,
              fontWeight: FontWeight.w500),
          onChanged: onChanged,
          items: items
              .map((item) => DropdownMenuItem(
                    value: item,
                    child: Text(labels[item] ?? item,
                        overflow: TextOverflow.ellipsis),
                  ))
              .toList(),
        ),
      ),
    );
  }
}

class _BudgetLineOption {
  const _BudgetLineOption({
    required this.value,
    required this.label,
    this.available,
  });

  final String value;
  final String label;
  final double? available;

  factory _BudgetLineOption.from(
      Map<String, dynamic> budget, Map<String, dynamic> line) {
    final code = line['account_code'] as String?;
    final desc =
        (line['description'] as String?) ?? (line['category'] as String?) ?? '';
    final value = (code != null && code.isNotEmpty)
        ? code
        : '${budget['id']}-${line['id']}';
    final allocated = (line['amount_allocated'] as num?)?.toDouble();
    final spent = (line['amount_spent'] as num?)?.toDouble() ?? 0;
    final available =
        allocated == null ? null : (allocated - spent);
    final budgetName = budget['name'] as String? ?? 'Budget';
    final year = budget['year'];
    final label =
        '${code != null && code.isNotEmpty ? '$code — ' : ''}$desc ($budgetName${year != null ? ' $year' : ''})';
    return _BudgetLineOption(value: value, label: label, available: available);
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.icon,
    required this.iconColor,
    required this.child,
  });

  final String title;
  final IconData icon;
  final Color iconColor;
  final Widget child;

  @override
  Widget build(BuildContext context) {
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
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: iconColor, size: 16),
              ),
              const SizedBox(width: 10),
              Text(
                title,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }
}
