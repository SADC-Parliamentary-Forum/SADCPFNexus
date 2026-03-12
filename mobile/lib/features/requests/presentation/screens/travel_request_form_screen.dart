import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/auth/auth_providers.dart';
import '../../../../core/offline/draft_database.dart';
import '../../../../core/offline/draft_provider.dart';
import '../../../../core/router/safe_back.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/stitch_buttons.dart';
import '../../data/travel_locations.dart';

// ─────────────────────────────────────────────────────────────
//  MODEL
// ─────────────────────────────────────────────────────────────
class _TravelFormData {
  // Step 1 – Mission Details
  String missionTitle = '';
  String purpose = '';
  DateTime? startDate;
  DateTime? endDate;
  String destinationCountry = '';
  String destinationCity = '';
  String fromLocation = '';
  String toLocation = '';
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
      destinationCountry.isNotEmpty &&
      fromLocation.isNotEmpty &&
      toLocation.isNotEmpty;

  bool get step2Valid =>
      budgetLine.isNotEmpty && estimatedCost > 0 && fundingSource.isNotEmpty;

  bool get step3Valid => accommodation.isNotEmpty;
}

// ─────────────────────────────────────────────────────────────
//  MAIN SCREEN
// ─────────────────────────────────────────────────────────────
class TravelRequestFormScreen extends ConsumerStatefulWidget {
  const TravelRequestFormScreen({super.key, this.initialDraft, this.draftId});

  final Map<String, dynamic>? initialDraft;
  final int? draftId;

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

  @override
  void initState() {
    super.initState();
    _applyInitialDraft();
  }

  void _applyInitialDraft() {
    final d = widget.initialDraft;
    if (d == null) return;
    _form.missionTitle = d['purpose']?.toString() ?? '';
    _form.purpose = d['justification']?.toString() ?? '';
    if (d['departure_date'] != null) _form.startDate = DateTime.tryParse(d['departure_date'].toString());
    if (d['return_date'] != null) _form.endDate = DateTime.tryParse(d['return_date'].toString());
    _form.destinationCountry = d['destination_country']?.toString() ?? '';
    _form.destinationCity = d['destination_city']?.toString() ?? '';
    _form.estimatedCost = (d['estimated_cost'] is num) ? (d['estimated_cost'] as num).toDouble() : ((d['estimated_dsa'] is num) ? (d['estimated_dsa'] as num).toDouble() : 0);
    _form.budgetLine = d['budget_line']?.toString() ?? '';
    _form.advanceRequested = (d['advance_requested'] is num) ? (d['advance_requested'] as num).toDouble() : 0;
    _form.fundingSource = d['funding_source']?.toString() ?? '';
    _form.highSecurityProtocol = d['high_security_protocol'] == true;
    _form.departureFlight = d['departure_flight']?.toString() ?? '';
    _form.returnFlight = d['return_flight']?.toString() ?? '';
    _form.accommodation = d['accommodation']?.toString() ?? '';
    _form.nights = (d['nights'] is int) ? d['nights'] as int : ((d['nights'] is num) ? (d['nights'] as num).toInt() : 0);
    _form.perDiemRequired = d['per_diem_required'] != false;
    final it = d['itineraries'] as List<dynamic>?;
    if (it != null && it.isNotEmpty) {
      final first = it.first as Map<String, dynamic>?;
      if (first != null) {
        _form.fromLocation = first['from_location']?.toString() ?? '';
        _form.toLocation = first['to_location']?.toString() ?? '';
      }
    }
  }

