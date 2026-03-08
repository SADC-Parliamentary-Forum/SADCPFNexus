import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';

// ─────────────────────────────────────────────────────────────
//  MODEL
// ─────────────────────────────────────────────────────────────
class _TravelFormData {
  // Step 1 – Mission Details
  String missionTitle = '';
  String purpose = '';
  DateTime? startDate;
  DateTime? endDate;
  String destination = '';
  bool highSecurityProtocol = false;

  // Step 2 – Funding
  String budgetLine = '';
  double estimatedCost = 0;
  double advanceRequested = 0;
  String fundingSource = '';

  // Step 3 – Itinerary
  String departureFlight = '';
  String returnFlight = '';
  String accommodation = '';
  int nights = 0;
  bool perDiemRequired = true;

  // Step 4 – Review is read-only

  bool get step1Valid =>
      missionTitle.isNotEmpty &&
      purpose.isNotEmpty &&
      startDate != null &&
      endDate != null &&
      destination.isNotEmpty;

  bool get step2Valid =>
      budgetLine.isNotEmpty && estimatedCost > 0 && fundingSource.isNotEmpty;

  bool get step3Valid => accommodation.isNotEmpty;
}

// ─────────────────────────────────────────────────────────────
//  MAIN SCREEN
// ─────────────────────────────────────────────────────────────
class TravelRequestFormScreen extends ConsumerStatefulWidget {
  const TravelRequestFormScreen({super.key});

  @override
  ConsumerState<TravelRequestFormScreen> createState() =>
      _TravelRequestFormScreenState();
}

