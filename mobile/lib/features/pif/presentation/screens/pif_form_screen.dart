import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/offline/draft_database.dart';
import '../../../../core/offline/draft_provider.dart';
import '../../../../core/router/safe_back.dart';
import '../../../../core/theme/app_theme.dart';

class _BudgetLineInput {
  _BudgetLineInput({
    String category = '',
    String description = '',
    String amount = '',
  })  : categoryController = TextEditingController(text: category),
        descriptionController = TextEditingController(text: description),
        amountController = TextEditingController(text: amount);

  final TextEditingController categoryController;
  final TextEditingController descriptionController;
  final TextEditingController amountController;

  Map<String, dynamic>? toPayload() {
    final category = categoryController.text.trim();
    final description = descriptionController.text.trim();
    final amount = double.tryParse(amountController.text.trim());
    if (category.isEmpty || description.isEmpty || amount == null || amount <= 0) {
      return null;
    }
    return {
      'category': category,
      'description': description,
      'amount': amount,
    };
  }

  void dispose() {
    categoryController.dispose();
    descriptionController.dispose();
    amountController.dispose();
  }
}

class PifFormScreen extends ConsumerStatefulWidget {
  const PifFormScreen({
    super.key,
    this.initialDraft,
    this.draftId,
  });

  final Map<String, dynamic>? initialDraft;
  final int? draftId;

  @override
  ConsumerState<PifFormScreen> createState() => _PifFormScreenState();
}

