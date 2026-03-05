import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  ITEM MODEL
// ─────────────────────────────────────────────────────────────────────────────
class _LineItem {
  String description;
  int qty;
  double unitCost;

  _LineItem({
    this.description = '',
    this.qty = 1,
    this.unitCost = 0,
  });

  double get total => qty * unitCost;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SCREEN
// ─────────────────────────────────────────────────────────────────────────────
class ProcurementRequisitionFormScreen extends StatefulWidget {
  const ProcurementRequisitionFormScreen({super.key});

  @override
  State<ProcurementRequisitionFormScreen> createState() =>
      _ProcurementRequisitionFormScreenState();
}

class _ProcurementRequisitionFormScreenState
    extends State<ProcurementRequisitionFormScreen> {
  String? _selectedVendor;
  final List<_LineItem> _items = [
    _LineItem(
        description: 'MacBook Pro 16-inch M3 Max', qty: 2, unitCost: 3499),
  ];
  final _justificationCtrl = TextEditingController();

  final List<String> _vendors = [
    'TechSolutions Ltd',
    'Global Systems Inc',
    'Apex Networks',
    'Prime IT Supplies',
    'DataCore Africa',
  ];

  double get _estimatedTotal =>
      _items.fold(0, (sum, item) => sum + item.total);

  static const double _budgetRemaining = 55000;

  @override
  void dispose() {
    _justificationCtrl.dispose();
    super.dispose();
  }

  String _fmtCurrency(double v) {
    final parts = v.toStringAsFixed(2).split('.');
    final intPart = parts[0]
        .replaceAllMapped(
            RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
    return '\$$intPart.${parts[1]}';
  }

  void _addItem() {
    setState(() => _items.add(_LineItem()));
  }

  void _removeItem(int index) {
    if (_items.length > 1) setState(() => _items.removeAt(index));
  }

  @override
  Widget build(BuildContext context) {
    final remaining = _budgetRemaining - _estimatedTotal;

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
          'New Requisition',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () {},
            child: const Text(
              'Save Draft',
              style: TextStyle(
                color: AppColors.primary,
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
          // ── Step Indicator ────────────────────────────────────────────
          _StepIndicator(currentStep: 1, totalSteps: 4, label: 'Vendor Details'),
          const SizedBox(height: 20),

          // ── Vendor Details Section ────────────────────────────────────
          _SectionCard(
            title: 'Vendor Details',
            icon: Icons.storefront_outlined,
            iconColor: AppColors.primary,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Select Preferred Vendor',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 8),
                _AppDropdown<String>(
                  hint: 'Search approved vendors...',
                  value: _selectedVendor,
                  items: _vendors,
                  onChanged: (v) => setState(() => _selectedVendor = v),
                  itemLabel: (v) => v,
                ),
                const SizedBox(height: 12),
                // Warning banner
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                        color: AppColors.warning.withValues(alpha: 0.35)),
                  ),
                  child: Row(
                    children: const [
                      Icon(Icons.warning_amber_rounded,
                          color: AppColors.warning, size: 16),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Vendor contract expires in 45 days',
                          style: TextStyle(
                            color: AppColors.warning,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // ── Item Specification Section ────────────────────────────────
          _SectionCard(
            title: 'Item Specification',
            icon: Icons.inventory_2_outlined,
            iconColor: AppColors.info,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ..._items.asMap().entries.map((entry) {
                  final i = entry.key;
                  final item = entry.value;
                  return _ItemRow(
                    item: item,
                    index: i,
                    canRemove: _items.length > 1,
                    fmtCurrency: _fmtCurrency,
                    onChanged: () => setState(() {}),
                    onRemove: () => _removeItem(i),
                  );
                }),
                const SizedBox(height: 4),
                GestureDetector(
                  onTap: _addItem,
                  child: const Row(
                    children: [
                      Icon(Icons.add_circle_outline_rounded,
                          color: AppColors.primary, size: 16),
                      SizedBox(width: 6),
                      Text(
                        '+ Add Another Item',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // ── Business Justification ────────────────────────────────────
          _SectionCard(
            title: 'Business Justification',
            icon: Icons.description_outlined,
            iconColor: AppColors.gold,
            child: TextField(
              controller: _justificationCtrl,
              maxLines: 4,
              style: const TextStyle(
                  color: AppColors.textPrimary, fontSize: 13),
              decoration: InputDecoration(
                hintText:
                    'Describe the business need and expected benefit...',
                hintStyle: const TextStyle(
                    color: AppColors.textMuted, fontSize: 12),
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
                  borderSide: const BorderSide(
                      color: AppColors.primary, width: 1.5),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // ── Budget Code Bar ───────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.bgSurface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Text(
                      'IT-FW-2024',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.success.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                            color:
                                AppColors.success.withValues(alpha: 0.35)),
                      ),
                      child: const Text(
                        'Approved',
                        style: TextStyle(
                          color: AppColors.success,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Estimated Total',
                            style: TextStyle(
                                color: AppColors.textMuted, fontSize: 10)),
                        Text(
                          _fmtCurrency(_estimatedTotal),
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text('Budget Remaining',
                            style: TextStyle(
                                color: AppColors.textMuted, fontSize: 10)),
                        Text(
                          _fmtCurrency(remaining),
                          style: TextStyle(
                            color: remaining >= 0
                                ? AppColors.success
                                : AppColors.danger,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
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
              onPressed: () {},
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.bgDark,
                elevation: 0,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Proceed to Attachments',
                    style: TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                  SizedBox(width: 8),
                  Icon(Icons.arrow_forward_rounded, size: 18),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  STEP INDICATOR
// ─────────────────────────────────────────────────────────────────────────────
class _StepIndicator extends StatelessWidget {
  final int currentStep;
  final int totalSteps;
  final String label;

  const _StepIndicator({
    required this.currentStep,
    required this.totalSteps,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Step $currentStep of $totalSteps: $label',
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              '${((currentStep / totalSteps) * 100).toInt()}%',
              style: const TextStyle(
                color: AppColors.primary,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: currentStep / totalSteps,
            minHeight: 5,
            backgroundColor: AppColors.border,
            valueColor:
                const AlwaysStoppedAnimation<Color>(AppColors.primary),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION CARD
// ─────────────────────────────────────────────────────────────────────────────
class _SectionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color iconColor;
  final Widget child;

  const _SectionCard({
    required this.title,
    required this.icon,
    required this.iconColor,
    required this.child,
  });

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

// ─────────────────────────────────────────────────────────────────────────────
//  DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────
class _AppDropdown<T> extends StatelessWidget {
  final String hint;
  final T? value;
  final List<T> items;
  final ValueChanged<T?> onChanged;
  final String Function(T) itemLabel;

  const _AppDropdown({
    required this.hint,
    required this.value,
    required this.items,
    required this.onChanged,
    required this.itemLabel,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.bgDark,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          hint: Text(hint,
              style: const TextStyle(
                  color: AppColors.textMuted, fontSize: 13)),
          dropdownColor: AppColors.bgSurface,
          icon: const Icon(Icons.keyboard_arrow_down_rounded,
              color: AppColors.textMuted),
          isExpanded: true,
          style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 13,
              fontWeight: FontWeight.w500),
          onChanged: onChanged,
          items: items
              .map((item) => DropdownMenuItem<T>(
                    value: item,
                    child: Text(itemLabel(item)),
                  ))
              .toList(),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  ITEM ROW
// ─────────────────────────────────────────────────────────────────────────────
class _ItemRow extends StatefulWidget {
  final _LineItem item;
  final int index;
  final bool canRemove;
  final String Function(double) fmtCurrency;
  final VoidCallback onChanged;
  final VoidCallback onRemove;

  const _ItemRow({
    required this.item,
    required this.index,
    required this.canRemove,
    required this.fmtCurrency,
    required this.onChanged,
    required this.onRemove,
  });

  @override
  State<_ItemRow> createState() => _ItemRowState();
}

class _ItemRowState extends State<_ItemRow> {
  late final TextEditingController _descCtrl;
  late final TextEditingController _qtyCtrl;
  late final TextEditingController _costCtrl;

  @override
  void initState() {
    super.initState();
    _descCtrl = TextEditingController(text: widget.item.description);
    _qtyCtrl = TextEditingController(
        text: widget.item.qty > 0 ? widget.item.qty.toString() : '');
    _costCtrl = TextEditingController(
        text: widget.item.unitCost > 0
            ? widget.item.unitCost.toStringAsFixed(2)
            : '');
  }

  @override
  void dispose() {
    _descCtrl.dispose();
    _qtyCtrl.dispose();
    _costCtrl.dispose();
    super.dispose();
  }

  InputDecoration _inputDeco(String hint) => InputDecoration(
        hintText: hint,
        hintStyle:
            const TextStyle(color: AppColors.textMuted, fontSize: 12),
        filled: true,
        fillColor: AppColors.bgDark,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide:
              const BorderSide(color: AppColors.primary, width: 1.5),
        ),
      );

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.bgDark,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Center(
                  child: Text(
                    '${widget.index + 1}',
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'Item Description',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const Spacer(),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.warning.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'Not in Inventory',
                  style: TextStyle(
                    color: AppColors.warning,
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (widget.canRemove) ...[
                const SizedBox(width: 6),
                GestureDetector(
                  onTap: widget.onRemove,
                  child: const Icon(Icons.remove_circle_outline_rounded,
                      color: AppColors.danger, size: 18),
                ),
              ],
            ],
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _descCtrl,
            onChanged: (v) {
              widget.item.description = v;
              widget.onChanged();
            },
            style: const TextStyle(
                color: AppColors.textPrimary, fontSize: 13),
            decoration: _inputDeco('e.g. MacBook Pro 16-inch M3 Max'),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Qty',
                        style: TextStyle(
                            color: AppColors.textMuted, fontSize: 10)),
                    const SizedBox(height: 4),
                    TextField(
                      controller: _qtyCtrl,
                      keyboardType: TextInputType.number,
                      onChanged: (v) {
                        widget.item.qty = int.tryParse(v) ?? 0;
                        widget.onChanged();
                      },
                      style: const TextStyle(
                          color: AppColors.textPrimary, fontSize: 13),
                      decoration: _inputDeco('1'),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Est. Unit Cost',
                        style: TextStyle(
                            color: AppColors.textMuted, fontSize: 10)),
                    const SizedBox(height: 4),
                    TextField(
                      controller: _costCtrl,
                      keyboardType: const TextInputType.numberWithOptions(
                          decimal: true),
                      onChanged: (v) {
                        widget.item.unitCost = double.tryParse(v) ?? 0;
                        widget.onChanged();
                      },
                      style: const TextStyle(
                          color: AppColors.textPrimary, fontSize: 13),
                      decoration: _inputDeco('0.00'),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              const Text(
                'Total: ',
                style: TextStyle(
                    color: AppColors.textMuted, fontSize: 11),
              ),
              Text(
                widget.fmtCurrency(widget.item.total),
                style: const TextStyle(
                  color: AppColors.primary,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
