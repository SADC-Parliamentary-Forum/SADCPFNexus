import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';

/// Upload Public Holidays (SADC region) and UN Days via API.
class CalendarUploadScreen extends ConsumerStatefulWidget {
  const CalendarUploadScreen({super.key});

  @override
  ConsumerState<CalendarUploadScreen> createState() => _CalendarUploadScreenState();
}

class _CalendarUploadScreenState extends ConsumerState<CalendarUploadScreen> {
  int _tabIndex = 0; // 0 = single, 1 = bulk
  String _type = 'sadc_holiday';
  String? _countryCode = 'NA';
  DateTime? _date;
  final _titleCtrl = TextEditingController();
  final _bulkCtrl = TextEditingController();
  bool _submitting = false;
  String? _success;
  String? _error;

  static const _sadcCountryCodes = {
    'NA': 'Namibia (LIL uses NA only)',
    'ZA': 'South Africa',
    'ZW': 'Zimbabwe',
    'BW': 'Botswana',
    'MZ': 'Mozambique',
    'ZM': 'Zambia',
    'MW': 'Malawi',
    'TZ': 'Tanzania',
    'AO': 'Angola',
  };

  @override
  void dispose() {
    _titleCtrl.dispose();
    _bulkCtrl.dispose();
    super.dispose();
  }

