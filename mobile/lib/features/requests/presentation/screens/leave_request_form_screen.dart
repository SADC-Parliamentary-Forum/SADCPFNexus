import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class LeaveRequestFormScreen extends StatefulWidget {
  const LeaveRequestFormScreen({super.key});
  @override
  State<LeaveRequestFormScreen> createState() => _LeaveRequestFormScreenState();
}

class _LeaveRequestFormScreenState extends State<LeaveRequestFormScreen> {
  int _step = 0;
  String _leaveType = 'Annual Leave';
  DateTime? _startDate;
  DateTime? _endDate;
  bool _halfDay = false;
  String _halfDayPeriod = 'Morning';
  final _reasonCtrl = TextEditingController();
  bool _hasDoc = false;
  bool _submitting = false;

  static const _leaveTypes = [
    {'label': 'Annual Leave', 'icon': Icons.beach_access_outlined, 'color': Color(0xFF059669)},
    {'label': 'Sick Leave', 'icon': Icons.medical_services_outlined, 'color': Color(0xFFDC2626)},
    {'label': 'Maternity Leave', 'icon': Icons.child_care_outlined, 'color': Color(0xFFD97706)},
    {'label': 'Paternity Leave', 'icon': Icons.family_restroom_outlined, 'color': Color(0xFF2563EB)},
    {'label': 'Study Leave', 'icon': Icons.school_outlined, 'color': Color(0xFF7C3AED)},
    {'label': 'Compassionate', 'icon': Icons.volunteer_activism_outlined, 'color': Color(0xFF0891B2)},
  ];

  int get _days {
    if (_startDate == null || _endDate == null) return 0;
    int count = 0;
    var d = _startDate!;
    while (!d.isAfter(_endDate!)) {
      if (d.weekday != DateTime.saturday && d.weekday != DateTime.sunday) count++;
      d = d.add(const Duration(days: 1));
    }
    return _halfDay ? 1 : count;
  }

  static const _months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  String _fmt(DateTime d) => '${d.day} ${_months[d.month - 1]} ${d.year}';

