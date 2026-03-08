import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/auth/auth_providers.dart';
import '../../../../core/router/safe_back.dart';
import '../../../../core/theme/app_theme.dart';

// ─────────────────────────────────────────────────────────────
//  MODEL
// ─────────────────────────────────────────────────────────────
class _PifFormData {
  // Step 1
  String programTitle = '';
  String strategicObjective = '';
  String description = '';
  String locationName = '';
  String meetingHall = '';
  double? latitude = -22.5609;
  double? longitude = 17.0658;

  // Step 2
  double requestedAmount = 45000;
  double availableBudget = 120000;
  final List<_LineItem> lineItems = [
    _LineItem('Travel & Accommodation', 25000, '5 Delegates, 3 Days', 'Logistics'),
    _LineItem('External Consultants', 15000, 'Policy Analysis Expert', 'Services'),
    _LineItem('Venue & Logistics', 5000, 'Catering, AV Equipment', 'Operations'),
  ];

  // Step 3
  List<String> resources = [];
  String leadOfficer = '';

  bool get step1Valid =>
      programTitle.isNotEmpty && strategicObjective.isNotEmpty && locationName.isNotEmpty;
  bool get step2Valid => requestedAmount > 0 && requestedAmount <= availableBudget;
  bool get step3Valid => true;
}

class _LineItem {
  String name;
  double amount;
  String description;
  String category;
  _LineItem(this.name, this.amount, this.description, this.category);
}

// ─────────────────────────────────────────────────────────────
//  MAIN SCREEN
// ─────────────────────────────────────────────────────────────
class PifFormScreen extends ConsumerStatefulWidget {
  const PifFormScreen({super.key});

  @override
  ConsumerState<PifFormScreen> createState() => _PifFormScreenState();
}

class _PifFormScreenState extends ConsumerState<PifFormScreen> {
  int _currentStep = 0;
  final _data = _PifFormData();
  bool _submitting = false;

  static const _stepLabels = ['INFO', 'BUDGET', 'RES', 'REV'];
  static const _stepIcons = [
    Icons.info_outline,
    Icons.account_balance_wallet_outlined,
    Icons.people_alt_outlined,
    Icons.rate_review_outlined,
  ];

  void _nextStep() {
    if (_currentStep < 3) setState(() => _currentStep++);
  }

  void _prevStep() {
    if (_currentStep > 0) setState(() => _currentStep--);
  }