  Future<void> _submitSingle() async {
    if (_date == null || _titleCtrl.text.trim().isEmpty) {
      setState(() {
        _error = 'Date and title are required.';
        _success = null;
      });
      return;
    }
    if (_type == 'sadc_holiday' && (_countryCode == null || _countryCode!.isEmpty)) {
      setState(() {
        _error = 'Country is required for public holidays.';
        _success = null;
      });
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
      _success = null;
    });
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.post<Map<String, dynamic>>('/calendar/entries', data: {
        'type': _type,
        'country_code': _type == 'un_day' ? null : _countryCode,
        'date': _date!.toIso8601String().split('T').first,
        'title': _titleCtrl.text.trim(),
        'is_alert': _type == 'un_day',
      });
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _success = 'Entry created.';
        _titleCtrl.clear();
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'Failed to create entry.';
      });
    }
  }

  Future<void> _submitBulk() async {
    final jsonStr = _bulkCtrl.text.trim();
    if (jsonStr.isEmpty) {
      setState(() {
        _error = 'Paste JSON with entries array.';
        _success = null;
      });
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
      _success = null;
    });
    try {
      final decoded = jsonDecode(jsonStr) as Map<String, dynamic>;
      final entries = decoded['entries'] as List?;
      if (entries == null || entries.isEmpty) {
        throw Exception('entries array required');
      }
      final dio = ref.read(apiClientProvider).dio;
      await dio.post<Map<String, dynamic>>('/calendar/entries/upload', data: decoded);
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _success = '${entries.length} entries created.';
        _bulkCtrl.clear();
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'Invalid JSON or upload failed. Check format.';
      });
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
          icon: const Icon(Icons.arrow_back_ios_new, color: AppColors.textPrimary, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'Upload Holidays & UN Days',
          style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SegmentedButton<int>(
            segments: const [
              ButtonSegment(value: 0, label: Text('Single'), icon: Icon(Icons.add_circle_outline)),
              ButtonSegment(value: 1, label: Text('Bulk'), icon: Icon(Icons.upload_file)),
            ],
            selected: {_tabIndex},
            onSelectionChanged: (s) => setState(() {
              _tabIndex = s.first;
              _error = null;
              _success = null;
            }),
            style: ButtonStyle(
              backgroundColor: WidgetStateProperty.resolveWith((states) =>
                  states.contains(WidgetState.selected) ? AppColors.primary.withValues(alpha: 0.2) : null),
            ),
          ),
          const SizedBox(height: 20),
          if (_tabIndex == 0) _buildSingleForm() else _buildBulkForm(),
          if (_error != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.danger.withValues(alpha: 0.3)),
              ),
              child: Row(children: [
                const Icon(Icons.error_outline, color: AppColors.danger, size: 20),
                const SizedBox(width: 8),
                Expanded(child: Text(_error!, style: const TextStyle(color: AppColors.danger))),
              ]),
            ),
          ],
          if (_success != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.success.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
              ),
              child: Row(children: [
                const Icon(Icons.check_circle_outline, color: AppColors.success, size: 20),
                const SizedBox(width: 8),
                Expanded(child: Text(_success!, style: const TextStyle(color: AppColors.success))),
              ]),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSingleForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text('Type', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
        const SizedBox(height: 6),
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'sadc_holiday', label: Text('Public Holiday')),
            ButtonSegment(value: 'un_day', label: Text('UN Day')),
          ],
          selected: {_type},
          onSelectionChanged: (s) => setState(() {
            _type = s.first;
            if (_type == 'un_day') {
              _countryCode = null;
            } else {
              _countryCode ??= 'NA';
            }
          }),
          style: ButtonStyle(
            backgroundColor: WidgetStateProperty.resolveWith((states) =>
                states.contains(WidgetState.selected) ? AppColors.primary.withValues(alpha: 0.2) : null),
          ),
        ),
        if (_type == 'sadc_holiday') ...[
          const SizedBox(height: 16),
          const Text('Country (LIL uses Namibia only)', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            value: _countryCode ?? 'NA',
            decoration: InputDecoration(
              filled: true,
              fillColor: AppColors.bgSurface,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
            items: _sadcCountryCodes.entries.map((e) =>
                DropdownMenuItem(value: e.key, child: Text(e.value))).toList(),
            onChanged: (v) => setState(() => _countryCode = v ?? 'NA'),
          ),
        ],
        const SizedBox(height: 16),
        const Text('Date', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
        const SizedBox(height: 6),
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(_date != null ? '${_date!.day}/${_date!.month}/${_date!.year}' : 'Pick date', style: TextStyle(color: _date != null ? AppColors.textPrimary : AppColors.textMuted)),
          trailing: const Icon(Icons.calendar_today, color: AppColors.primary),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          tileColor: AppColors.bgSurface,
          onTap: () async {
            final p = await showDatePicker(
              context: context,
              initialDate: _date ?? DateTime.now(),
              firstDate: DateTime(2020),
              lastDate: DateTime(2030),
            );
            if (p != null) setState(() => _date = p);
          },
        ),
        const SizedBox(height: 16),
        const Text('Title', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
        const SizedBox(height: 6),
        TextField(
          controller: _titleCtrl,
          decoration: InputDecoration(
            hintText: 'e.g. Independence Day',
            filled: true,
            fillColor: AppColors.bgSurface,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          ),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 24),
        FilledButton.icon(
          onPressed: _submitting ? null : _submitSingle,
          icon: _submitting ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.add),
          label: Text(_submitting ? 'Creating…' : 'Add Entry'),
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      ],
    );
  }

  Widget _buildBulkForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text('Paste JSON with entries array. Public holidays: use country_code (NA, ZA, ZW, etc.). UN days: type un_day, no country_code.',
            style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
        const SizedBox(height: 12),
        TextField(
          controller: _bulkCtrl,
          maxLines: 12,
          decoration: InputDecoration(
            hintText: '{\n  "entries": [\n    {"type": "sadc_holiday", "country_code": "NA", "date": "2025-03-21", "title": "Independence Day"},\n    {"type": "un_day", "date": "2025-03-08", "title": "International Women\'s Day", "is_alert": true}\n  ]\n}',
            filled: true,
            fillColor: AppColors.bgSurface,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            contentPadding: const EdgeInsets.all(14),
          ),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 24),
        FilledButton.icon(
          onPressed: _submitting ? null : _submitBulk,
          icon: _submitting ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.upload),
          label: Text(_submitting ? 'Uploading…' : 'Upload'),
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      ],
    );
  }
}
