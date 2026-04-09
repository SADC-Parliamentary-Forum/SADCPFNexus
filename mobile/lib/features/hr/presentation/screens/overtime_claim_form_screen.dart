import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';

class OvertimeClaimFormScreen extends ConsumerStatefulWidget {
  const OvertimeClaimFormScreen({super.key});

  @override
  ConsumerState<OvertimeClaimFormScreen> createState() =>
      _OvertimeClaimFormScreenState();
}

class _OvertimeClaimFormScreenState
    extends ConsumerState<OvertimeClaimFormScreen> {
  DateTime? _date;
  TimeOfDay? _startTime;
  TimeOfDay? _endTime;
  String _compensation = 'Payment';
  final _reasonCtrl = TextEditingController();
  bool _submitting = false;

  final _compensationOptions = const ['Payment', 'Time Off in Lieu (LIL)'];

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
      builder: (context, child) => Theme(
        data: ThemeData.light().copyWith(
          colorScheme: const ColorScheme.light(primary: AppColors.primary),
        ),
        child: child!,
      ),
    );
    if (d != null) setState(() => _date = d);
  }

  Future<void> _pickTime(bool isStart) async {
    final t = await showTimePicker(
      context: context,
      initialTime: isStart
          ? const TimeOfDay(hour: 17, minute: 0)
          : const TimeOfDay(hour: 20, minute: 0),
      builder: (context, child) => Theme(
        data: ThemeData.light().copyWith(
          colorScheme: const ColorScheme.light(primary: AppColors.primary),
        ),
        child: child!,
      ),
    );
    if (t != null) {
      setState(() => isStart ? _startTime = t : _endTime = t);
    }
  }

  double get _hours {
    if (_startTime == null || _endTime == null) return 0;
    final start = _startTime!.hour * 60 + _startTime!.minute;
    final end = _endTime!.hour * 60 + _endTime!.minute;
    return end > start ? (end - start) / 60.0 : 0;
  }

  bool get _valid =>
      _date != null &&
      _startTime != null &&
      _endTime != null &&
      _reasonCtrl.text.trim().length >= 10 &&
      _hours > 0;

  DateTime _weekStart(DateTime date) =>
      date.subtract(Duration(days: date.weekday - 1));

  DateTime _weekEnd(DateTime date) => _weekStart(date).add(const Duration(days: 6));

  Future<void> _submit() async {
    if (!_valid || _date == null) return;
    setState(() => _submitting = true);
    try {
      final workDate = _date!;
      final weekStart = _weekStart(workDate);
      final weekEnd = _weekEnd(workDate);
      final dio = ref.read(apiClientProvider).dio;
      final createRes = await dio.post<Map<String, dynamic>>(
        '/hr/timesheets',
        data: {
          'week_start': weekStart.toIso8601String().split('T').first,
          'week_end': weekEnd.toIso8601String().split('T').first,
          'entries': [
            {
              'work_date': workDate.toIso8601String().split('T').first,
              'hours': _hours,
              'overtime_hours': _hours,
              'description':
                  '${_reasonCtrl.text.trim()} [Compensation: $_compensation]',
              'activity_type': 'overtime_claim',
              'work_bucket': 'operations',
            }
          ],
        },
      );
      final timesheetId = createRes.data?['data']?['id'];
      if (timesheetId != null) {
        await dio.post('/hr/timesheets/$timesheetId/submit');
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Overtime entry for ${_hours.toStringAsFixed(1)} hrs submitted through timesheets.',
          ),
          backgroundColor: AppColors.success,
        ),
      );
      Navigator.pop(context);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to submit overtime entry.'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hoursStr = _hours > 0 ? '${_hours.toStringAsFixed(1)} hrs' : '-';

    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios_new,
            size: 18,
            color: AppColors.textPrimary,
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Overtime Claim',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.info.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.info.withValues(alpha: 0.2)),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_outline, color: AppColors.info, size: 16),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'This creates and submits a timesheet entry with overtime hours for the selected date.',
                    style: TextStyle(color: AppColors.info, fontSize: 11),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _fieldTile(
            label: 'Date of Overtime',
            value: _date == null
                ? 'Select date'
                : '${_date!.day}/${_date!.month}/${_date!.year}',
            icon: Icons.calendar_today_outlined,
            hasValue: _date != null,
            onTap: _pickDate,
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _fieldTile(
                  label: 'Start Time',
                  value: _startTime == null ? 'Select' : _startTime!.format(context),
                  icon: Icons.schedule_outlined,
                  hasValue: _startTime != null,
                  onTap: () => _pickTime(true),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _fieldTile(
                  label: 'End Time',
                  value: _endTime == null ? 'Select' : _endTime!.format(context),
                  icon: Icons.schedule_outlined,
                  hasValue: _endTime != null,
                  onTap: () => _pickTime(false),
                ),
              ),
            ],
          ),
          if (_hours > 0) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: AppColors.primary.withValues(alpha: 0.2),
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.timer_outlined, color: AppColors.primary, size: 16),
                  const SizedBox(width: 8),
                  Text(
                    'Total: $hoursStr overtime',
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: AppColors.bgSurface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: _compensationOptions
                  .map(
                    (option) => Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _compensation = option),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: _compensation == option
                                ? AppColors.primary
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(9),
                          ),
                          child: Text(
                            option,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: _compensation == option
                                  ? Colors.white
                                  : AppColors.textMuted,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _reasonCtrl,
            maxLines: 4,
            style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
            decoration: InputDecoration(
              hintText: 'Describe the work performed outside normal hours...',
              hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
              filled: true,
              fillColor: AppColors.bgSurface,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 30),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton.icon(
              onPressed: (_valid && !_submitting) ? _submit : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                disabledBackgroundColor: AppColors.bgCard,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              icon: _submitting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.send_outlined, size: 18),
              label: Text(
                _submitting ? 'Submitting...' : 'Submit Overtime',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _fieldTile({
    required String label,
    required String value,
    required IconData icon,
    required bool hasValue,
    required VoidCallback onTap,
  }) =>
      GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: hasValue ? AppColors.primary : AppColors.border,
            ),
          ),
          child: Row(
            children: [
              Icon(icon, color: hasValue ? AppColors.primary : AppColors.textMuted),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: const TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 11,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      value,
                      style: TextStyle(
                        color: hasValue
                            ? AppColors.textPrimary
                            : AppColors.textMuted,
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
      );
}
