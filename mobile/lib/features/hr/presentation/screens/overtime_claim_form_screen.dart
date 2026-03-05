import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class OvertimeClaimFormScreen extends StatefulWidget {
  const OvertimeClaimFormScreen({super.key});

  @override
  State<OvertimeClaimFormScreen> createState() => _OvertimeClaimFormScreenState();
}

class _OvertimeClaimFormScreenState extends State<OvertimeClaimFormScreen> {
  DateTime? _date;
  TimeOfDay? _startTime;
  TimeOfDay? _endTime;
  String _compensation = 'Payment';
  final _reasonCtrl = TextEditingController();
  bool _submitting = false;

  final _compensationOptions = ['Payment', 'Time Off in Lieu (LIL)'];

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final d = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime.now().subtract(const Duration(days: 90)),
      lastDate: DateTime.now(),
      builder: (context, child) => Theme(data: ThemeData.light().copyWith(
        colorScheme: const ColorScheme.light(primary: AppColors.primary),
      ), child: child!),
    );
    if (d != null) setState(() => _date = d);
  }

  Future<void> _pickTime(bool isStart) async {
    final t = await showTimePicker(
      context: context,
      initialTime: isStart ? const TimeOfDay(hour: 17, minute: 0) : const TimeOfDay(hour: 20, minute: 0),
      builder: (context, child) => Theme(data: ThemeData.light().copyWith(
        colorScheme: const ColorScheme.light(primary: AppColors.primary),
      ), child: child!),
    );
    if (t != null) setState(() => isStart ? _startTime = t : _endTime = t);
  }

  double get _hours {
    if (_startTime == null || _endTime == null) return 0;
    final start = _startTime!.hour * 60 + _startTime!.minute;
    final end = _endTime!.hour * 60 + _endTime!.minute;
    return end > start ? (end - start) / 60.0 : 0;
  }

  bool get _valid => _date != null && _startTime != null && _endTime != null && _reasonCtrl.text.trim().length >= 10 && _hours > 0;

  void _submit() {
    if (!_valid) return;
    setState(() => _submitting = true);
    Future.delayed(const Duration(milliseconds: 1200), () {
      if (!mounted) return;
      setState(() => _submitting = false);
      showDialog(context: context, builder: (_) => AlertDialog(
        backgroundColor: AppColors.bgSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 56, height: 56,
            decoration: BoxDecoration(color: AppColors.success.withValues(alpha: 0.1), shape: BoxShape.circle),
            child: const Icon(Icons.check_circle, color: AppColors.success, size: 28)),
          const SizedBox(height: 12),
          const Text('Claim Submitted', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text('Your overtime claim for ${_hours.toStringAsFixed(1)} hrs has been sent for approval.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
        ]),
        actions: [
          TextButton(
            onPressed: () { Navigator.pop(context); Navigator.pop(context); },
            child: const Text('Done', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700)),
          ),
        ],
      ));
    });
  }

  @override
  Widget build(BuildContext context) {
    final hoursStr = _hours > 0 ? '${_hours.toStringAsFixed(1)} hrs' : '—';

    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('Overtime Claim', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Info banner
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.info.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.info.withValues(alpha: 0.2)),
            ),
            child: const Row(children: [
              Icon(Icons.info_outline, color: AppColors.info, size: 16),
              SizedBox(width: 10),
              Expanded(child: Text('Claims must be submitted within 30 days of the work performed. Approval by line manager required.',
                style: TextStyle(color: AppColors.info, fontSize: 11))),
            ]),
          ),
          const SizedBox(height: 20),

          const Text('DATE & TIME', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 10),

          // Date picker
          _fieldTile(
            label: 'Date of Overtime',
            value: _date == null ? 'Select date' : '${_date!.day}/${_date!.month}/${_date!.year}',
            icon: Icons.calendar_today_outlined,
            hasValue: _date != null,
            onTap: _pickDate,
          ),
          const SizedBox(height: 10),

          // Time pickers
          Row(children: [
            Expanded(child: _fieldTile(
              label: 'Start Time',
              value: _startTime == null ? 'Select' : _startTime!.format(context),
              icon: Icons.schedule_outlined,
              hasValue: _startTime != null,
              onTap: () => _pickTime(true),
            )),
            const SizedBox(width: 10),
            Expanded(child: _fieldTile(
              label: 'End Time',
              value: _endTime == null ? 'Select' : _endTime!.format(context),
              icon: Icons.schedule_outlined,
              hasValue: _endTime != null,
              onTap: () => _pickTime(false),
            )),
          ]),

          if (_hours > 0) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.primary.withValues(alpha: 0.2))),
              child: Row(children: [
                const Icon(Icons.timer_outlined, color: AppColors.primary, size: 16),
                const SizedBox(width: 8),
                Text('Total: $hoursStr overtime', style: const TextStyle(color: AppColors.primary, fontSize: 13, fontWeight: FontWeight.w700)),
              ]),
            ),
          ],

          const SizedBox(height: 20),
          const Text('COMPENSATION TYPE', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 10),

          // Compensation toggle
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
            child: Row(children: _compensationOptions.map((opt) => Expanded(
              child: GestureDetector(
                onTap: () => setState(() => _compensation = opt),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: _compensation == opt ? AppColors.primary : Colors.transparent,
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: Text(opt, textAlign: TextAlign.center,
                    style: TextStyle(
                      color: _compensation == opt ? Colors.white : AppColors.textMuted,
                      fontSize: 12, fontWeight: FontWeight.w600)),
                ),
              ),
            )).toList()),
          ),
          const SizedBox(height: 20),

          const Text('REASON & JUSTIFICATION', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 10),

          TextField(
            controller: _reasonCtrl,
            maxLines: 4,
            style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
            decoration: InputDecoration(
              hintText: 'Describe the work performed outside normal hours...',
              hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
              filled: true,
              fillColor: AppColors.bgSurface,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
              contentPadding: const EdgeInsets.all(14),
            ),
            onChanged: (_) => setState(() {}),
          ),

          const SizedBox(height: 20),
          const Text('AUTHORISATION', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 10),

          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
            child: const Row(children: [
              Icon(Icons.person_outline, color: AppColors.textMuted, size: 18),
              SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Line Manager', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
                Text('James Mwape', style: TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
              ])),
              Icon(Icons.check_circle, color: AppColors.success, size: 18),
            ]),
          ),
          const SizedBox(height: 30),

          // Submit
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton.icon(
              onPressed: (_valid && !_submitting) ? _submit : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                disabledBackgroundColor: AppColors.bgCard,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              icon: _submitting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.send_outlined, size: 18),
              label: Text(_submitting ? 'Submitting...' : 'Submit Claim',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _fieldTile({required String label, required String value, required IconData icon, required bool hasValue, required VoidCallback onTap}) =>
    GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Row(children: [
            Icon(icon, color: hasValue ? AppColors.primary : AppColors.textMuted, size: 16),
            const SizedBox(width: 8),
            Text(value, style: TextStyle(color: hasValue ? AppColors.textPrimary : AppColors.textMuted,
              fontSize: 13, fontWeight: hasValue ? FontWeight.w600 : FontWeight.normal)),
          ]),
        ]),
      ),
    );
}