  Future<void> _saveDraft() async {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Draft saved successfully'),
        backgroundColor: AppColors.primary,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      final totalBudget = _data.lineItems.fold<double>(0, (s, i) => s + i.amount);
      final createRes = await dio.post<Map<String, dynamic>>('/programmes', data: {
        'title': _data.programTitle.isEmpty ? 'PIF Programme' : _data.programTitle,
        'background': _data.description.isEmpty ? null : _data.description,
        'overall_objective': _data.strategicObjective.isEmpty ? null : _data.strategicObjective,
        'primary_currency': 'NAD',
        'total_budget': totalBudget,
        'funding_source': 'SADC PF',
      });
      final id = createRes.data?['data']?['id'];
      if (id != null) {
        await dio.post('/programmes/$id/submit');
        if (!mounted) return;
        setState(() => _submitting = false);
        context.safePopOrGoHome();
        context.push('/pif/review?id=$id');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('PIF submitted for review'),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      } else {
        if (!mounted) return;
        setState(() => _submitting = false);
        _showError();
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _submitting = false);
      _showError();
    }
  }

  void _showError() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Failed to submit PIF. Please try again.'),
        backgroundColor: AppColors.danger,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: _buildAppBar(),
      body: Column(
        children: [
          _buildStepIndicator(),
          Expanded(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 280),
              transitionBuilder: (child, anim) => FadeTransition(
                opacity: anim,
                child: SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(0.05, 0),
                    end: Offset.zero,
                  ).animate(anim),
                  child: child,
                ),
              ),
              child: KeyedSubtree(
                key: ValueKey(_currentStep),
                child: _buildCurrentStep(),
              ),
            ),
          ),
          _buildBottomButtons(),
        ],
      ),
    );
  }

  AppBar _buildAppBar() {
    return AppBar(
      backgroundColor: AppColors.bgDark,
      leading: IconButton(
        icon: const Icon(Icons.close, color: AppColors.textPrimary),
        onPressed: () => context.safePopOrGoHome(),
      ),
      title: const Text(
        'New PIF',
        style: TextStyle(
          color: AppColors.textPrimary,
          fontSize: 17,
          fontWeight: FontWeight.w700,
        ),
      ),
      centerTitle: true,
      actions: [
        TextButton(
          onPressed: _saveDraft,
          child: const Text(
            'SAVE DRAFT',
            style: TextStyle(
              color: AppColors.primary,
              fontSize: 12,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.5,
            ),
          ),
        ),
      ],
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Container(height: 1, color: AppColors.border),
      ),
    );
  }

  Widget _buildStepIndicator() {
    return Container(
      color: AppColors.bgDark,
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
      child: Row(
        children: List.generate(_stepLabels.length * 2 - 1, (index) {
          if (index.isOdd) {
            final stepIndex = index ~/ 2;
            final isCompleted = stepIndex < _currentStep;
            return Expanded(
              child: Container(
                height: 2,
                color: isCompleted ? AppColors.primary : AppColors.border,
              ),
            );
          }
          final stepIndex = index ~/ 2;
          final isActive = stepIndex == _currentStep;
          final isCompleted = stepIndex < _currentStep;
          return _StepDot(
            label: _stepLabels[stepIndex],
            icon: _stepIcons[stepIndex],
            isActive: isActive,
            isCompleted: isCompleted,
          );
        }),
      ),
    );
  }

  Widget _buildCurrentStep() {
    switch (_currentStep) {
      case 0:
        return _Step1GeneralInfo(data: _data, onChanged: () => setState(() {}));
      case 1:
        return _Step2Budget(data: _data, onChanged: () => setState(() {}));
      case 2:
        return _Step3Resources(data: _data, onChanged: () => setState(() {}));
      case 3:
        return _Step4Review(data: _data);
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildBottomButtons() {
    return Container(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.of(context).padding.bottom + 16,
      ),
      decoration: const BoxDecoration(
        color: AppColors.bgDark,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton(
              onPressed: _currentStep == 0 ? () => context.safePopOrGoHome() : _prevStep,
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.textSecondary,
                side: const BorderSide(color: AppColors.border),
                minimumSize: const Size(0, 50),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(
                _currentStep == 0 ? 'Cancel' : 'Back',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 2,
            child: ElevatedButton(
              onPressed: _submitting ? null : (_currentStep == 3 ? _submit : _nextStep),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.bgDark,
                minimumSize: const Size(0, 50),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        color: AppColors.bgDark,
                        strokeWidth: 2,
                      ),
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          _currentStep == 3 ? 'Submit PIF' : 'Next Step',
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                        ),
                        if (_currentStep < 3) ...[
                          const SizedBox(width: 6),
                          const Icon(Icons.arrow_forward, size: 16),
                        ],
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
//  STEP DOT
// ─────────────────────────────────────────────────────────────
class _StepDot extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isActive;
  final bool isCompleted;

  const _StepDot({
    required this.label,
    required this.icon,
    required this.isActive,
    required this.isCompleted,
  });

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    if (isCompleted) {
      bg = AppColors.primary;
      fg = AppColors.bgDark;
    } else if (isActive) {
      bg = AppColors.primary.withValues(alpha: 0.15);
      fg = AppColors.primary;
    } else {
      bg = AppColors.bgSurface;
      fg = AppColors.textMuted;
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: bg,
            shape: BoxShape.circle,
            border: Border.all(
              color: isActive || isCompleted ? AppColors.primary : AppColors.border,
              width: isActive ? 2 : 1,
            ),
          ),
          child: Icon(
            isCompleted ? Icons.check : icon,
            color: fg,
            size: 16,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            color: isActive || isCompleted ? AppColors.primary : AppColors.textMuted,
            fontSize: 9,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────
//  STEP 1 – GENERAL INFO & VENUE
// ─────────────────────────────────────────────────────────────
class _Step1GeneralInfo extends StatefulWidget {
  final _PifFormData data;
  final VoidCallback onChanged;

  const _Step1GeneralInfo({required this.data, required this.onChanged});

  @override
  State<_Step1GeneralInfo> createState() => _Step1GeneralInfoState();
}

class _Step1GeneralInfoState extends State<_Step1GeneralInfo> {
  late final TextEditingController _titleCtrl;
  late final TextEditingController _descCtrl;
  late final TextEditingController _locationCtrl;
  late final TextEditingController _hallCtrl;

  static const _objectives = [
    'Promote Peace and Security',
    'Accelerate Economic Integration',
    'Strengthen Governance',
    'Combat Gender-Based Violence',
    'Digital Transformation',
    'Climate Resilience',
  ];

  @override
  void initState() {
    super.initState();
    _titleCtrl = TextEditingController(text: widget.data.programTitle);
    _descCtrl = TextEditingController(text: widget.data.description);
    _locationCtrl = TextEditingController(text: widget.data.locationName);
    _hallCtrl = TextEditingController(text: widget.data.meetingHall);
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _locationCtrl.dispose();
    _hallCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
      children: [
        const _SectionHeader(
          icon: Icons.circle,
          iconColor: AppColors.primary,
          label: 'General Information',
        ),
        const SizedBox(height: 16),
        _FormField(
          label: 'Program Title',
          child: TextField(
            controller: _titleCtrl,
            style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
            decoration: _inputDec('e.g. Annual SADC Governance Summit'),
            onChanged: (v) {
              widget.data.programTitle = v;
              widget.onChanged();
            },
          ),
        ),
        const SizedBox(height: 14),
        _FormField(
          label: 'Strategic Objective',
          child: DropdownButtonFormField<String>(
            value: widget.data.strategicObjective.isEmpty
                ? null
                : widget.data.strategicObjective,
            dropdownColor: AppColors.bgSurface,
            style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
            decoration: _inputDec('Select an objective'),
            items: _objectives
                .map((o) => DropdownMenuItem(value: o, child: Text(o)))
                .toList(),
            onChanged: (v) {
              widget.data.strategicObjective = v ?? '';
              widget.onChanged();
            },
          ),
        ),
        const SizedBox(height: 14),
        _FormField(
          label: 'Brief Description',
          child: TextField(
            controller: _descCtrl,
            maxLines: 4,
            style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
            decoration: _inputDec(
              'Describe the primary goals and expected outcomes...',
            ),
            onChanged: (v) {
              widget.data.description = v;
              widget.onChanged();
            },
          ),
        ),
        const SizedBox(height: 24),
        const _SectionHeader(
          icon: Icons.location_on,
          iconColor: AppColors.danger,
          label: 'Venue Details',
        ),
        const SizedBox(height: 16),
        _FormField(
          label: 'Location Name',
          child: TextField(
            controller: _locationCtrl,
            style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
            decoration: _inputDec('e.g. Windhoek Convention Center'),
            onChanged: (v) {
              widget.data.locationName = v;
              widget.onChanged();
            },
          ),
        ),
        const SizedBox(height: 14),
        _LocationDisplay(
          locationName: widget.data.locationName,
          lat: widget.data.latitude ?? -22.5609,
          lng: widget.data.longitude ?? 17.0658,
        ),
        const SizedBox(height: 14),
        _FormField(
          label: 'Meeting Hall / Room Number',
          child: TextField(
            controller: _hallCtrl,
            style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
            decoration: _inputDec('e.g. Hall A, Room 304'),
            onChanged: (v) {
              widget.data.meetingHall = v;
              widget.onChanged();
            },
          ),
        ),
      ],
    );
  }

  InputDecoration _inputDec(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
        filled: true,
        fillColor: AppColors.bgCard,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
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
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
      );
}

// ─────────────────────────────────────────────────────────────
//  STEP 2 – BUDGET & FUNDING
// ─────────────────────────────────────────────────────────────
class _Step2Budget extends StatefulWidget {
  final _PifFormData data;
  final VoidCallback onChanged;

  const _Step2Budget({required this.data, required this.onChanged});

  @override
  State<_Step2Budget> createState() => _Step2BudgetState();
}

class _Step2BudgetState extends State<_Step2Budget> {
  void _addItem() {
    setState(() {
      widget.data.lineItems.add(_LineItem('New Item', 0, '', 'General'));
    });
  }

  void _removeItem(int index) {
    setState(() {
      widget.data.lineItems.removeAt(index);
    });
  }

  @override
  Widget build(BuildContext context) {
    final pct =
        (widget.data.requestedAmount / widget.data.availableBudget * 100)
            .clamp(0.0, 100.0);
    final isValid = widget.data.requestedAmount <= widget.data.availableBudget;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
      children: [
        // Header card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Text(
                    'Budget Allocation',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.success.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
                    ),
                    child: const Text(
                      'VALID',
                      style: TextStyle(
                        color: AppColors.success,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.8,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _BudgetStat(
                      label: 'REQUESTED',
                      value: '\$${_fmt(widget.data.requestedAmount)}',
                      sub: 'Total for the PIF',
                      color: AppColors.primary,
                    ),
                  ),
                  Container(width: 1, height: 48, color: AppColors.border),
                  Expanded(
                    child: _BudgetStat(
                      label: 'AVAILABLE',
                      value: '\$${_fmt(widget.data.availableBudget)}',
                      sub: 'Budget Line Balance',
                      color: AppColors.info,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isValid
                      ? AppColors.success.withValues(alpha: 0.1)
                      : AppColors.danger.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isValid
                        ? AppColors.success.withValues(alpha: 0.3)
                        : AppColors.danger.withValues(alpha: 0.3),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          isValid ? Icons.check_circle_outline : Icons.warning_amber,
                          color: isValid ? AppColors.success : AppColors.danger,
                          size: 16,
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            isValid
                                ? 'Budget Within Limit: Allocation is ${pct.toStringAsFixed(1)}% of available funds'
                                : 'Budget Exceeds Available Funds',
                            style: TextStyle(
                              color: isValid ? AppColors.success : AppColors.danger,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: pct / 100,
                        backgroundColor: AppColors.border,
                        valueColor: AlwaysStoppedAnimation(
                          isValid ? AppColors.success : AppColors.danger,
                        ),
                        minHeight: 6,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        // Line items
        Row(
          children: [
            const Text(
              'Line Items',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
            ),
            const Spacer(),
            GestureDetector(
              onTap: _addItem,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.add, color: AppColors.primary, size: 14),
                    SizedBox(width: 4),
                    Text(
                      'Add Item',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ...widget.data.lineItems.asMap().entries.map((entry) {
          final i = entry.key;
          final item = entry.value;
          return _LineItemCard(
            item: item,
            onRemove: () => _removeItem(i),
          );
        }),
        const SizedBox(height: 20),
        ElevatedButton(
          onPressed: () {},
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: AppColors.bgDark,
            minimumSize: const Size(double.infinity, 50),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          child: const Text(
            'Confirm Budget Allocation',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
      ],
    );
  }

  String _fmt(double v) {
    if (v >= 1000) return '${(v / 1000).toStringAsFixed(0)},000';
    return v.toStringAsFixed(0);
  }
}

class _BudgetStat extends StatelessWidget {
  final String label;
  final String value;
  final String sub;
  final Color color;

  const _BudgetStat({
    required this.label,
    required this.value,
    required this.sub,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              color: color,
              fontSize: 22,
              fontWeight: FontWeight.w800,
            ),
          ),
          Text(
            sub,
            style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class _LineItemCard extends StatelessWidget {
  final _LineItem item;
  final VoidCallback onRemove;

  const _LineItemCard({required this.item, required this.onRemove});

  Color get _categoryColor {
    switch (item.category) {
      case 'Logistics':
        return AppColors.info;
      case 'Services':
        return AppColors.warning;
      case 'Operations':
        return AppColors.primary;
      default:
        return AppColors.textMuted;
    }
  }

  @override
  Widget build(BuildContext context) {
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
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: _categoryColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(Icons.receipt_long, color: _categoryColor, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  item.description,
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '\$${item.amount.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}',
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 3),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: _categoryColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  item.category,
                  style: TextStyle(color: _categoryColor, fontSize: 9, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onRemove,
            child: const Icon(Icons.close, color: AppColors.textMuted, size: 16),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
//  STEP 3 – RESOURCES
// ─────────────────────────────────────────────────────────────
class _Step3Resources extends StatefulWidget {
  final _PifFormData data;
  final VoidCallback onChanged;

  const _Step3Resources({required this.data, required this.onChanged});

  @override
  State<_Step3Resources> createState() => _Step3ResourcesState();
}

class _Step3ResourcesState extends State<_Step3Resources> {
  final _participants = [
    {'name': 'Dr. A. Mwamba', 'role': 'Lead Programme Officer', 'added': true},
    {'name': 'Ms. T. Dube', 'role': 'Finance Analyst', 'added': true},
    {'name': 'Mr. K. Sithole', 'role': 'External Consultant', 'added': false},
    {'name': 'Ms. N. Banda', 'role': 'Communications Officer', 'added': false},
  ];

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
      children: [
        const _SectionHeader(
          icon: Icons.people_alt_outlined,
          iconColor: AppColors.gold,
          label: 'Team & Resources',
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            children: _participants.asMap().entries.map((entry) {
              final i = entry.key;
              final p = entry.value;
              final added = p['added'] as bool;
              return Padding(
                padding: EdgeInsets.only(bottom: i < _participants.length - 1 ? 12 : 0),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Text(
                          (p['name'] as String).split(' ').map((w) => w[0]).take(2).join(),
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            p['name'] as String,
                            style: const TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            p['role'] as String,
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                    GestureDetector(
                      onTap: () => setState(() {
                        _participants[i]['added'] = !added;
                      }),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: added
                              ? AppColors.success.withValues(alpha: 0.1)
                              : AppColors.primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: added
                                ? AppColors.success.withValues(alpha: 0.3)
                                : AppColors.primary.withValues(alpha: 0.3),
                          ),
                        ),
                        child: Text(
                          added ? 'Added' : '+ Add',
                          style: TextStyle(
                            color: added ? AppColors.success : AppColors.primary,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 20),
        const _SectionHeader(
          icon: Icons.description_outlined,
          iconColor: AppColors.info,
          label: 'Supporting Documents',
        ),
        const SizedBox(height: 12),
        const _DocumentUploadTile(label: 'Terms of Reference (ToR)', uploaded: true),
        const SizedBox(height: 8),
        const _DocumentUploadTile(label: 'Budget Justification Memo', uploaded: false),
        const SizedBox(height: 8),
        const _DocumentUploadTile(label: 'Venue Confirmation Letter', uploaded: false),
      ],
    );
  }
}

class _DocumentUploadTile extends StatelessWidget {
  final String label;
  final bool uploaded;

  const _DocumentUploadTile({required this.label, required this.uploaded});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: uploaded ? AppColors.success.withValues(alpha: 0.4) : AppColors.border,
        ),
      ),
      child: Row(
        children: [
          Icon(
            uploaded ? Icons.check_circle : Icons.upload_file_outlined,
            color: uploaded ? AppColors.success : AppColors.textMuted,
            size: 20,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
            ),
          ),
          Text(
            uploaded ? 'Uploaded' : 'Upload',
            style: TextStyle(
              color: uploaded ? AppColors.success : AppColors.primary,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
//  STEP 4 – REVIEW
// ─────────────────────────────────────────────────────────────
class _Step4Review extends StatelessWidget {
  final _PifFormData data;

  const _Step4Review({required this.data});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
          ),
          child: const Row(
            children: [
              Icon(Icons.info_outline, color: AppColors.primary, size: 20),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Review all details before submitting. Once submitted, the PIF will enter the approval workflow.',
                  style: TextStyle(color: AppColors.primary, fontSize: 12),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        _ReviewSection(
          title: 'General Information',
          icon: Icons.info_outline,
          rows: [
            _ReviewRow('Program Title', data.programTitle.isEmpty ? 'Not set' : data.programTitle),
            _ReviewRow('Strategic Objective', data.strategicObjective.isEmpty ? 'Not set' : data.strategicObjective),
            _ReviewRow('Description', data.description.isEmpty ? 'Not set' : data.description),
          ],
        ),
        const SizedBox(height: 12),
        _ReviewSection(
          title: 'Venue Details',
          icon: Icons.location_on_outlined,
          rows: [
            _ReviewRow('Location', data.locationName.isEmpty ? 'Not set' : data.locationName),
            _ReviewRow('Meeting Hall', data.meetingHall.isEmpty ? 'Not set' : data.meetingHall),
            _ReviewRow('Coordinates', '${data.latitude?.toStringAsFixed(4)}°, ${data.longitude?.toStringAsFixed(4)}°'),
          ],
        ),
        const SizedBox(height: 12),
        _ReviewSection(
          title: 'Budget',
          icon: Icons.account_balance_wallet_outlined,
          rows: [
            _ReviewRow('Requested Amount', '\$${data.requestedAmount.toStringAsFixed(0)}'),
            _ReviewRow('Available Budget', '\$${data.availableBudget.toStringAsFixed(0)}'),
            _ReviewRow('Line Items', '${data.lineItems.length} items'),
          ],
        ),
      ],
    );
  }
}

class _ReviewSection extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<_ReviewRow> rows;

  const _ReviewSection({
    required this.title,
    required this.icon,
    required this.rows,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Icon(icon, color: AppColors.primary, size: 16),
                const SizedBox(width: 8),
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
          ),
          const Divider(height: 1, color: AppColors.border),
          ...rows.asMap().entries.map((entry) {
            final i = entry.key;
            final row = entry.value;
            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        row.label,
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          row.value,
                          textAlign: TextAlign.right,
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
                if (i < rows.length - 1) const Divider(height: 1, color: AppColors.border),
              ],
            );
          }),
        ],
      ),
    );
  }
}

class _ReviewRow {
  final String label;
  final String value;
  const _ReviewRow(this.label, this.value);
}

// ─────────────────────────────────────────────────────────────
//  SHARED WIDGETS
// ─────────────────────────────────────────────────────────────
class _SectionHeader extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;

  const _SectionHeader({
    required this.icon,
    required this.iconColor,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: iconColor, size: 14),
        const SizedBox(width: 8),
        Text(
          label,
          style: const TextStyle(
            color: AppColors.textPrimary,
            fontSize: 14,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class _FormField extends StatelessWidget {
  final String label;
  final Widget child;

  const _FormField({required this.label, required this.child});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: AppColors.textSecondary,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 6),
        child,
      ],
    );
  }
}

class _LocationDisplay extends StatelessWidget {
  final String locationName;
  final double lat;
  final double lng;

  const _LocationDisplay({
    required this.locationName,
    required this.lat,
    required this.lng,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
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
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.location_on, color: AppColors.primary, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  locationName.isEmpty ? 'Location' : locationName,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${lat.toStringAsFixed(4)}°, ${lng.toStringAsFixed(4)}°',
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 11,
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
