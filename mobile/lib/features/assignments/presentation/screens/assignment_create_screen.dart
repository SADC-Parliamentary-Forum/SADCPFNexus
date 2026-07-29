import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/core/theme/app_theme.dart';

class AssignmentCreateScreen extends ConsumerStatefulWidget {
  const AssignmentCreateScreen({super.key});

  @override
  ConsumerState<AssignmentCreateScreen> createState() =>
      _AssignmentCreateScreenState();
}

class _AssignmentCreateScreenState
    extends ConsumerState<AssignmentCreateScreen> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _assigneeId = TextEditingController();
  DateTime _due = DateTime.now().add(const Duration(days: 7));
  String _priority = 'medium';
  bool _submitting = false;

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _assigneeId.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_title.text.trim().isEmpty || _description.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Title and description are required.')),
      );
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
      final assignee = int.tryParse(_assigneeId.text.trim());
      if (assignee != null) body['assigned_to'] = assignee;

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
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _title,
            style: const TextStyle(color: AppColors.textPrimary),
            decoration: const InputDecoration(labelText: 'Title'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _description,
            maxLines: 4,
            style: const TextStyle(color: AppColors.textPrimary),
            decoration: const InputDecoration(labelText: 'Description'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _assigneeId,
            keyboardType: TextInputType.number,
            style: const TextStyle(color: AppColors.textPrimary),
            decoration: const InputDecoration(
                labelText: 'Assignee user id (optional)'),
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
            trailing: const Icon(Icons.calendar_today,
                color: AppColors.textMuted),
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
            child: Text(_submitting ? 'Saving…' : 'Create',
                style: const TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }
}