class _TravelRequestFormScreenState
    extends ConsumerState<TravelRequestFormScreen> {
  final _form = _TravelFormData();
  int _step = 0; // 0=Mission, 1=Funding, 2=Itinerary, 3=Review
  bool _submitting = false;

  static const _stepLabels = ['Mission', 'Funding', 'Itinerary', 'Review'];

  // ── Submit ──────────────────────────────────────────────────
  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.post('/travel/requests', data: {
        'purpose': _form.missionTitle,
        'justification': _form.purpose,
        'destination': _form.destination,
        'start_date':
            _form.startDate?.toIso8601String().split('T').first ?? '',
        'end_date': _form.endDate?.toIso8601String().split('T').first ?? '',
        'high_security_protocol': _form.highSecurityProtocol,
        'budget_line': _form.budgetLine,
        'estimated_cost': _form.estimatedCost,
        'advance_requested': _form.advanceRequested,
        'funding_source': _form.fundingSource,
        'departure_flight': _form.departureFlight,
        'return_flight': _form.returnFlight,
        'accommodation': _form.accommodation,
        'nights': _form.nights,
        'per_diem_required': _form.perDiemRequired,
      });
      if (!mounted) return;
      _showSuccess();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to submit. Please try again.'),
          backgroundColor: AppColors.danger,
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _showSuccess() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => Dialog(
        backgroundColor: AppColors.bgSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_circle_outline,
                    color: AppColors.primary, size: 40),
              ),
              const SizedBox(height: 20),
              const Text('Request Submitted',
                  style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 18,
                      fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              const Text(
                'Your travel requisition has been submitted and is pending approval.',
                textAlign: TextAlign.center,
                style:
                    TextStyle(color: AppColors.textSecondary, fontSize: 13),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.of(context).pop();
                    Navigator.of(context).pop();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.bgDark,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Done',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Save Draft ────────────────────────────────────────────
  void _saveDraft() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Draft saved'),
        backgroundColor: AppColors.bgSurface,
        behavior: SnackBarBehavior.floating,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        action: SnackBarAction(
          label: 'OK',
          textColor: AppColors.primary,
          onPressed: () {},
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: SafeArea(
        child: Column(
          children: [
            _Header(
              step: _step,
              onBack: _step == 0
                  ? () => Navigator.of(context).pop()
                  : () => setState(() => _step--),
              onSaveDraft: _saveDraft,
              stepLabels: _stepLabels,
              theme: theme,
            ),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                transitionBuilder: (child, animation) => SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(0.08, 0),
                    end: Offset.zero,
                  ).animate(CurvedAnimation(
                      parent: animation, curve: Curves.easeOut)),
                  child: FadeTransition(opacity: animation, child: child),
                ),
                child: KeyedSubtree(
                  key: ValueKey(_step),
                  child: _stepWidget(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _stepWidget() {
    switch (_step) {
      case 0:
        return _Step1Mission(
          form: _form,
          onChanged: () => setState(() {}),
          onNext: _form.step1Valid ? () => setState(() => _step = 1) : null,
        );
      case 1:
        return _Step2Funding(
          form: _form,
          onChanged: () => setState(() {}),
          onNext: _form.step2Valid ? () => setState(() => _step = 2) : null,
        );
      case 2:
        return _Step3Itinerary(
          form: _form,
          onChanged: () => setState(() {}),
          onNext: _form.step3Valid ? () => setState(() => _step = 3) : null,
        );
      default:
        return _Step4Review(
          form: _form,
          submitting: _submitting,
          onSubmit: _submit,
          onEdit: (s) => setState(() => _step = s),
        );
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  HEADER (back + title + "Save Draft" + step indicator)
// ─────────────────────────────────────────────────────────────
class _Header extends StatelessWidget {
  final int step;
  final VoidCallback onBack;
  final VoidCallback onSaveDraft;
  final List<String> stepLabels;
  final ThemeData theme;

  const _Header({
    required this.step,
    required this.onBack,
    required this.onSaveDraft,
    required this.stepLabels,
    required this.theme,
  });

  @override
  Widget build(BuildContext context) {
    final c = theme.colorScheme;
    final borderColor = c.outline.withValues(alpha: 0.5);
    return Container(
      color: theme.scaffoldBackgroundColor,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 8, 16, 0),
            child: Row(
              children: [
                IconButton(
                  onPressed: onBack,
                  icon: Icon(Icons.arrow_back, color: c.onSurface, size: 22),
                ),
                Expanded(
                  child: Text(
                    'Travel Requisition',
                    style: TextStyle(
                      color: c.onSurface,
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: onSaveDraft,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: c.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(_kStitchRoundness),
                      border: Border.all(
                          color: c.primary.withValues(alpha: 0.3)),
                    ),
                    child: Text(
                      'Save Draft',
                      style: TextStyle(
                        color: c.primary,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: List.generate(stepLabels.length * 2 - 1, (i) {
                if (i.isOdd) {
                  final lineStep = i ~/ 2;
                  final filled = step > lineStep;
                  return Expanded(
                    child: Container(
                      height: 2,
                      color: filled ? c.primary : c.outline,
                    ),
                  );
                }
                final s = i ~/ 2;
                final isActive = s == step;
                final isDone = s < step;
                return _StepCircle(
                  number: s + 1,
                  label: stepLabels[s],
                  isActive: isActive,
                  isDone: isDone,
                  theme: theme,
                );
              }),
            ),
          ),
          const SizedBox(height: 12),
          Container(height: 1, color: borderColor),
        ],
      ),
    );
  }
}

const double _kStitchRoundness = 8.0;

class _StepCircle extends StatelessWidget {
  final int number;
  final String label;
  final bool isActive;
  final bool isDone;
  final ThemeData theme;

  const _StepCircle({
    required this.number,
    required this.label,
    required this.isActive,
    required this.isDone,
    required this.theme,
  });

  @override
  Widget build(BuildContext context) {
    final c = theme.colorScheme;
    Color bg;
    Color borderColor;
    Widget child;

    if (isDone) {
      bg = c.primary;
      borderColor = c.primary;
      child = Icon(Icons.check, size: 12, color: c.onPrimary);
    } else if (isActive) {
      bg = c.primary;
      borderColor = c.primary;
      child = Text(
        '$number',
        style: TextStyle(
          color: c.onPrimary,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      );
    } else {
      bg = Colors.transparent;
      borderColor = c.outline;
      child = Text(
        '$number',
        style: TextStyle(
          color: c.onSurface.withValues(alpha: 0.6),
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: bg,
            shape: BoxShape.circle,
            border: Border.all(color: borderColor, width: 2),
          ),
          child: Center(child: child),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            color: isActive || isDone
                ? c.primary
                : c.onSurface.withValues(alpha: 0.6),
            fontSize: 9,
            fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────
//  SHARED WIDGETS
// ─────────────────────────────────────────────────────────────

// Hero banner with world-map pattern
class _HeroBanner extends StatelessWidget {
  final int stepNumber;
  final String title;
  final String subtitle;

  const _HeroBanner({
    required this.stepNumber,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      height: 110,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: const LinearGradient(
          colors: [Color(0xFF0C2218), Color(0xFF0D3526)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: AppColors.border),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(
          children: [
            // Subtle grid pattern
            CustomPaint(
              size: Size.infinite,
              painter: _WorldGridPainter(),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                          color: AppColors.primary.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.shield_outlined,
                            size: 10, color: AppColors.primary),
                        const SizedBox(width: 4),
                        Text('STEP $stepNumber  |  SADCPFNexus Secure',
                            style: const TextStyle(
                                color: AppColors.primary,
                                fontSize: 9,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.5)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(title,
                      style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 18,
                          fontWeight: FontWeight.w800)),
                  const SizedBox(height: 2),
                  Text(subtitle,
                      style: const TextStyle(
                          color: AppColors.textSecondary, fontSize: 11)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Simple dotted grid to evoke a "world map" feel
class _WorldGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.primary.withValues(alpha: 0.06)
      ..strokeWidth = 1;
    const spacing = 18.0;
    for (double x = 0; x < size.width; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
    // Arc sweeps for "globe" feel
    final arcPaint = Paint()
      ..color = AppColors.primary.withValues(alpha: 0.08)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    for (var r = 30.0; r < 120; r += 30) {
      canvas.drawCircle(Offset(size.width * 0.75, size.height * 0.3), r, arcPaint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter _) => false;
}

// Form field
class _FormField extends StatelessWidget {
  final String label;
  final String hint;
  final bool valid;
  final TextEditingController controller;
  final int maxLines;
  final TextInputType keyboardType;
  final ValueChanged<String>? onChanged;

  const _FormField({
    required this.label,
    required this.hint,
    required this.controller,
    this.valid = false,
    this.maxLines = 1,
    this.keyboardType = TextInputType.text,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        RichText(
          text: TextSpan(
            text: label,
            style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w600),
            children: const [
              TextSpan(
                  text: ' *',
                  style: TextStyle(color: AppColors.danger, fontSize: 12))
            ],
          ),
        ),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: valid
                  ? AppColors.primary.withValues(alpha: 0.5)
                  : AppColors.border,
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  maxLines: maxLines,
                  keyboardType: keyboardType,
                  style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w500),
                  decoration: InputDecoration(
                    hintText: hint,
                    hintStyle: const TextStyle(
                        color: AppColors.textMuted, fontSize: 13),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                  ),
                  onChanged: onChanged,
                ),
              ),
              if (valid)
                const Padding(
                  padding: EdgeInsets.only(right: 12),
                  child: Icon(Icons.check_circle,
                      size: 18, color: AppColors.primary),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

// Date picker field
class _DateField extends StatelessWidget {
  final String label;
  final DateTime? value;
  final VoidCallback onTap;

  const _DateField(
      {required this.label, required this.value, required this.onTap});

  @override
  Widget build(BuildContext context) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    final display = value != null
        ? '${value!.day} ${months[value!.month - 1]} ${value!.year}'
        : 'mm/dd/yyyy';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        RichText(
          text: TextSpan(
            text: label,
            style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w600),
            children: const [
              TextSpan(
                  text: ' *',
                  style: TextStyle(color: AppColors.danger, fontSize: 12))
            ],
          ),
        ),
        const SizedBox(height: 6),
        GestureDetector(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.bgSurface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: value != null
                    ? AppColors.primary.withValues(alpha: 0.4)
                    : AppColors.border,
              ),
            ),
            child: Row(
              children: [
                Icon(Icons.calendar_today_outlined,
                    size: 15,
                    color: value != null
                        ? AppColors.primary
                        : AppColors.textMuted),
                const SizedBox(width: 8),
                Text(display,
                    style: TextStyle(
                        color: value != null
                            ? AppColors.textPrimary
                            : AppColors.textMuted,
                        fontSize: 13)),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// Dropdown field
class _DropdownField extends StatelessWidget {
  final String label;
  final String? value;
  final List<String> items;
  final ValueChanged<String?> onChanged;
  final IconData? leadingIcon;
  const _DropdownField({
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
    this.leadingIcon,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        RichText(
          text: TextSpan(
            text: label,
            style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w600),
            children: const [
              TextSpan(
                  text: ' *',
                  style: TextStyle(color: AppColors.danger, fontSize: 12))
            ],
          ),
        ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: value != null
                  ? AppColors.primary.withValues(alpha: 0.4)
                  : AppColors.border,
            ),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: value,
              hint: Row(
                children: [
                  if (leadingIcon != null) ...[
                    Icon(leadingIcon, size: 16, color: AppColors.textMuted),
                    const SizedBox(width: 8),
                  ],
                  Text('Select $label',
                      style: const TextStyle(
                          color: AppColors.textMuted, fontSize: 13)),
                ],
              ),
              isExpanded: true,
              dropdownColor: AppColors.bgSurface,
              iconEnabledColor: AppColors.textSecondary,
              style: const TextStyle(
                  color: AppColors.textPrimary, fontSize: 13),
              items: items
                  .map((e) => DropdownMenuItem(
                      value: e,
                      child: Row(
                        children: [
                          if (leadingIcon != null) ...[
                            Icon(leadingIcon,
                                size: 16, color: AppColors.textMuted),
                            const SizedBox(width: 8),
                          ],
                          Text(e),
                        ],
                      )))
                  .toList(),
              onChanged: onChanged,
            ),
          ),
        ),
      ],
    );
  }
}

// Bottom action bar
class _BottomBar extends StatelessWidget {
  final String leftLabel;
  final String leftValue;
  final String rightLabel;
  final String rightValue;
  final String ctaLabel;
  final VoidCallback? onCta;
  final bool loading;

  const _BottomBar({
    required this.leftLabel,
    required this.leftValue,
    required this.rightLabel,
    required this.rightValue,
    required this.ctaLabel,
    required this.onCta,
    this.loading = false,
  });

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
        border: Border(
          top: BorderSide(color: c.outline.withValues(alpha: 0.5)),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      leftLabel,
                      style: TextStyle(
                        color: c.onSurface.withValues(alpha: 0.7),
                        fontSize: 9,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      leftValue,
                      style: TextStyle(
                        color: c.onSurface,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      rightLabel,
                      style: TextStyle(
                        color: c.onSurface.withValues(alpha: 0.7),
                        fontSize: 9,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      rightValue,
                      style: TextStyle(
                        color: c.primary,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              onPressed: onCta,
              style: ElevatedButton.styleFrom(
                backgroundColor:
                    onCta != null ? c.primary : c.outline,
                foregroundColor: c.onPrimary,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(_kStitchRoundness),
                ),
                elevation: 0,
              ),
              child: loading
                  ? SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: c.onPrimary,
                      ),
                    )
                  : Text(
                      ctaLabel,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
//  STEP 1 – MISSION DETAILS
// ─────────────────────────────────────────────────────────────
class _Step1Mission extends StatefulWidget {
  final _TravelFormData form;
  final VoidCallback onChanged;
  final VoidCallback? onNext;

  const _Step1Mission(
      {required this.form, required this.onChanged, required this.onNext});

  @override
  State<_Step1Mission> createState() => _Step1MissionState();
}

class _Step1MissionState extends State<_Step1Mission> {
  late final TextEditingController _titleCtrl;
  late final TextEditingController _purposeCtrl;

  static const _countries = [
    'Angola', 'Botswana', 'Comoros', 'Democratic Republic of Congo',
    'Eswatini', 'Lesotho', 'Madagascar', 'Malawi', 'Mauritius',
    'Mozambique', 'Namibia', 'Seychelles', 'South Africa',
    'Tanzania', 'Zambia', 'Zimbabwe',
  ];

  @override
  void initState() {
    super.initState();
    _titleCtrl =
        TextEditingController(text: widget.form.missionTitle);
    _purposeCtrl = TextEditingController(text: widget.form.purpose);
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _purposeCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate(bool isStart) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: (isStart ? widget.form.startDate : widget.form.endDate) ??
          now,
      firstDate: now,
      lastDate: now.add(const Duration(days: 730)),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: const ColorScheme.dark(
            primary: AppColors.primary,
            onPrimary: AppColors.bgDark,
            surface: AppColors.bgSurface,
            onSurface: AppColors.textPrimary,
          ),
        ),
        child: child!,
      ),
    );
    if (picked == null) return;
    if (isStart) {
      widget.form.startDate = picked;
      if (widget.form.endDate != null &&
          widget.form.endDate!.isBefore(picked)) {
        widget.form.endDate = picked.add(const Duration(days: 1));
      }
    } else {
      widget.form.endDate = picked;
    }
    widget.onChanged();
  }

  @override
  Widget build(BuildContext context) {
    final f = widget.form;
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.only(bottom: 8),
            children: [
              const _HeroBanner(
                stepNumber: 1,
                title: 'Mission Details',
                subtitle: 'Enter primary details for SADC PF mission.',
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _FormField(
                      label: 'Mission Title',
                      hint: 'e.g. SADC Plenary Session 54',
                      controller: _titleCtrl,
                      valid: f.missionTitle.isNotEmpty,
                      onChanged: (v) {
                        f.missionTitle = v;
                        widget.onChanged();
                      },
                    ),
                    const SizedBox(height: 16),
                    _FormField(
                      label: 'Purpose & Justification',
                      hint: 'Describe the strategic importance...',
                      controller: _purposeCtrl,
                      maxLines: 3,
                      valid: f.purpose.length > 10,
                      onChanged: (v) {
                        f.purpose = v;
                        widget.onChanged();
                      },
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: _DateField(
                            label: 'Start Date',
                            value: f.startDate,
                            onTap: () => _pickDate(true),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _DateField(
                            label: 'End Date',
                            value: f.endDate,
                            onTap: () => _pickDate(false),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _DropdownField(
                      label: 'Destination',
                      value: f.destination.isEmpty ? null : f.destination,
                      items: _countries,
                      leadingIcon: Icons.language,
                      onChanged: (v) {
                        f.destination = v ?? '';
                        widget.onChanged();
                      },
                    ),
                    const SizedBox(height: 16),
                    // High Security Protocol toggle
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.bgSurface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: AppColors.gold.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.security,
                                color: AppColors.gold, size: 20),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('High Security Protocol',
                                    style: TextStyle(
                                        color: AppColors.textPrimary,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600)),
                                const SizedBox(height: 2),
                                if (f.highSecurityProtocol)
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppColors.primary
                                          .withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: const Text('BUDGET COMPLIANT',
                                        style: TextStyle(
                                            color: AppColors.primary,
                                            fontSize: 9,
                                            fontWeight: FontWeight.w700,
                                            letterSpacing: 0.5)),
                                  )
                                else
                                  const Text('Requires additional sign-off',
                                      style: TextStyle(
                                          color: AppColors.textMuted,
                                          fontSize: 11)),
                              ],
                            ),
                          ),
                          Switch(
                            value: f.highSecurityProtocol,
                            onChanged: (v) {
                              f.highSecurityProtocol = v;
                              widget.onChanged();
                            },
                            activeColor: AppColors.primary,
                            activeTrackColor:
                                AppColors.primary.withValues(alpha: 0.3),
                            inactiveThumbColor: AppColors.textMuted,
                            inactiveTrackColor: AppColors.border,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        _BottomBar(
          leftLabel: 'AVAILABLE FUNDS',
          leftValue: 'N\$ 12,500.00',
          rightLabel: 'EST. COST',
          rightValue: 'N\$ 0.00',
          ctaLabel: 'Proceed to Funding  →',
          onCta: widget.onNext,
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────
//  STEP 2 – FUNDING
// ─────────────────────────────────────────────────────────────
class _Step2Funding extends StatefulWidget {
  final _TravelFormData form;
  final VoidCallback onChanged;
  final VoidCallback? onNext;

  const _Step2Funding(
      {required this.form, required this.onChanged, required this.onNext});

  @override
  State<_Step2Funding> createState() => _Step2FundingState();
}

class _Step2FundingState extends State<_Step2Funding> {
  late final TextEditingController _costCtrl;
  late final TextEditingController _advanceCtrl;

  static const _budgetLines = [
    'BL-001: Travel & Mission',
    'BL-002: Conferences & Workshops',
    'BL-003: Staff Training',
    'BL-004: Committee Meetings',
    'BL-005: Institutional Representation',
  ];

  static const _fundingSources = [
    'Core Budget',
    'Donor Funded',
    'Joint Funding',
    'Emergency Reserve',
  ];

  @override
  void initState() {
    super.initState();
    _costCtrl = TextEditingController(
        text: widget.form.estimatedCost > 0
            ? widget.form.estimatedCost.toStringAsFixed(2)
            : '');
    _advanceCtrl = TextEditingController(
        text: widget.form.advanceRequested > 0
            ? widget.form.advanceRequested.toStringAsFixed(2)
            : '');
  }

  @override
  void dispose() {
    _costCtrl.dispose();
    _advanceCtrl.dispose();
    super.dispose();
  }

  String get _estCostDisplay => widget.form.estimatedCost > 0
      ? 'N\$ ${widget.form.estimatedCost.toStringAsFixed(2)}'
      : 'N\$ 0.00';

  @override
  Widget build(BuildContext context) {
    final f = widget.form;
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.only(bottom: 8),
            children: [
              const _HeroBanner(
                stepNumber: 2,
                title: 'Funding Details',
                subtitle: 'Specify budget line and cost allocation.',
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _DropdownField(
                      label: 'Budget Line',
                      value: f.budgetLine.isEmpty ? null : f.budgetLine,
                      items: _budgetLines,
                      leadingIcon: Icons.account_tree_outlined,
                      onChanged: (v) {
                        f.budgetLine = v ?? '';
                        widget.onChanged();
                      },
                    ),
                    const SizedBox(height: 16),
                    _DropdownField(
                      label: 'Funding Source',
                      value: f.fundingSource.isEmpty ? null : f.fundingSource,
                      items: _fundingSources,
                      leadingIcon: Icons.account_balance_outlined,
                      onChanged: (v) {
                        f.fundingSource = v ?? '';
                        widget.onChanged();
                      },
                    ),
                    const SizedBox(height: 16),
                    _FormField(
                      label: 'Estimated Total Cost (N\$)',
                      hint: '0.00',
                      controller: _costCtrl,
                      keyboardType: const TextInputType.numberWithOptions(
                          decimal: true),
                      valid: f.estimatedCost > 0,
                      onChanged: (v) {
                        f.estimatedCost =
                            double.tryParse(v.replaceAll(',', '')) ?? 0;
                        widget.onChanged();
                      },
                    ),
                    const SizedBox(height: 16),
                    _FormField(
                      label: 'Advance Requested (N\$)',
                      hint: '0.00',
                      controller: _advanceCtrl,
                      keyboardType: const TextInputType.numberWithOptions(
                          decimal: true),
                      valid: f.advanceRequested > 0,
                      onChanged: (v) {
                        f.advanceRequested =
                            double.tryParse(v.replaceAll(',', '')) ?? 0;
                        widget.onChanged();
                      },
                    ),
                    const SizedBox(height: 16),
                    // Budget compliance card
                    if (f.estimatedCost > 0)
                      _BudgetComplianceCard(
                          available: 12500,
                          estimated: f.estimatedCost),
                  ],
                ),
              ),
            ],
          ),
        ),
        _BottomBar(
          leftLabel: 'AVAILABLE FUNDS',
          leftValue: 'N\$ 12,500.00',
          rightLabel: 'EST. COST',
          rightValue: _estCostDisplay,
          ctaLabel: 'Proceed to Itinerary  →',
          onCta: widget.onNext,
        ),
      ],
    );
  }
}

class _BudgetComplianceCard extends StatelessWidget {
  final double available;
  final double estimated;

  const _BudgetComplianceCard(
      {required this.available, required this.estimated});

  @override
  Widget build(BuildContext context) {
    final isCompliant = estimated <= available;
    final ratio = (estimated / available).clamp(0.0, 1.0);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isCompliant
            ? AppColors.primary.withValues(alpha: 0.06)
            : AppColors.danger.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isCompliant
              ? AppColors.primary.withValues(alpha: 0.25)
              : AppColors.danger.withValues(alpha: 0.25),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                isCompliant
                    ? Icons.check_circle_outline
                    : Icons.warning_amber_outlined,
                size: 16,
                color: isCompliant ? AppColors.primary : AppColors.danger,
              ),
              const SizedBox(width: 8),
              Text(
                isCompliant ? 'Within Budget' : 'Exceeds Budget',
                style: TextStyle(
                    color:
                        isCompliant ? AppColors.primary : AppColors.danger,
                    fontSize: 12,
                    fontWeight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: ratio,
              backgroundColor: AppColors.border,
              valueColor: AlwaysStoppedAnimation(
                  isCompliant ? AppColors.primary : AppColors.danger),
              minHeight: 6,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '${(ratio * 100).toStringAsFixed(0)}% of available funds',
            style: const TextStyle(
                color: AppColors.textSecondary, fontSize: 10),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
//  STEP 3 – ITINERARY
// ─────────────────────────────────────────────────────────────
class _Step3Itinerary extends StatefulWidget {
  final _TravelFormData form;
  final VoidCallback onChanged;
  final VoidCallback? onNext;

  const _Step3Itinerary(
      {required this.form, required this.onChanged, required this.onNext});

  @override
  State<_Step3Itinerary> createState() => _Step3ItineraryState();
}

class _Step3ItineraryState extends State<_Step3Itinerary> {
  late final TextEditingController _departCtrl;
  late final TextEditingController _returnCtrl;
  late final TextEditingController _accomCtrl;

  @override
  void initState() {
    super.initState();
    _departCtrl =
        TextEditingController(text: widget.form.departureFlight);
    _returnCtrl =
        TextEditingController(text: widget.form.returnFlight);
    _accomCtrl =
        TextEditingController(text: widget.form.accommodation);
  }

  @override
  void dispose() {
    _departCtrl.dispose();
    _returnCtrl.dispose();
    _accomCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final f = widget.form;

    // Auto-compute nights
    if (f.startDate != null && f.endDate != null) {
      f.nights = f.endDate!.difference(f.startDate!).inDays;
    }

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.only(bottom: 8),
            children: [
              const _HeroBanner(
                stepNumber: 3,
                title: 'Itinerary',
                subtitle: 'Provide travel & accommodation details.',
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _FormField(
                      label: 'Departure Flight / Transport',
                      hint: 'e.g. Air Namibia W0 101 Windhoek → Lusaka',
                      controller: _departCtrl,
                      valid: f.departureFlight.isNotEmpty,
                      onChanged: (v) {
                        f.departureFlight = v;
                        widget.onChanged();
                      },
                    ),
                    const SizedBox(height: 16),
                    _FormField(
                      label: 'Return Flight / Transport',
                      hint: 'e.g. Air Namibia W0 102 Lusaka → Windhoek',
                      controller: _returnCtrl,
                      valid: f.returnFlight.isNotEmpty,
                      onChanged: (v) {
                        f.returnFlight = v;
                        widget.onChanged();
                      },
                    ),
                    const SizedBox(height: 16),
                    _FormField(
                      label: 'Accommodation',
                      hint: 'Hotel name & address',
                      controller: _accomCtrl,
                      valid: f.accommodation.isNotEmpty,
                      onChanged: (v) {
                        f.accommodation = v;
                        widget.onChanged();
                      },
                    ),
                    const SizedBox(height: 16),
                    // Nights computed
                    if (f.nights > 0)
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.bgSurface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                color:
                                    AppColors.info.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(Icons.hotel,
                                  color: AppColors.info, size: 20),
                            ),
                            const SizedBox(width: 12),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Duration',
                                    style: TextStyle(
                                        color: AppColors.textSecondary,
                                        fontSize: 11)),
                                Text('${f.nights} nights',
                                    style: const TextStyle(
                                        color: AppColors.textPrimary,
                                        fontSize: 16,
                                        fontWeight: FontWeight.w800)),
                              ],
                            ),
                          ],
                        ),
                      ),
                    const SizedBox(height: 16),
                    // Per diem toggle
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.bgSurface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: AppColors.warning.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(
                                Icons.account_balance_wallet_outlined,
                                color: AppColors.warning,
                                size: 20),
                          ),
                          const SizedBox(width: 12),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Per Diem Allowance',
                                    style: TextStyle(
                                        color: AppColors.textPrimary,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600)),
                                Text('Daily subsistence allowance',
                                    style: TextStyle(
                                        color: AppColors.textMuted,
                                        fontSize: 11)),
                              ],
                            ),
                          ),
                          Switch(
                            value: f.perDiemRequired,
                            onChanged: (v) {
                              f.perDiemRequired = v;
                              widget.onChanged();
                            },
                            activeColor: AppColors.primary,
                            activeTrackColor:
                                AppColors.primary.withValues(alpha: 0.3),
                            inactiveThumbColor: AppColors.textMuted,
                            inactiveTrackColor: AppColors.border,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        _BottomBar(
          leftLabel: 'DURATION',
          leftValue: f.nights > 0 ? '${f.nights} nights' : '—',
          rightLabel: 'EST. COST',
          rightValue: f.estimatedCost > 0
              ? 'N\$ ${f.estimatedCost.toStringAsFixed(2)}'
              : 'N\$ 0.00',
          ctaLabel: 'Review & Submit  →',
          onCta: widget.onNext,
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────
//  STEP 4 – REVIEW & SUBMIT
// ─────────────────────────────────────────────────────────────
class _Step4Review extends StatelessWidget {
  final _TravelFormData form;
  final bool submitting;
  final VoidCallback onSubmit;
  final ValueChanged<int> onEdit;

  const _Step4Review({
    required this.form,
    required this.submitting,
    required this.onSubmit,
    required this.onEdit,
  });

  @override
  Widget build(BuildContext context) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    String formatDate(DateTime? d) => d == null
        ? '—'
        : '${d.day} ${months[d.month - 1]} ${d.year}';

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Summary banner
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppColors.primary.withValues(alpha: 0.12),
                      AppColors.primary.withValues(alpha: 0.04),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.25)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text('DRAFT · PENDING REVIEW',
                              style: TextStyle(
                                  color: AppColors.primary,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.5)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      form.missionTitle.isEmpty
                          ? 'Untitled Mission'
                          : form.missionTitle,
                      style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 18,
                          fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 4),
                    Text(form.destination.isEmpty ? '—' : form.destination,
                        style: const TextStyle(
                            color: AppColors.textSecondary, fontSize: 13)),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        const Icon(Icons.calendar_today_outlined,
                            size: 13, color: AppColors.textMuted),
                        const SizedBox(width: 6),
                        Text(
                          '${formatDate(form.startDate)}  →  ${formatDate(form.endDate)}',
                          style: const TextStyle(
                              color: AppColors.textSecondary, fontSize: 12),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Section: Mission
              _ReviewSection(
                title: 'Mission Details',
                onEdit: () => onEdit(0),
                rows: [
                  _ReviewRow('Purpose', form.purpose.isEmpty ? '—' : form.purpose),
                  _ReviewRow('High Security', form.highSecurityProtocol ? 'Yes' : 'No'),
                ],
              ),
              const SizedBox(height: 12),

              // Section: Funding
              _ReviewSection(
                title: 'Funding',
                onEdit: () => onEdit(1),
                rows: [
                  _ReviewRow('Budget Line', form.budgetLine.isEmpty ? '—' : form.budgetLine),
                  _ReviewRow('Source', form.fundingSource.isEmpty ? '—' : form.fundingSource),
                  _ReviewRow('Estimated Cost',
                      form.estimatedCost > 0
                          ? 'N\$ ${form.estimatedCost.toStringAsFixed(2)}'
                          : '—'),
                  _ReviewRow('Advance Requested',
                      form.advanceRequested > 0
                          ? 'N\$ ${form.advanceRequested.toStringAsFixed(2)}'
                          : '—'),
                ],
              ),
              const SizedBox(height: 12),

              // Section: Itinerary
              _ReviewSection(
                title: 'Itinerary',
                onEdit: () => onEdit(2),
                rows: [
                  _ReviewRow('Departure', form.departureFlight.isEmpty ? '—' : form.departureFlight),
                  _ReviewRow('Return', form.returnFlight.isEmpty ? '—' : form.returnFlight),
                  _ReviewRow('Accommodation', form.accommodation.isEmpty ? '—' : form.accommodation),
                  _ReviewRow('Nights', form.nights > 0 ? '${form.nights}' : '—'),
                  _ReviewRow('Per Diem', form.perDiemRequired ? 'Required' : 'Not required'),
                ],
              ),
              const SizedBox(height: 16),

              // Declaration
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.bgSurface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.info_outline,
                        size: 16, color: AppColors.textMuted),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'By submitting, I confirm that all information is accurate and '
                        'this request complies with SADC PF financial regulations and policies.',
                        style: TextStyle(
                            color: AppColors.textSecondary, fontSize: 11, height: 1.5),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        _BottomBar(
          leftLabel: 'TOTAL COST',
          leftValue: form.estimatedCost > 0
              ? 'N\$ ${form.estimatedCost.toStringAsFixed(2)}'
              : 'N\$ 0.00',
          rightLabel: 'DURATION',
          rightValue: form.nights > 0 ? '${form.nights} nights' : '—',
          ctaLabel: submitting ? 'Submitting...' : 'Submit for Approval',
          onCta: submitting ? null : onSubmit,
          loading: submitting,
        ),
      ],
    );
  }
}

class _ReviewSection extends StatelessWidget {
  final String title;
  final VoidCallback onEdit;
  final List<_ReviewRow> rows;

  const _ReviewSection({
    required this.title,
    required this.onEdit,
    required this.rows,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 10, 10),
            child: Row(
              children: [
                Text(title,
                    style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w700)),
                const Spacer(),
                GestureDetector(
                  onTap: onEdit,
                  child: const Padding(
                    padding: EdgeInsets.all(4),
                    child: Text('Edit',
                        style: TextStyle(
                            color: AppColors.primary,
                            fontSize: 12,
                            fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
            ),
          ),
          Container(height: 1, color: AppColors.border),
          ...rows.map((r) => r.build()),
        ],
      ),
    );
  }
}

class _ReviewRow {
  final String label;
  final String value;

  const _ReviewRow(this.label, this.value);

  Widget build() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(label,
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 12)),
          ),
          Expanded(
            child: Text(value,
                style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 12,
                    fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}
