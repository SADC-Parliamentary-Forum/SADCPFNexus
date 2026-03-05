import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  DATA MODELS
// ─────────────────────────────────────────────────────────────────────────────
class _ExpenseItem {
  String description;
  double amount;
  String note;

  _ExpenseItem({
    this.description = '',
    this.amount = 0,
    this.note = '',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  SCREEN
// ─────────────────────────────────────────────────────────────────────────────
class ImprestRequisitionFormScreen extends StatefulWidget {
  const ImprestRequisitionFormScreen({super.key});

  @override
  State<ImprestRequisitionFormScreen> createState() =>
      _ImprestRequisitionFormScreenState();
}

class _ImprestRequisitionFormScreenState
    extends State<ImprestRequisitionFormScreen> {
  int _currentStep = 1;
  static const int _totalSteps = 3;

  String? _selectedMission;
  final List<_ExpenseItem> _items = [
    _ExpenseItem(
        description: 'Accommodation',
        amount: 1200.00,
        note: '4 Nights @ Hilton'),
    _ExpenseItem(
        description: 'Transport & Incidentals',
        amount: 450.00,
        note: 'Airport transfers'),
  ];

  final List<String> _missions = [
    'SADC-PF-2023-089: Election Obs...',
    'SADC-PF-2023-112: Budget Review',
    'SADC-PF-2023-145: HR Conference',
    'SADC-PF-2024-001: Board Meeting',
  ];

  double get _total => _items.fold(0, (s, i) => s + i.amount);

  void _addItem() {
    setState(() => _items.add(_ExpenseItem()));
  }

  String _fmt(double v) {
    return '\$${v.toStringAsFixed(2)}';
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
          'Imprest Requisition',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).maybePop(),
            child: const Text(
              'Cancel',
              style: TextStyle(
                color: AppColors.danger,
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
          _MultiStepIndicator(
              currentStep: _currentStep, totalSteps: _totalSteps),
          const SizedBox(height: 16),

          // ── Compliance Banner ─────────────────────────────────────────
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                  color: AppColors.success.withValues(alpha: 0.35)),
            ),
            child: Row(
              children: const [
                Icon(Icons.check_circle_outline_rounded,
                    color: AppColors.success, size: 16),
                SizedBox(width: 8),
                Text(
                  'Compliance Check Passed',
                  style: TextStyle(
                    color: AppColors.success,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── Mission Details Section ───────────────────────────────────
          _SectionCard(
            title: 'Mission Details',
            icon: Icons.flight_takeoff_rounded,
            iconColor: AppColors.info,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Link this requisition to an approved mission/PIF',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 10),
                // Mission dropdown
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.bgDark,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _selectedMission,
                      hint: const Text(
                        'Select Approved Mission / PIF',
                        style: TextStyle(
                            color: AppColors.textMuted, fontSize: 13),
                      ),
                      dropdownColor: AppColors.bgSurface,
                      icon: const Icon(Icons.keyboard_arrow_down_rounded,
                          color: AppColors.textMuted),
                      isExpanded: true,
                      style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.w500),
                      onChanged: (v) =>
                          setState(() => _selectedMission = v),
                      items: _missions
                          .map((m) => DropdownMenuItem(
                                value: m,
                                child: Text(m),
                              ))
                          .toList(),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                // Budget line badge
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: AppColors.success.withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                            color:
                                AppColors.success.withValues(alpha: 0.35)),
                      ),
                      child: const Text(
                        'BUDGET LINE: 2064.TRAVEL.INT  Active',
                        style: TextStyle(
                          color: AppColors.success,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                // Balance
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.bgDark,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            'Available Balance',
                            style: TextStyle(
                                color: AppColors.textMuted, fontSize: 10),
                          ),
                          SizedBox(height: 2),
                          Text(
                            '\$12,450.00',
                            style: TextStyle(
                              color: AppColors.primary,
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: const [
                          Text(
                            'From Total',
                            style: TextStyle(
                                color: AppColors.textMuted, fontSize: 10),
                          ),
                          SizedBox(height: 2),
                          Text(
                            '\$30,000',
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // ── Requisition Items ─────────────────────────────────────────
          _SectionCard(
            title: 'Requisition Items',
            icon: Icons.receipt_long_rounded,
            iconColor: AppColors.gold,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Breakdown of estimated expenses',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 12),
                ..._items.asMap().entries.map((e) => _ExpenseRow(
                      item: e.value,
                      fmt: _fmt,
                      onChanged: () => setState(() {}),
                    )),
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

          // ── Total Summary ─────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.bgSurface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Total Requested',
                      style: TextStyle(
                          color: AppColors.textMuted, fontSize: 11),
                    ),
                    Text(
                      _fmt(_total),
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: const [
                    Text(
                      'USD Equivalent',
                      style: TextStyle(
                          color: AppColors.textMuted, fontSize: 11),
                    ),
                    Text(
                      'Rate 17.6',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
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
                    'Continue to Approvers',
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
//  MULTI-STEP INDICATOR
// ─────────────────────────────────────────────────────────────────────────────
class _MultiStepIndicator extends StatelessWidget {
  final int currentStep;
  final int totalSteps;

  const _MultiStepIndicator(
      {required this.currentStep, required this.totalSteps});

  @override
  Widget build(BuildContext context) {
    final labels = ['Mission Details', 'Items', 'Review'];
    return Row(
      children: List.generate(totalSteps, (i) {
        final step = i + 1;
        final isDone = step < currentStep;
        final isActive = step == currentStep;
        final color = isActive || isDone
            ? AppColors.primary
            : AppColors.textMuted;

        return Expanded(
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Row(
                      children: [
                        if (i > 0)
                          Expanded(
                            child: Container(
                              height: 2,
                              color: isDone
                                  ? AppColors.primary
                                  : AppColors.border,
                            ),
                          ),
                        Container(
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            color: isActive || isDone
                                ? AppColors.primary.withValues(alpha: 0.15)
                                : AppColors.bgSurface,
                            shape: BoxShape.circle,
                            border: Border.all(
                                color: color,
                                width: isActive ? 2 : 1),
                          ),
                          child: Center(
                            child: isDone
                                ? const Icon(Icons.check_rounded,
                                    color: AppColors.primary, size: 12)
                                : Text(
                                    '$step',
                                    style: TextStyle(
                                      color: color,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                          ),
                        ),
                        if (i < totalSteps - 1)
                          Expanded(
                            child: Container(
                              height: 2,
                              color: isActive || isDone
                                  ? AppColors.primary
                                      .withValues(alpha: 0.3)
                                  : AppColors.border,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      labels[i],
                      style: TextStyle(
                        color: isActive
                            ? AppColors.primary
                            : AppColors.textMuted,
                        fontSize: 9,
                        fontWeight: isActive
                            ? FontWeight.w700
                            : FontWeight.w400,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      }),
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
//  EXPENSE ROW
// ─────────────────────────────────────────────────────────────────────────────
class _ExpenseRow extends StatefulWidget {
  final _ExpenseItem item;
  final String Function(double) fmt;
  final VoidCallback onChanged;

  const _ExpenseRow({
    required this.item,
    required this.fmt,
    required this.onChanged,
  });

  @override
  State<_ExpenseRow> createState() => _ExpenseRowState();
}

class _ExpenseRowState extends State<_ExpenseRow> {
  late final TextEditingController _descCtrl;
  late final TextEditingController _amtCtrl;
  late final TextEditingController _noteCtrl;

  @override
  void initState() {
    super.initState();
    _descCtrl = TextEditingController(text: widget.item.description);
    _amtCtrl = TextEditingController(
        text: widget.item.amount > 0
            ? widget.item.amount.toStringAsFixed(2)
            : '');
    _noteCtrl = TextEditingController(text: widget.item.note);
  }

  @override
  void dispose() {
    _descCtrl.dispose();
    _amtCtrl.dispose();
    _noteCtrl.dispose();
    super.dispose();
  }

  InputDecoration _deco(String hint) => InputDecoration(
        hintText: hint,
        hintStyle:
            const TextStyle(color: AppColors.textMuted, fontSize: 12),
        filled: true,
        fillColor: AppColors.bgDark,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
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
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.bgDark,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                flex: 2,
                child: TextField(
                  controller: _descCtrl,
                  onChanged: (v) {
                    widget.item.description = v;
                  },
                  style: const TextStyle(
                      color: AppColors.textPrimary, fontSize: 13),
                  decoration: _deco('Item description'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _amtCtrl,
                  keyboardType: const TextInputType.numberWithOptions(
                      decimal: true),
                  onChanged: (v) {
                    widget.item.amount = double.tryParse(v) ?? 0;
                    widget.onChanged();
                  },
                  style: const TextStyle(
                      color: AppColors.textPrimary, fontSize: 13),
                  decoration: _deco('0.00'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.notes_rounded,
                  color: AppColors.textMuted, size: 14),
              const SizedBox(width: 6),
              Expanded(
                child: TextField(
                  controller: _noteCtrl,
                  onChanged: (v) => widget.item.note = v,
                  style: const TextStyle(
                      color: AppColors.textMuted, fontSize: 11),
                  decoration: _deco('Note...'),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                widget.fmt(widget.item.amount),
                style: const TextStyle(
                  color: AppColors.primary,
                  fontSize: 12,
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
