import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/offline/draft_database.dart';
import '../../../../core/offline/draft_provider.dart';
import '../../../../core/theme/app_theme.dart';

String _purposeToAdvanceType(String purpose) {
  const map = {
    'Personal Emergency': 'other',
    'Medical Expenses': 'medical',
    'Education': 'school',
    'Home Repair': 'other',
    'Other': 'other',
  };
  return map[purpose] ?? 'other';
}

class SalaryAdvanceRequestScreen extends ConsumerStatefulWidget {
  const SalaryAdvanceRequestScreen({
    super.key,
    this.initialDraft,
    this.draftId,
  });

  final Map<String, dynamic>? initialDraft;
  final int? draftId;

  @override
  ConsumerState<SalaryAdvanceRequestScreen> createState() =>
      _SalaryAdvanceRequestScreenState();
}

class _SalaryAdvanceRequestScreenState
    extends ConsumerState<SalaryAdvanceRequestScreen> {
  final _amountController = TextEditingController();
  bool _loadingContext = true;
  bool _submitting = false;
  bool _savingDraft = false;
  String? _error;
  String _purpose = 'Personal Emergency';
  int _recoveryMonths = 3;
  double _netSalary = 0;
  double _activeAdvances = 0;

  final List<String> _purposes = const [
    'Personal Emergency',
    'Medical Expenses',
    'Education',
    'Home Repair',
    'Other',
  ];

  double get _requestedAmount =>
      double.tryParse(_amountController.text.replaceAll(',', '')) ?? 0;

  double get _cap => _netSalary * 0.5;

  bool get _hasError => _cap > 0 && _requestedAmount > _cap;

  bool get _valid => _requestedAmount > 0 && !_hasError;

  @override
  void initState() {
    super.initState();
    _applyInitialDraft();
    _loadContext();
  }

  void _applyInitialDraft() {
    final draft = widget.initialDraft;
    if (draft == null) return;
    _amountController.text = '${draft['amount'] ?? ''}';
    _purpose = draft['purpose']?.toString() ?? _purpose;
    _recoveryMonths = (draft['repayment_months'] as num?)?.toInt() ?? _recoveryMonths;
  }

  Future<void> _loadContext() async {
    setState(() {
      _loadingContext = true;
      _error = null;
    });

    try {
      final dio = ref.read(apiClientProvider).dio;
      final summaryRes = await dio.get<Map<String, dynamic>>('/finance/summary');
      final advancesRes = await dio.get<Map<String, dynamic>>(
        '/finance/advances',
        queryParameters: {'per_page': 20},
      );

      final summary = summaryRes.data ?? const <String, dynamic>{};
      final advances = (advancesRes.data?['data'] as List<dynamic>? ?? const []);
      if (!mounted) return;

      setState(() {
        _netSalary = _asDouble(summary['current_net_salary']);
        _activeAdvances = advances
            .map((item) => item is Map ? Map<String, dynamic>.from(item) : <String, dynamic>{})
            .where((item) => item['status']?.toString() != 'rejected')
            .fold<double>(0, (sum, item) => sum + _asDouble(item['amount']));
        _loadingContext = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load salary context.';
        _loadingContext = false;
      });
    }
  }

  double _asDouble(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse('$value') ?? 0;
  }

  String _fmt(double value, [String currency = 'NAD']) {
    return '$currency ${value.toStringAsFixed(2)}';
  }

  Future<void> _saveDraft() async {
    setState(() => _savingDraft = true);
    try {
      final db = ref.read(draftDatabaseProvider);
      final payload = {
        'amount': _requestedAmount,
        'purpose': _purpose,
        'repayment_months': _recoveryMonths,
      };
      await db.into(db.draftEntries).insert(
            DraftEntriesCompanion.insert(
              type: 'salary_advance',
              title: _purpose,
              payload: jsonEncode(payload),
              createdAt: DateTime.now(),
            ),
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Draft saved. Sync or continue from Offline Drafts.'),
          backgroundColor: AppColors.success,
        ),
      );
      context.push('/offline/drafts');
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to save draft.'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _savingDraft = false);
    }
  }

  Future<void> _submit() async {
    if (!_valid) return;
    setState(() => _submitting = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      final createRes = await dio.post<Map<String, dynamic>>(
        '/finance/advances',
        data: {
          'advance_type': _purposeToAdvanceType(_purpose),
          'amount': _requestedAmount,
          'currency': 'NAD',
          'repayment_months': _recoveryMonths,
          'purpose': _purpose,
          'justification':
              'Salary advance request for $_purpose. Requested amount: $_requestedAmount. Recovery period: $_recoveryMonths months.',
        },
      );
      final id = createRes.data?['data']?['id'];
      if (widget.draftId != null) {
        final db = ref.read(draftDatabaseProvider);
        await (db.delete(db.draftEntries)
              ..where((t) => t.id.equals(widget.draftId!)))
            .go();
      }
      if (!mounted) return;
      // Navigate to Preview & Sign screen; it will handle the submit step
      context.push('/salary/advance/preview?id=$id');
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to create salary advance request. Please try again.'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: Colors.black87,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'Request Advance',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1A1A1A),
          ),
        ),
        actions: [
          TextButton(
            onPressed: _savingDraft ? null : _saveDraft,
            child: Text(
              _savingDraft ? 'Saving...' : 'Save Draft',
              style: const TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
      body: _loadingContext
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _error!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AppColors.danger),
                        ),
                        const SizedBox(height: 12),
                        TextButton(onPressed: _loadContext, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
                  children: [
                    const Text(
                      'Check Eligibility',
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF1A1A1A),
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'This request uses your live salary context and current active advance exposure.',
                      style: TextStyle(
                        fontSize: 13,
                        color: Color(0xFF666666),
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 20),
                    Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FFF6),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: const Color(0xFF13EC80).withValues(alpha: 0.4),
                        ),
                      ),
                      child: Column(
                        children: [
                          _contextRow('Monthly Net Salary', _fmt(_netSalary)),
                          const Divider(height: 1),
                          _contextRow('Active Advances', _fmt(_activeAdvances)),
                          const Divider(height: 1),
                          _contextRow('Maximum Allowed', _fmt(_cap)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'Requested Amount',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF333333),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _amountController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                      ],
                      decoration: InputDecoration(
                        prefixText: 'NAD ',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        errorText: _hasError
                            ? 'Amount exceeds 50% cap (${_fmt(_cap)}).'
                            : null,
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'Purpose of Advance',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF333333),
                      ),
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _purpose,
                      decoration: InputDecoration(
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      items: _purposes
                          .map(
                            (purpose) => DropdownMenuItem(
                              value: purpose,
                              child: Text(purpose),
                            ),
                          )
                          .toList(),
                      onChanged: (value) {
                        if (value != null) setState(() => _purpose = value);
                      },
                    ),
                    const SizedBox(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Recovery Period',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF333333),
                          ),
                        ),
                        Text(
                          '$_recoveryMonths months',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF13EC80),
                          ),
                        ),
                      ],
                    ),
                    Slider(
                      value: _recoveryMonths.toDouble(),
                      min: 1,
                      max: 12,
                      divisions: 11,
                      onChanged: (value) {
                        setState(() => _recoveryMonths = value.round());
                      },
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF5F5F5),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Text(
                        'Payments will be deducted automatically from future salaries after approval.',
                        style: TextStyle(
                          fontSize: 11,
                          color: Color(0xFF888888),
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xFFEEEEEE))),
        ),
        child: ElevatedButton.icon(
          onPressed: (!_valid || _submitting || _loadingContext) ? null : _submit,
          icon: _submitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.send_outlined, size: 18),
          label: Text(_submitting ? 'Submitting...' : 'Submit Request'),
          style: ElevatedButton.styleFrom(
            backgroundColor:
                _valid ? const Color(0xFF13EC80) : const Color(0xFFCCCCCC),
            foregroundColor:
                _valid ? const Color(0xFF102219) : const Color(0xFF888888),
            minimumSize: const Size(double.infinity, 52),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
        ),
      ),
    );
  }

  Widget _contextRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontSize: 12, color: Color(0xFF666666)),
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: Color(0xFF1A1A1A),
            ),
          ),
        ],
      ),
    );
  }
}
