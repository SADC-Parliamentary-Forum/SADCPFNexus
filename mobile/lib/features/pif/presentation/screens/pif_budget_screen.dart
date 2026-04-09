import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';

class PifBudgetScreen extends ConsumerStatefulWidget {
  const PifBudgetScreen({super.key, this.programmeId});

  final String? programmeId;

  @override
  ConsumerState<PifBudgetScreen> createState() => _PifBudgetScreenState();
}

class _PifBudgetScreenState extends ConsumerState<PifBudgetScreen> {
  String? _selectedLineKey;
  final _amountCtrl = TextEditingController();
  final _justCtrl = TextEditingController();
  bool _loading = true;
  bool _submitting = false;
  String? _error;
  Map<String, dynamic>? _programme;
  List<Map<String, dynamic>> _availableLines = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final programmeId = widget.programmeId;
    if (programmeId == null || programmeId.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Missing programme ID.';
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final dio = ref.read(apiClientProvider).dio;
      final programmeRes =
          await dio.get<Map<String, dynamic>>('/programmes/$programmeId');
      final budgetsRes = await dio.get<Map<String, dynamic>>('/finance/budgets');

      final budgets = ((budgetsRes.data?['data'] as List<dynamic>?) ?? const []);
      final lines = <Map<String, dynamic>>[];
      for (final budget in budgets) {
        if (budget is! Map) continue;
        final budgetMap = Map<String, dynamic>.from(budget);
        final rawLines = budgetMap['lines'] as List<dynamic>? ?? const [];
        for (final rawLine in rawLines) {
          if (rawLine is! Map) continue;
          final line = Map<String, dynamic>.from(rawLine);
          lines.add({
            'key': '${budgetMap['id']}-${line['id']}',
            'budget_name': budgetMap['name'],
            'category': line['category'],
            'description': line['description'],
            'account_code': line['account_code'],
            'available': (line['amount_allocated'] ?? 0) - (line['amount_spent'] ?? 0),
          });
        }
      }

      if (!mounted) return;
      setState(() {
        _programme = programmeRes.data == null
            ? <String, dynamic>{}
            : Map<String, dynamic>.from(programmeRes.data as Map);
        _availableLines = lines;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load programme budgets.';
        _loading = false;
      });
    }
  }

  bool get _valid =>
      _selectedLineKey != null &&
      _amountCtrl.text.trim().isNotEmpty &&
      _justCtrl.text.trim().length >= 10;

  double _asDouble(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse('$value') ?? 0;
  }

  Future<void> _submit() async {
    final programmeId = widget.programmeId;
    Map<String, dynamic>? selectedLine;
    for (final line in _availableLines) {
      if (line['key'] == _selectedLineKey) {
        selectedLine = line;
        break;
      }
    }
    if (!_valid || programmeId == null || selectedLine == null) return;

    setState(() => _submitting = true);
    try {
      await ref.read(apiClientProvider).dio.post(
            '/programmes/$programmeId/budget-lines',
            data: {
              'category': selectedLine['category']?.toString() ?? 'Budget Line',
              'description':
                  '${selectedLine['description'] ?? ''}\n${_justCtrl.text.trim()}'.trim(),
              'amount': _asDouble(_amountCtrl.text),
              'account_code': selectedLine['account_code']?.toString(),
              'funding_source': selectedLine['budget_name']?.toString(),
            },
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Budget line committed to programme.'),
          backgroundColor: AppColors.success,
        ),
      );
      Navigator.pop(context);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to commit budget line.'),
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
    _amountCtrl.dispose();
    _justCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
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
          'PIF Budget Commitment',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      body: _loading
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
                        TextButton(onPressed: _load, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            AppColors.primary.withValues(alpha: 0.12),
                            AppColors.bgCard,
                          ],
                        ),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: AppColors.primary.withValues(alpha: 0.2),
                        ),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.account_balance_outlined,
                            color: AppColors.primary,
                            size: 20,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _programme?['reference_number']?.toString() ?? '-',
                                  style: const TextStyle(
                                    color: AppColors.textPrimary,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                Text(
                                  _programme?['title']?.toString() ?? 'Programme',
                                  style: const TextStyle(
                                    color: AppColors.textMuted,
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'SELECT BUDGET LINE',
                      style: TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.8,
                      ),
                    ),
                    const SizedBox(height: 10),
                    if (_availableLines.isEmpty)
                      const Text(
                        'No finance budget lines available.',
                        style: TextStyle(color: AppColors.textSecondary),
                      )
                    else
                      ..._availableLines.map((line) {
                        final isSelected = _selectedLineKey == line['key'];
                        return GestureDetector(
                          onTap: () => setState(() => _selectedLineKey = line['key']?.toString()),
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? AppColors.primary.withValues(alpha: 0.08)
                                  : AppColors.bgSurface,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isSelected ? AppColors.primary : AppColors.border,
                                width: isSelected ? 1.5 : 1,
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  line['category']?.toString() ?? 'Budget Line',
                                  style: TextStyle(
                                    color: isSelected
                                        ? AppColors.primary
                                        : AppColors.textPrimary,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '${line['budget_name']} · ${line['account_code'] ?? '-'}',
                                  style: const TextStyle(
                                    color: AppColors.textMuted,
                                    fontSize: 10,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Available: NAD ${_asDouble(line['available']).toStringAsFixed(2)}',
                                  style: const TextStyle(
                                    color: AppColors.success,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }),
                    const SizedBox(height: 20),
                    TextField(
                      controller: _amountCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                      decoration: InputDecoration(
                        labelText: 'Committed Amount',
                        labelStyle: const TextStyle(color: AppColors.textMuted),
                        filled: true,
                        fillColor: AppColors.bgSurface,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                    const SizedBox(height: 20),
                    TextField(
                      controller: _justCtrl,
                      maxLines: 4,
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                      decoration: InputDecoration(
                        labelText: 'Justification',
                        labelStyle: const TextStyle(color: AppColors.textMuted),
                        filled: true,
                        fillColor: AppColors.bgSurface,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
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
                            : const Icon(Icons.link_outlined, size: 18),
                        label: Text(
                          _submitting ? 'Committing...' : 'Commit Budget',
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