  Future<void> _pickDate(bool isStart) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 2),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: const ColorScheme.light(primary: AppColors.primary, onPrimary: Colors.white),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startDate = picked;
          if (_endDate != null && _endDate!.isBefore(picked)) _endDate = picked;
        } else {
          _endDate = picked;
        }
      });
    }
  }

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close, color: AppColors.textPrimary, size: 22),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Leave Request', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [
          TextButton(onPressed: () {}, child: const Text('Save Draft', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600))),
        ],
      ),
      body: Column(children: [
        _StepIndicator(current: _step, total: 2, labels: const ['Type & Dates', 'Details']),
        Expanded(child: _step == 0 ? _buildStep1() : _buildStep2()),
        _BottomBar(
          step: _step,
          canNext: _step == 0 ? (_startDate != null && _endDate != null) : _reasonCtrl.text.trim().isNotEmpty,
          submitting: _submitting,
          onBack: _step == 0 ? null : () => setState(() => _step = 0),
          onNext: () {
            if (_step == 0) {
              setState(() => _step = 1);
            } else {
              _submit();
            }
          },
          days: _days,
          leaveType: _leaveType,
        ),
      ]),
    );
  }

  Widget _buildStep1() => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      const Text('Select Leave Type', style: TextStyle(color: AppColors.textPrimary, fontSize: 18, fontWeight: FontWeight.w800)),
      const SizedBox(height: 4),
      const Text('Choose the type of leave you are requesting.', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
      const SizedBox(height: 16),
      GridView.count(
        crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 2.4,
        children: _leaveTypes.map((t) {
          final isSelected = _leaveType == t['label'];
          final color = t['color'] as Color;
          return GestureDetector(
            onTap: () => setState(() => _leaveType = t['label'] as String),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: isSelected ? color.withValues(alpha: 0.08) : AppColors.bgSurface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: isSelected ? color : AppColors.border, width: isSelected ? 2 : 1),
              ),
              child: Row(children: [
                Icon(t['icon'] as IconData, color: isSelected ? color : AppColors.textMuted, size: 18),
                const SizedBox(width: 8),
                Expanded(child: Text(t['label'] as String,
                  style: TextStyle(color: isSelected ? color : AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w600))),
              ]),
            ),
          );
        }).toList(),
      ),
      const SizedBox(height: 20),
      const Text('Select Dates', style: TextStyle(color: AppColors.textPrimary, fontSize: 15, fontWeight: FontWeight.w700)),
      const SizedBox(height: 10),
      Row(children: [
        Expanded(child: _DateField(
          label: 'Start Date',
          value: _startDate != null ? _fmt(_startDate!) : null,
          onTap: () => _pickDate(true),
        )),
        const SizedBox(width: 12),
        Expanded(child: _DateField(
          label: 'End Date',
          value: _endDate != null ? _fmt(_endDate!) : null,
          onTap: () => _pickDate(false),
        )),
      ]),
      const SizedBox(height: 12),
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
        child: Row(children: [
          Checkbox(
            value: _halfDay,
            activeColor: AppColors.primary,
            checkColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
            onChanged: (v) => setState(() => _halfDay = v!),
          ),
          const Text('Half day only', style: TextStyle(color: AppColors.textPrimary, fontSize: 13)),
          const Spacer(),
          if (_halfDay) ...[
            _PillToggle(
              options: const ['Morning', 'Afternoon'],
              selected: _halfDayPeriod,
              onSelect: (v) => setState(() => _halfDayPeriod = v),
            ),
          ],
        ]),
      ),
      if (_days > 0) ...[
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.primary.withValues(alpha: 0.25))),
          child: Row(children: [
            const Icon(Icons.calendar_today_outlined, color: AppColors.primary, size: 16),
            const SizedBox(width: 8),
            Text('$_days working day${_days == 1 ? '' : 's'} selected',
              style: const TextStyle(color: AppColors.primary, fontSize: 13, fontWeight: FontWeight.w700)),
          ]),
        ),
      ],
    ],
  );

  Widget _buildStep2() => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      const Text('Leave Details', style: TextStyle(color: AppColors.textPrimary, fontSize: 18, fontWeight: FontWeight.w800)),
      const SizedBox(height: 4),
      const Text('Provide a reason and any supporting documentation.', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
      const SizedBox(height: 16),
      // Summary chip
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
        child: Row(children: [
          Container(width: 40, height: 40,
            decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
            child: const Icon(Icons.beach_access_outlined, color: AppColors.primary, size: 20)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(_leaveType, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
            if (_startDate != null && _endDate != null)
              Text('${_fmt(_startDate!)}  –  ${_fmt(_endDate!)}  ·  $_days day${_days == 1 ? '' : 's'}',
                style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
          ])),
        ]),
      ),
      const SizedBox(height: 16),
      const Text('REASON', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
      const SizedBox(height: 8),
      Container(
        decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
        child: TextField(
          controller: _reasonCtrl,
          maxLines: 4,
          onChanged: (_) => setState(() {}),
          style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
          decoration: const InputDecoration(
            hintText: 'Briefly describe the reason for your leave request...',
            hintStyle: TextStyle(color: AppColors.textMuted, fontSize: 12),
            border: InputBorder.none,
            contentPadding: EdgeInsets.all(14),
          ),
        ),
      ),
      const SizedBox(height: 16),
      const Text('SUPPORTING DOCUMENT', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
      const SizedBox(height: 8),
      GestureDetector(
        onTap: () => setState(() => _hasDoc = !_hasDoc),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: _hasDoc ? AppColors.primary.withValues(alpha: 0.06) : AppColors.bgSurface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _hasDoc ? AppColors.primary.withValues(alpha: 0.3) : AppColors.border),
          ),
          child: Row(children: [
            Icon(_hasDoc ? Icons.attach_file : Icons.upload_file_outlined,
              color: _hasDoc ? AppColors.primary : AppColors.textMuted, size: 22),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(_hasDoc ? 'medical_certificate.pdf' : 'Attach supporting document (optional)',
                style: TextStyle(color: _hasDoc ? AppColors.primary : AppColors.textSecondary, fontSize: 13, fontWeight: FontWeight.w500)),
              if (_hasDoc) const Text('234 KB', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
            ])),
            if (_hasDoc) Icon(Icons.check_circle, color: AppColors.success, size: 18),
          ]),
        ),
      ),
      const SizedBox(height: 16),
      const Text('ACTING OFFICER (if required)', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
      const SizedBox(height: 8),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
        child: Row(children: [
          const Icon(Icons.person_outline, color: AppColors.textMuted, size: 20),
          const SizedBox(width: 12),
          const Expanded(child: Text('Not assigned', style: TextStyle(color: AppColors.textMuted, fontSize: 13))),
          GestureDetector(onTap: () {},
            child: const Text('Select', style: TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w600))),
        ]),
      ),
    ],
  );

  Future<void> _submit() async {
    setState(() => _submitting = true);
    await Future.delayed(const Duration(seconds: 1));
    if (!mounted) return;
    setState(() => _submitting = false);
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        backgroundColor: AppColors.bgSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 64, height: 64,
            decoration: BoxDecoration(color: AppColors.success.withValues(alpha: 0.1), shape: BoxShape.circle),
            child: const Icon(Icons.check_circle, color: AppColors.success, size: 36)),
          const SizedBox(height: 16),
          const Text('Request Submitted', style: TextStyle(color: AppColors.textPrimary, fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          const Text('Your leave request has been forwarded to your supervisor for approval.',
            textAlign: TextAlign.center, style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          const SizedBox(height: 20),
          SizedBox(width: double.infinity,
            child: ElevatedButton(
              onPressed: () { Navigator.pop(context); Navigator.pop(context); },
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
              child: const Text('Done', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
        ]),
      ),
    );
  }
}