  // ── Submit ──────────────────────────────────────────────────
  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.post('/travel/requests', data: _buildPayload());
      if (!mounted) return;
      if (widget.draftId != null) {
        try {
          final db = ref.read(draftDatabaseProvider);
          await (db.delete(db.draftEntries)..where((t) => t.id.equals(widget.draftId!))).go();
        } catch (_) {}
      }
      _showSuccess();
    } catch (_) {
      if (!mounted) return;
      final c = Theme.of(context).colorScheme;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Failed to submit. Please try again.'),
          backgroundColor: c.error,
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _showSuccess() {
    final theme = Theme.of(context);
    final c = theme.colorScheme;
    final textTheme = theme.textTheme;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => Dialog(
        backgroundColor: c.surface,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(kStitchCardRoundness)),
        child: Padding(
          padding: const EdgeInsets.all(kStitchSpace24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: c.primary.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.check_circle_outline,
                    color: c.primary, size: 40),
              ),
              const SizedBox(height: kStitchSpace20),
              Text('Request Submitted',
                  style: textTheme.titleLarge?.copyWith(
                      color: c.onSurface,
                      fontSize: 18,
                      fontWeight: FontWeight.w800)),
              const SizedBox(height: kStitchSpace8),
              Text(
                'Your travel requisition has been submitted and is pending approval.',
                textAlign: TextAlign.center,
                style: textTheme.bodySmall?.copyWith(
                    color: c.onSurface.withValues(alpha: 0.7), fontSize: 13),
              ),
              const SizedBox(height: kStitchSpace24),
              StitchPrimaryButton(
                label: 'Done',
                onPressed: () {
                  Navigator.of(context).pop();
                  context.safePopOrGoHome();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Map<String, dynamic> _buildPayload() {
    final departureDate = _form.startDate?.toIso8601String().split('T').first ?? '';
    final returnDate = _form.endDate?.toIso8601String().split('T').first ?? '';
    return {
      'purpose': _form.missionTitle,
      'justification': _form.purpose,
      'departure_date': departureDate,
      'return_date': returnDate,
      'destination_country': _form.destinationCountry,
      'destination_city': _form.destinationCity.isEmpty ? null : _form.destinationCity,
      'estimated_dsa': _form.estimatedCost,
      'currency': 'USD',
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
      'itineraries': [
        {
          'from_location': _form.fromLocation,
          'to_location': _form.toLocation,
          'travel_date': departureDate,
          'transport_mode': 'flight',
          'days_count': 1,
        },
      ],
    };
  }

  Future<void> _saveDraft() async {
    try {
      final db = ref.read(draftDatabaseProvider);
      final payload = _buildPayload();
      final title = _form.missionTitle.isNotEmpty ? _form.missionTitle : 'Travel draft';
      await db.into(db.draftEntries).insert(DraftEntriesCompanion.insert(
        type: 'travel',
        title: title,
        payload: jsonEncode(payload),
        createdAt: DateTime.now(),
      ));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Draft saved. Sync from Offline Drafts when ready.'), backgroundColor: AppColors.success),
      );
      context.pop();
      context.push('/offline/drafts');
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to save draft.'), backgroundColor: AppColors.danger),
      );
    }
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
                  ? () => context.safePopOrGoHome()
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
                      borderRadius: BorderRadius.circular(kStitchRoundness),
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
    final c = Theme.of(context).colorScheme;
    return Container(
      margin: const EdgeInsets.fromLTRB(kStitchSpace16, kStitchSpace16, kStitchSpace16, 0),
      height: 110,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(kStitchCardRoundness),
        gradient: const LinearGradient(
          colors: [Color(0xFF0C2218), Color(0xFF0D3526)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: c.outline),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(kStitchCardRoundness),
        child: Stack(
          children: [
            CustomPaint(
              size: Size.infinite,
              painter: _WorldGridPainter(primaryColor: c.primary),
            ),
            Padding(
              padding: const EdgeInsets.all(kStitchSpace16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: kStitchSpace8, vertical: 3),
                    decoration: BoxDecoration(
                      color: c.primary.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                          color: c.primary.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.shield_outlined,
                            size: 10, color: c.primary),
                        const SizedBox(width: 4),
                        Text('STEP $stepNumber  |  SADCPFNexus Secure',
                            style: TextStyle(
                                color: c.primary,
                                fontSize: 9,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.5)),
                      ],
                    ),
                  ),
                  const SizedBox(height: kStitchSpace8),
                  Text(title,
                      style: TextStyle(
                          color: c.onSurface,
                          fontSize: 18,
                          fontWeight: FontWeight.w800)),
                  const SizedBox(height: 2),
                  Text(subtitle,
                      style: TextStyle(
                          color: c.onSurface.withValues(alpha: 0.7), fontSize: 11)),
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
  _WorldGridPainter({required this.primaryColor});
  final Color primaryColor;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = primaryColor.withValues(alpha: 0.06)
      ..strokeWidth = 1;
    const spacing = 18.0;
    for (double x = 0; x < size.width; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
    final arcPaint = Paint()
      ..color = primaryColor.withValues(alpha: 0.08)
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
    final c = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        RichText(
          text: TextSpan(
            text: label,
            style: TextStyle(
                color: c.onSurface.withValues(alpha: 0.7),
                fontSize: 12,
                fontWeight: FontWeight.w600),
            children: [
              TextSpan(
                  text: ' *',
                  style: TextStyle(color: c.error, fontSize: 12))
            ],
          ),
        ),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(kStitchRoundness),
            border: Border.all(
              color: valid
                  ? c.primary.withValues(alpha: 0.5)
                  : c.outline,
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  maxLines: maxLines,
                  keyboardType: keyboardType,
                  style: TextStyle(
                      color: c.onSurface,
                      fontSize: 13,
                      fontWeight: FontWeight.w500),
                  decoration: InputDecoration(
                    hintText: hint,
                    hintStyle: TextStyle(
                        color: c.onSurface.withValues(alpha: 0.6), fontSize: 13),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                  ),
                  onChanged: onChanged,
                ),
              ),
              if (valid)
                Padding(
                  padding: const EdgeInsets.only(right: 12),
                  child: Icon(Icons.check_circle,
                      size: 18, color: c.primary),
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
    final c = Theme.of(context).colorScheme;
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
            style: TextStyle(
                color: c.onSurface.withValues(alpha: 0.7),
                fontSize: 12,
                fontWeight: FontWeight.w600),
            children: [
              TextSpan(
                  text: ' *',
                  style: TextStyle(color: c.error, fontSize: 12))
            ],
          ),
        ),
        const SizedBox(height: 6),
        GestureDetector(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              color: c.surface,
              borderRadius: BorderRadius.circular(kStitchRoundness),
              border: Border.all(
                color: value != null
                    ? c.primary.withValues(alpha: 0.4)
                    : c.outline,
              ),
            ),
            child: Row(
              children: [
                Icon(Icons.calendar_today_outlined,
                    size: 15,
                    color: value != null
                        ? c.primary
                        : c.onSurface.withValues(alpha: 0.6)),
                const SizedBox(width: 8),
                Text(display,
                    style: TextStyle(
                        color: value != null
                            ? c.onSurface
                            : c.onSurface.withValues(alpha: 0.6),
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
    final c = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        RichText(
          text: TextSpan(
            text: label,
            style: TextStyle(
                color: c.onSurface.withValues(alpha: 0.7),
                fontSize: 12,
                fontWeight: FontWeight.w600),
            children: [
              TextSpan(
                  text: ' *',
                  style: TextStyle(color: c.error, fontSize: 12))
            ],
          ),
        ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(kStitchRoundness),
            border: Border.all(
              color: value != null
                  ? c.primary.withValues(alpha: 0.4)
                  : c.outline,
            ),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: value,
              hint: Row(
                children: [
                  if (leadingIcon != null) ...[
                    Icon(leadingIcon, size: 16, color: c.onSurface.withValues(alpha: 0.6)),
                    const SizedBox(width: 8),
                  ],
                  Text('Select $label',
                      style: TextStyle(
                          color: c.onSurface.withValues(alpha: 0.6), fontSize: 13)),
                ],
              ),
              isExpanded: true,
              dropdownColor: c.surface,
              iconEnabledColor: c.onSurface.withValues(alpha: 0.7),
              style: TextStyle(
                  color: c.onSurface, fontSize: 13),
              items: items
                  .map((e) => DropdownMenuItem(
                      value: e,
                      child: Row(
                        children: [
                          if (leadingIcon != null) ...[
                            Icon(leadingIcon,
                                size: 16, color: c.onSurface.withValues(alpha: 0.6)),
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
                  borderRadius: BorderRadius.circular(kStitchRoundness),
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
      builder: (ctx, child) {
        final scheme = Theme.of(ctx).colorScheme;
        return Theme(
          data: Theme.of(ctx).copyWith(
            colorScheme: ColorScheme.dark(
              primary: scheme.primary,
              onPrimary: scheme.onPrimary,
              surface: scheme.surface,
              onSurface: scheme.onSurface,
            ),
          ),
          child: child!,
        );
      },
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
    final c = Theme.of(context).colorScheme;
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
                      label: 'Destination Country',
                      value: f.destinationCountry.isEmpty ? null : f.destinationCountry,
                      items: TravelLocations.countries,
                      leadingIcon: Icons.public,
                      onChanged: (v) {
                        f.destinationCountry = v ?? '';
                        f.destinationCity = '';
                        widget.onChanged();
                      },
                    ),
                    const SizedBox(height: 16),
                    _DropdownField(
                      label: 'City',
                      value: f.destinationCity.isEmpty ? null : f.destinationCity,
                      items: TravelLocations.citiesFor(f.destinationCountry),
                      leadingIcon: Icons.location_city,
                      onChanged: (v) {
                        f.destinationCity = v ?? '';
                        widget.onChanged();
                      },
                    ),
                    const SizedBox(height: 16),
                    _DropdownField(
                      label: 'From',
                      value: f.fromLocation.isEmpty ? null : f.fromLocation,
                      items: TravelLocations.allLocations,
                      leadingIcon: Icons.flight_takeoff,
                      onChanged: (v) {
                        f.fromLocation = v ?? '';
                        widget.onChanged();
                      },
                    ),
                    const SizedBox(height: 16),
                    _DropdownField(
                      label: 'To',
                      value: f.toLocation.isEmpty ? null : f.toLocation,
                      items: TravelLocations.allLocations,
                      leadingIcon: Icons.flight_land,
                      onChanged: (v) {
                        f.toLocation = v ?? '';
                        widget.onChanged();
                      },
                    ),
                    const SizedBox(height: 16),
                    // High Security Protocol toggle
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: c.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: c.outline),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: c.secondary.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(Icons.security,
                                color: c.secondary, size: 20),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('High Security Protocol',
                                    style: TextStyle(
                                        color: c.onSurface,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600)),
                                const SizedBox(height: 2),
                                if (f.highSecurityProtocol)
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: c.primary
                                          .withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text('BUDGET COMPLIANT',
                                        style: TextStyle(
                                            color: c.primary,
                                            fontSize: 9,
                                            fontWeight: FontWeight.w700,
                                            letterSpacing: 0.5)),
                                  )
                                else
                                  Text('Requires additional sign-off',
                                      style: TextStyle(
                                          color: c.onSurface.withValues(alpha: 0.6),
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
                            activeColor: c.primary,
                            activeTrackColor:
                                c.primary.withValues(alpha: 0.3),
                            inactiveThumbColor: c.onSurface.withValues(alpha: 0.6),
                            inactiveTrackColor: c.outline,
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
    final c = Theme.of(context).colorScheme;
    final isCompliant = estimated <= available;
    final ratio = (estimated / available).clamp(0.0, 1.0);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isCompliant
            ? c.primary.withValues(alpha: 0.06)
            : c.error.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isCompliant
              ? c.primary.withValues(alpha: 0.25)
              : c.error.withValues(alpha: 0.25),
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
                color: isCompliant ? c.primary : c.error,
              ),
              const SizedBox(width: 8),
              Text(
                isCompliant ? 'Within Budget' : 'Exceeds Budget',
                style: TextStyle(
                    color:
                        isCompliant ? c.primary : c.error,
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
              backgroundColor: c.outline,
              valueColor: AlwaysStoppedAnimation(
                  isCompliant ? c.primary : c.error),
              minHeight: 6,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '${(ratio * 100).toStringAsFixed(0)}% of available funds',
            style: TextStyle(
                color: c.onSurface.withValues(alpha: 0.7), fontSize: 10),
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
    final c = Theme.of(context).colorScheme;

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
                          color: c.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: c.outline),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                color:
                                    c.primary.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(Icons.hotel,
                                  color: c.primary, size: 20),
                            ),
                            const SizedBox(width: 12),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Duration',
                                    style: TextStyle(
                                        color: c.onSurface.withValues(alpha: 0.7),
                                        fontSize: 11)),
                                Text('${f.nights} nights',
                                    style: TextStyle(
                                        color: c.onSurface,
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
                        color: c.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: c.outline),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: c.secondary.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(
                                Icons.account_balance_wallet_outlined,
                                color: c.secondary,
                                size: 20),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Per Diem Allowance',
                                    style: TextStyle(
                                        color: c.onSurface,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600)),
                                Text('Daily subsistence allowance',
                                    style: TextStyle(
                                        color: c.onSurface.withValues(alpha: 0.6),
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
                            activeColor: c.primary,
                            activeTrackColor:
                                c.primary.withValues(alpha: 0.3),
                            inactiveThumbColor: c.onSurface.withValues(alpha: 0.6),
                            inactiveTrackColor: c.outline,
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
    final c = Theme.of(context).colorScheme;
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
                      c.primary.withValues(alpha: 0.12),
                      c.primary.withValues(alpha: 0.04),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                      color: c.primary.withValues(alpha: 0.25)),
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
                            color: c.primary.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text('DRAFT · PENDING REVIEW',
                              style: TextStyle(
                                  color: c.primary,
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
                      style: TextStyle(
                          color: c.onSurface,
                          fontSize: 18,
                          fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 4),
                    Text(
                        form.destinationCountry.isEmpty
                            ? '—'
                            : form.destinationCity.isEmpty
                                ? form.destinationCountry
                                : '${form.destinationCity}, ${form.destinationCountry}',
                        style: TextStyle(
                            color: c.onSurface.withValues(alpha: 0.7), fontSize: 13)),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Icon(Icons.calendar_today_outlined,
                            size: 13, color: c.onSurface.withValues(alpha: 0.6)),
                        const SizedBox(width: 6),
                        Text(
                          '${formatDate(form.startDate)}  →  ${formatDate(form.endDate)}',
                          style: TextStyle(
                              color: c.onSurface.withValues(alpha: 0.7), fontSize: 12),
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
                  _ReviewRow('Destination Country', form.destinationCountry.isEmpty ? '—' : form.destinationCountry),
                  _ReviewRow('City', form.destinationCity.isEmpty ? '—' : form.destinationCity),
                  _ReviewRow('From', form.fromLocation.isEmpty ? '—' : form.fromLocation),
                  _ReviewRow('To', form.toLocation.isEmpty ? '—' : form.toLocation),
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
                  color: c.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: c.outline),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.info_outline,
                        size: 16, color: c.onSurface.withValues(alpha: 0.6)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'By submitting, I confirm that all information is accurate and '
                        'this request complies with SADC PF financial regulations and policies.',
                        style: TextStyle(
                            color: c.onSurface.withValues(alpha: 0.7), fontSize: 11, height: 1.5),
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
    final c = Theme.of(context).colorScheme;
    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.outline),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 10, 10),
            child: Row(
              children: [
                Text(title,
                    style: TextStyle(
                        color: c.onSurface,
                        fontSize: 13,
                        fontWeight: FontWeight.w700)),
                const Spacer(),
                GestureDetector(
                  onTap: onEdit,
                  child: Padding(
                    padding: const EdgeInsets.all(4),
                    child: Text('Edit',
                        style: TextStyle(
                            color: c.primary,
                            fontSize: 12,
                            fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
            ),
          ),
          Container(height: 1, color: c.outline),
          ...rows.map((r) => r.build(context)),
        ],
      ),
    );
  }
}

class _ReviewRow {
  final String label;
  final String value;

  const _ReviewRow(this.label, this.value);

  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(label,
                style: TextStyle(
                    color: c.onSurface.withValues(alpha: 0.7), fontSize: 12)),
          ),
          Expanded(
            child: Text(value,
                style: TextStyle(
                    color: c.onSurface,
                    fontSize: 12,
                    fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}