class _PifFormScreenState extends ConsumerState<PifFormScreen> {
  final _titleController = TextEditingController();
  final _objectiveController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _locationController = TextEditingController();
  final _leadOfficerController = TextEditingController();
  final List<_BudgetLineInput> _budgetLines = [];
  bool _savingDraft = false;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _applyInitialDraft();
    if (_budgetLines.isEmpty) {
      _budgetLines.add(_BudgetLineInput());
    }
  }

  void _applyInitialDraft() {
    final draft = widget.initialDraft;
    if (draft == null) return;

    _titleController.text = draft['title']?.toString() ?? '';
    _objectiveController.text = draft['overall_objective']?.toString() ?? '';
    _descriptionController.text = draft['background']?.toString() ?? '';
    _locationController.text = draft['location']?.toString() ?? '';
    _leadOfficerController.text = draft['lead_officer']?.toString() ?? '';

    final lines = draft['budget_lines'] as List<dynamic>? ?? const [];
    for (final line in lines) {
      if (line is! Map) continue;
      _budgetLines.add(
        _BudgetLineInput(
          category: line['category']?.toString() ?? '',
          description: line['description']?.toString() ?? '',
          amount: line['amount']?.toString() ?? '',
        ),
      );
    }
  }

  List<Map<String, dynamic>> get _budgetLinePayloads {
    return _budgetLines
        .map((line) => line.toPayload())
        .whereType<Map<String, dynamic>>()
        .toList();
  }

  bool get _valid =>
      _titleController.text.trim().isNotEmpty &&
      _objectiveController.text.trim().isNotEmpty &&
      _locationController.text.trim().isNotEmpty &&
      _budgetLinePayloads.isNotEmpty;

  double get _totalBudget => _budgetLinePayloads.fold<double>(
        0,
        (sum, item) => sum + ((item['amount'] as num?)?.toDouble() ?? 0),
      );

  Future<void> _saveDraft() async {
    setState(() => _savingDraft = true);
    try {
      final payload = {
        'title': _titleController.text.trim(),
        'overall_objective': _objectiveController.text.trim(),
        'background': _descriptionController.text.trim(),
        'location': _locationController.text.trim(),
        'lead_officer': _leadOfficerController.text.trim(),
        'budget_lines': _budgetLinePayloads,
      };

      final db = ref.read(draftDatabaseProvider);
      await db.into(db.draftEntries).insert(
            DraftEntriesCompanion.insert(
              type: 'pif',
              title: _titleController.text.trim().isEmpty
                  ? 'PIF draft'
                  : _titleController.text.trim(),
              payload: jsonEncode(payload),
              createdAt: DateTime.now(),
            ),
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Draft saved. Continue later from Offline Drafts.'),
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
      final createRes = await dio.post<Map<String, dynamic>>('/programmes', data: {
        'title': _titleController.text.trim(),
        'background': _descriptionController.text.trim().isEmpty
            ? null
            : _descriptionController.text.trim(),
        'overall_objective': _objectiveController.text.trim(),
        'primary_currency': 'NAD',
        'total_budget': _totalBudget,
        'funding_source': 'SADC PF',
        'member_states': [_locationController.text.trim()],
        'budget_lines': _budgetLinePayloads,
      });
      final id = createRes.data?['data']?['id'];
      if (id != null) {
        await dio.post('/programmes/$id/submit');
      }
      if (widget.draftId != null) {
        final db = ref.read(draftDatabaseProvider);
        await (db.delete(db.draftEntries)
              ..where((t) => t.id.equals(widget.draftId!)))
            .go();
      }
      if (!mounted) return;
      context.safePopOrGoHome();
      if (id != null) {
        context.push('/pif/review?id=$id');
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('PIF submitted for review.'),
          backgroundColor: AppColors.success,
        ),
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to submit PIF. Please try again.'),
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
    _titleController.dispose();
    _objectiveController.dispose();
    _descriptionController.dispose();
    _locationController.dispose();
    _leadOfficerController.dispose();
    for (final line in _budgetLines) {
      line.dispose();
    }
    super.dispose();
  }

  void _addBudgetLine() {
    setState(() => _budgetLines.add(_BudgetLineInput()));
  }

  void _removeBudgetLine(int index) {
    if (_budgetLines.length == 1) return;
    setState(() {
      final line = _budgetLines.removeAt(index);
      line.dispose();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        leading: IconButton(
          icon: const Icon(Icons.close, color: AppColors.textPrimary),
          onPressed: () => context.safePopOrGoHome(),
        ),
        title: const Text(
          'Programme Initiation Form',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 16,
            fontWeight: FontWeight.w700,
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
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          _sectionTitle('Programme Details'),
          const SizedBox(height: 10),
          _textField(_titleController, 'Programme Title'),
          const SizedBox(height: 10),
          _textField(_objectiveController, 'Strategic Objective'),
          const SizedBox(height: 10),
          _textField(_locationController, 'Location / Member State'),
          const SizedBox(height: 10),
          _textField(_leadOfficerController, 'Lead Officer'),
          const SizedBox(height: 10),
          _textField(
            _descriptionController,
            'Background / Description',
            maxLines: 4,
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              _sectionTitle('Budget Lines'),
              const Spacer(),
              TextButton.icon(
                onPressed: _addBudgetLine,
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Add Line'),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ..._budgetLines.asMap().entries.map((entry) {
            final index = entry.key;
            final line = entry.value;
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Text(
                        'Line ${index + 1}',
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const Spacer(),
                      IconButton(
                        onPressed: () => _removeBudgetLine(index),
                        icon: const Icon(
                          Icons.delete_outline,
                          color: AppColors.danger,
                        ),
                      ),
                    ],
                  ),
                  _textField(line.categoryController, 'Category'),
                  const SizedBox(height: 10),
                  _textField(line.descriptionController, 'Description'),
                  const SizedBox(height: 10),
                  _textField(
                    line.amountController,
                    'Amount',
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.bgSurface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                const Text(
                  'Total Budget',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                  ),
                ),
                const Spacer(),
                Text(
                  'NAD ${_totalBudget.toStringAsFixed(2)}',
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        decoration: const BoxDecoration(
          color: AppColors.bgDark,
          border: Border(top: BorderSide(color: AppColors.border)),
        ),
        child: ElevatedButton.icon(
          onPressed: (!_valid || _submitting) ? null : _submit,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: AppColors.bgDark,
            minimumSize: const Size(double.infinity, 52),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          icon: _submitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.bgDark,
                  ),
                )
              : const Icon(Icons.send_outlined),
          label: Text(_submitting ? 'Submitting...' : 'Submit PIF'),
        ),
      ),
    );
  }

  Widget _sectionTitle(String title) => Text(
        title,
        style: const TextStyle(
          color: AppColors.textPrimary,
          fontSize: 15,
          fontWeight: FontWeight.w700,
        ),
      );

  Widget _textField(
    TextEditingController controller,
    String label, {
    int maxLines = 1,
    TextInputType? keyboardType,
  }) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      keyboardType: keyboardType,
      style: const TextStyle(color: AppColors.textPrimary),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: AppColors.textMuted),
        filled: true,
        fillColor: AppColors.bgSurface,
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
          borderSide: const BorderSide(color: AppColors.primary),
        ),
      ),
      onChanged: (_) => setState(() {}),
    );
  }
}