class _StepIndicator extends StatelessWidget {
  final int current, total;
  final List<String> labels;
  const _StepIndicator({required this.current, required this.total, required this.labels});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
    decoration: BoxDecoration(color: AppColors.bgSurface, border: Border(bottom: BorderSide(color: AppColors.border))),
    child: Row(children: List.generate(total, (i) {
      final done = i < current;
      final active = i == current;
      final color = done || active ? AppColors.primary : AppColors.border;
      return Expanded(child: Row(children: [
        if (i > 0) Expanded(child: Container(height: 2, color: done ? AppColors.primary : AppColors.border)),
        if (i > 0) const SizedBox(width: 8),
        Column(children: [
          Container(width: 28, height: 28,
            decoration: BoxDecoration(
              color: done ? AppColors.primary : (active ? AppColors.primary.withValues(alpha: 0.1) : AppColors.bgDark),
              shape: BoxShape.circle,
              border: Border.all(color: color, width: 2),
            ),
            child: Center(child: done
                ? const Icon(Icons.check, size: 14, color: Colors.white)
                : Text('${i + 1}', style: TextStyle(color: active ? AppColors.primary : AppColors.textMuted, fontSize: 12, fontWeight: FontWeight.w700)))),
          const SizedBox(height: 4),
          Text(labels[i], style: TextStyle(color: active ? AppColors.primary : AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w600)),
        ]),
        if (i < total - 1) const SizedBox(width: 8),
        if (i < total - 1) Expanded(child: Container(height: 2, color: done ? AppColors.primary : AppColors.border)),
      ]));
    })),
  );
}

class _DateField extends StatelessWidget {
  final String label;
  final String? value;
  final VoidCallback onTap;
  const _DateField({required this.label, required this.value, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: value != null ? AppColors.primary.withValues(alpha: 0.4) : AppColors.border)),
      child: Row(children: [
        Icon(Icons.calendar_today_outlined, color: value != null ? AppColors.primary : AppColors.textMuted, size: 16),
        const SizedBox(width: 8),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 9, fontWeight: FontWeight.w600)),
          const SizedBox(height: 2),
          Text(value ?? 'Select date', style: TextStyle(color: value != null ? AppColors.textPrimary : AppColors.textMuted, fontSize: 12, fontWeight: FontWeight.w600)),
        ])),
      ]),
    ),
  );
}

class _PillToggle extends StatelessWidget {
  final List<String> options;
  final String selected;
  final ValueChanged<String> onSelect;
  const _PillToggle({required this.options, required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(2),
    decoration: BoxDecoration(color: AppColors.bgCard, borderRadius: BorderRadius.circular(20)),
    child: Row(mainAxisSize: MainAxisSize.min, children: options.map((o) {
      final active = o == selected;
      return GestureDetector(
        onTap: () => onSelect(o),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: active ? AppColors.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(o, style: TextStyle(color: active ? Colors.white : AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.w600)),
        ),
      );
    }).toList()),
  );
}

class _BottomBar extends StatelessWidget {
  final int step;
  final bool canNext, submitting;
  final VoidCallback? onBack;
  final VoidCallback onNext;
  final int days;
  final String leaveType;

  const _BottomBar({required this.step, required this.canNext, required this.submitting,
    required this.onBack, required this.onNext, required this.days, required this.leaveType});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
    decoration: BoxDecoration(color: AppColors.bgSurface, border: Border(top: BorderSide(color: AppColors.border))),
    child: Row(children: [
      if (onBack != null) ...[
        OutlinedButton(
          onPressed: onBack,
          style: OutlinedButton.styleFrom(foregroundColor: AppColors.textSecondary, side: const BorderSide(color: AppColors.border),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14)),
          child: const Text('Back', style: TextStyle(fontWeight: FontWeight.w600)),
        ),
        const SizedBox(width: 12),
      ],
      Expanded(child: ElevatedButton(
        onPressed: (canNext && !submitting) ? onNext : null,
        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), padding: const EdgeInsets.symmetric(vertical: 14)),
        child: submitting
            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : Text(step == 0 ? 'Continue →' : 'Submit Request', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
      )),
    ]),
  );
}
