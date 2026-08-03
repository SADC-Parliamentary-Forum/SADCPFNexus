import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/core/theme/app_theme.dart';
import 'package:sadcpf_nexus/features/procurement/data/procurement_api_helpers.dart';

class AssignmentCreateScreen extends ConsumerStatefulWidget {
  const AssignmentCreateScreen({super.key});

  @override
  ConsumerState<AssignmentCreateScreen> createState() =>
      _AssignmentCreateScreenState();
}

class _AssignmentCreateScreenState
    extends ConsumerState<AssignmentCreateScreen> {
  final _formKey = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _description = TextEditingController();
  DateTime _due = DateTime.now().add(const Duration(days: 7));
  String _priority = 'medium';
  int? _selectedAssigneeId;
  bool _loadingAssignees = true;
  bool _submitting = false;
  List<_AssigneeOption> _assigneeOptions = [];

  @override
  void initState() {
    super.initState();
    _loadAssignees();
  }

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _loadAssignees() async {
    try {
      final res =
          await ref.read(apiClientProvider).dio.get('/assignments/capacity');
      final rows = extractListData(res.data);
      final options = rows
          .map(_AssigneeOption.fromMap)
          .whereType<_AssigneeOption>()
          .toList();
      if (!mounted) return;
      setState(() {
        _assigneeOptions = options;
        _loadingAssignees = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingAssignees = false);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    setState(() => _submitting = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      final body = <String, dynamic>{
        'title': _title.text.trim(),
        'description': _description.text.trim(),
        'priority': _priority,
        'due_date': _due.toIso8601String().split('T').first,
      };
      if (_selectedAssigneeId != null) {
        body['assigned_to'] = _selectedAssigneeId;
      }

      final res = await dio.post('/assignments', data: body);
      final data = res.data;
      int? id;
      if (data is Map && data['data'] is Map) {
        id = (data['data'] as Map)['id'] as int?;
      }
      if (!mounted) return;
      if (id != null) {
        context.go('/assignments/$id');
      } else {
        context.pop();
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not create assignment.')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        title: const Text('New assignment',
            style: TextStyle(
                color: AppColors.textPrimary, fontWeight: FontWeight.w800)),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _title,
              style: const TextStyle(color: AppColors.textPrimary),
              decoration: const InputDecoration(labelText: 'Title'),
              validator: (value) => value == null || value.trim().isEmpty
                  ? 'Title is required.'
                  : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _description,
              maxLines: 4,
              style: const TextStyle(color: AppColors.textPrimary),
              decoration: const InputDecoration(labelText: 'Description'),
              validator: (value) => value == null || value.trim().isEmpty
                  ? 'Description is required.'
                  : null,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<int>(
              value: _selectedAssigneeId,
              dropdownColor: AppColors.bgSurface,
              decoration: InputDecoration(
                labelText: 'Assignee',
                helperText: _loadingAssignees
                    ? 'Loading assignees...'
                    : 'Optional. Choose a known person instead of typing an ID.',
              ),
              items: _assigneeOptions
                  .map((option) => DropdownMenuItem<int>(
                        value: option.id,
                        child: Text(option.label),
                      ))
                  .toList(),
              onChanged: _loadingAssignees
                  ? null
                  : (v) => setState(() => _selectedAssigneeId = v),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _priority,
              dropdownColor: AppColors.bgSurface,
              decoration: const InputDecoration(labelText: 'Priority'),
              items: const [
                DropdownMenuItem(value: 'low', child: Text('Low')),
                DropdownMenuItem(value: 'medium', child: Text('Medium')),
                DropdownMenuItem(value: 'high', child: Text('High')),
                DropdownMenuItem(value: 'urgent', child: Text('Urgent')),
                DropdownMenuItem(value: 'critical', child: Text('Critical')),
              ],
              onChanged: (v) => setState(() => _priority = v ?? 'medium'),
            ),
            const SizedBox(height: 12),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Due date',
                  style: TextStyle(color: AppColors.textSecondary)),
              subtitle: Text(_due.toIso8601String().split('T').first,
                  style: const TextStyle(color: AppColors.textPrimary)),
              trailing:
                  const Icon(Icons.calendar_today, color: AppColors.textMuted),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _due,
                  firstDate: DateTime.now(),
                  lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
                );
                if (picked != null) setState(() => _due = picked);
              },
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _submitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  minimumSize: const Size.fromHeight(48)),
              child: Text(_submitting ? 'Saving...' : 'Create',
                  style: const TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }
}

class _AssigneeOption {
  const _AssigneeOption({required this.id, required this.label});

  final int id;
  final String label;

  static _AssigneeOption? fromMap(Map<String, dynamic> row) {
    final rawId = row['user_id'] ?? row['id'] ?? row['assignee_id'];
    final id = rawId is int ? rawId : int.tryParse(rawId?.toString() ?? '');
    if (id == null) return null;
    final label = row['name'] ??
        row['user_name'] ??
        row['assignee'] ??
        row['employee_name'] ??
        'User $id';
    return _AssigneeOption(id: id, label: label.toString());
  }
}
