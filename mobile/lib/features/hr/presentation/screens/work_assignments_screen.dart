import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';

Response<dynamic> _emptyResponse() => Response<dynamic>(
      requestOptions: RequestOptions(path: '/'),
      data: null,
      statusCode: 500,
    );

Color _priorityColor(String? priority) {
  switch (priority?.toLowerCase()) {
    case 'critical':
      return Colors.red[700]!;
    case 'high':
      return Colors.orange[700]!;
    case 'low':
      return AppColors.textMuted;
    default:
      return AppColors.primary;
  }
}

Color _statusColor(String? status) {
  switch (status?.toLowerCase()) {
    case 'assigned':
      return Colors.blue[400]!;
    case 'in_progress':
      return AppColors.primary;
    case 'pending_review':
      return Colors.orange[400]!;
    case 'completed':
      return Colors.green[400]!;
    case 'overdue':
      return AppColors.danger;
    case 'cancelled':
      return AppColors.textMuted;
    default:
      return AppColors.textMuted;
  }
}

class WorkAssignmentsScreen extends ConsumerStatefulWidget {
  const WorkAssignmentsScreen({super.key});

  @override
  ConsumerState<WorkAssignmentsScreen> createState() =>
      _WorkAssignmentsScreenState();
}

class _WorkAssignmentsScreenState extends ConsumerState<WorkAssignmentsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  bool _loading = true;
  String? _error;

  List<Map<String, dynamic>> _myWork = [];
  List<Map<String, dynamic>> _teamWork = [];
  List<Map<String, dynamic>> _overdueList = [];

  Map<String, dynamic>? _stats;

  int? _userId;
  bool _isSupervisorOrHr = false;

  // New assignment form controllers
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _assignedToCtrl = TextEditingController();
  String _newPriority = 'medium';
  DateTime? _newDueDate;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _tabController.addListener(() => setState(() {}));
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadData());
  }

  @override
  void dispose() {
    _tabController.dispose();
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _assignedToCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(authRepositoryProvider);
      final roles = await repo.getStoredRoles();
      _isSupervisorOrHr = roles.any((r) =>
          r.toLowerCase().contains('hr') ||
          r.toLowerCase().contains('supervisor') ||
          r.toLowerCase().contains('admin') ||
          r.toLowerCase().contains('manager'));

      // Get user id from stored JSON
      final storage = ref.read(authStorageProvider);
      final jsonStr = await storage.getUserJson();
      if (jsonStr != null) {
        final map = jsonDecode(jsonStr) as Map<String, dynamic>?;
        _userId = map?['id'] as int?;
      }

      final dio = ref.read(apiClientProvider).dio;

      final results = await Future.wait([
        dio
            .get<dynamic>('/hr/assignments',
                queryParameters: {'assigned_to': _userId})
            .catchError((_, __) => Future<Response<dynamic>>.value(_emptyResponse())),
        dio
            .get<dynamic>('/hr/assignments',
                queryParameters: {'assigned_by': _userId})
            .catchError((_, __) => Future<Response<dynamic>>.value(_emptyResponse())),
        dio
            .get<dynamic>('/hr/assignments',
                queryParameters: {'overdue': true})
            .catchError((_, __) => Future<Response<dynamic>>.value(_emptyResponse())),
        dio.get<dynamic>('/hr/assignments/stats').catchError((_, __) => Future<Response<dynamic>>.value(_emptyResponse())),
      ]);

      List<Map<String, dynamic>> parseList(dynamic resp) {
        if (resp == null) return [];
        final data = resp.data;
        if (data == null) return [];
        final items = data is Map ? (data['data'] ?? data['items'] ?? []) : data;
        if (items is! List) return [];
        return items
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      }

      setState(() {
        _myWork = parseList(results[0]);
        _teamWork = parseList(results[1]);
        _overdueList = parseList(results[2]);
        final statsResp = results[3];
        if (statsResp.data != null) {
          final sd = statsResp.data;
          _stats = sd is Map ? Map<String, dynamic>.from(sd) : null;
        }
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _submitNewAssignment() async {
    if (_titleCtrl.text.trim().isEmpty) return;
    setState(() => _submitting = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.post<dynamic>('/hr/assignments', data: {
        'title': _titleCtrl.text.trim(),
        'description': _descCtrl.text.trim(),
        'priority': _newPriority,
        'due_date': _newDueDate?.toIso8601String().substring(0, 10),
        'assigned_to': _assignedToCtrl.text.trim(),
      });
      _titleCtrl.clear();
      _descCtrl.clear();
      _assignedToCtrl.clear();
      _newDueDate = null;
      _newPriority = 'medium';
      if (mounted) Navigator.of(context).pop();
      _loadData();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: ${e.toString()}')),
        );
      }
    } finally {
      setState(() => _submitting = false);
    }
  }

  void _showNewAssignmentSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.bgSurfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModal) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 24,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'New Assignment',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              _field('Title *', _titleCtrl),
              const SizedBox(height: 12),
              _field('Description', _descCtrl, maxLines: 3),
              const SizedBox(height: 12),
              _field('Assigned To (employee name/id)', _assignedToCtrl),
              const SizedBox(height: 12),
              // Priority dropdown
              DropdownButtonFormField<String>(
                value: _newPriority,
                dropdownColor: AppColors.bgSurfaceDark,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: InputDecoration(
                  labelText: 'Priority',
                  labelStyle: const TextStyle(color: AppColors.textMuted),
                  filled: true,
                  fillColor: AppColors.bgDark,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide.none,
                  ),
                ),
                items: ['low', 'medium', 'high', 'critical']
                    .map((p) => DropdownMenuItem(
                          value: p,
                          child: Text(p[0].toUpperCase() + p.substring(1)),
                        ))
                    .toList(),
                onChanged: (v) {
                  if (v != null) setModal(() => _newPriority = v);
                },
              ),
              const SizedBox(height: 12),
              // Due date picker
              InkWell(
                onTap: () async {
                  final d = await showDatePicker(
                    context: ctx,
                    initialDate: DateTime.now().add(const Duration(days: 7)),
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 365)),
                  );
                  if (d != null) setModal(() => _newDueDate = d);
                },
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: AppColors.bgDark,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.calendar_today,
                          size: 18, color: AppColors.textMuted),
                      const SizedBox(width: 12),
                      Text(
                        _newDueDate != null
                            ? _newDueDate!
                                .toIso8601String()
                                .substring(0, 10)
                            : 'Select Due Date',
                        style: const TextStyle(color: AppColors.textPrimary),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _submitting ? null : _submitNewAssignment,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                  child: _submitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.black),
                        )
                      : const Text('Create Assignment',
                          style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(String label, TextEditingController ctrl, {int maxLines = 1}) {
    return TextField(
      controller: ctrl,
      maxLines: maxLines,
      style: const TextStyle(color: AppColors.textPrimary),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: AppColors.textMuted),
        filled: true,
        fillColor: AppColors.bgDark,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide.none,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgSurfaceDark,
        title: const Text('Work Assignments'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadData,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textMuted,
          tabs: [
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('My Work'),
                  if (_myWork.isNotEmpty) ...[
                    const SizedBox(width: 6),
                    _countBadge(_myWork.length),
                  ],
                ],
              ),
            ),
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Team'),
                  if (_teamWork.isNotEmpty) ...[
                    const SizedBox(width: 6),
                    _countBadge(_teamWork.length),
                  ],
                ],
              ),
            ),
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Overdue'),
                  if (_overdueList.isNotEmpty) ...[
                    const SizedBox(width: 6),
                    _countBadge(_overdueList.length,
                        color: AppColors.danger),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: _isSupervisorOrHr
          ? FloatingActionButton.extended(
              onPressed: _showNewAssignmentSheet,
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.black,
              icon: const Icon(Icons.add),
              label: const Text('New Assignment',
                  style: TextStyle(fontWeight: FontWeight.bold)),
            )
          : null,
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline,
                          size: 48, color: AppColors.danger),
                      const SizedBox(height: 12),
                      Text(_error!,
                          style: const TextStyle(color: AppColors.textMuted),
                          textAlign: TextAlign.center),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadData,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.black,
                        ),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : Column(
                  children: [
                    if (_stats != null) _buildStatsRow(),
                    Expanded(
                      child: TabBarView(
                        controller: _tabController,
                        children: [
                          _buildList(_myWork, showAssignee: false),
                          _buildList(_teamWork, showAssignee: true),
                          _buildList(_overdueList, showAssignee: true),
                        ],
                      ),
                    ),
                  ],
                ),
    );
  }

  Widget _countBadge(int count, {Color? color}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: (color ?? AppColors.primary).withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        '$count',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.bold,
          color: color ?? AppColors.primary,
        ),
      ),
    );
  }

  Widget _buildStatsRow() {
    final total = _stats?['total'] ?? 0;
    final inProgress = _stats?['in_progress'] ?? 0;
    final overdue = _stats?['overdue'] ?? 0;
    return Container(
      color: AppColors.bgSurfaceDark,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          _statTile('Total', total.toString(), AppColors.textMuted),
          _statTile('In Progress', inProgress.toString(), AppColors.primary),
          _statTile('Overdue', overdue.toString(), AppColors.danger),
        ],
      ),
    );
  }

  Widget _statTile(String label, String value, Color color) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              color: color,
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 2),
          Text(label,
              style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
        ],
      ),
    );
  }

  Widget _buildList(List<Map<String, dynamic>> items,
      {required bool showAssignee}) {
    if (items.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.task_alt, size: 56, color: AppColors.textMuted),
            SizedBox(height: 12),
            Text('No assignments found',
                style: TextStyle(color: AppColors.textMuted, fontSize: 16)),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _loadData,
      color: AppColors.primary,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
        itemCount: items.length,
        itemBuilder: (_, i) =>
            _AssignmentCard(
              assignment: items[i],
              showAssignee: showAssignee,
              onTap: () => context.push(
                '/hr/assignments/detail',
                extra: items[i]['id'] as int,
              ),
            ),
      ),
    );
  }
}

class _AssignmentCard extends StatelessWidget {
  final Map<String, dynamic> assignment;
  final bool showAssignee;
  final VoidCallback onTap;

  const _AssignmentCard({
    required this.assignment,
    required this.showAssignee,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isOverdue = assignment['is_overdue'] == true ||
        assignment['status']?.toString().toLowerCase() == 'overdue';
    final priority = assignment['priority']?.toString() ?? 'medium';
    final status = assignment['status']?.toString() ?? 'assigned';
    final dueDate = assignment['due_date']?.toString();
    final estHours = assignment['estimated_hours'];

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: AppColors.bgSurfaceDark,
          borderRadius: BorderRadius.circular(12),
          border: Border(
            left: BorderSide(
              color: isOverdue ? AppColors.danger : _priorityColor(priority),
              width: 4,
            ),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      assignment['title']?.toString() ?? 'Untitled',
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (isOverdue)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.danger.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'OVERDUE',
                        style: TextStyle(
                          color: AppColors.danger,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  _chip(
                    priority[0].toUpperCase() + priority.substring(1),
                    _priorityColor(priority),
                  ),
                  const SizedBox(width: 8),
                  _chip(
                    status.replaceAll('_', ' ').toUpperCase(),
                    _statusColor(status),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  if (showAssignee &&
                      assignment['assignee_name'] != null) ...[
                    const Icon(Icons.person_outline,
                        size: 14, color: AppColors.textMuted),
                    const SizedBox(width: 4),
                    Text(
                      assignment['assignee_name'].toString(),
                      style: const TextStyle(
                          color: AppColors.textMuted, fontSize: 13),
                    ),
                    const Spacer(),
                  ] else if (!showAssignee && dueDate != null) ...[
                    const Icon(Icons.calendar_today,
                        size: 14, color: AppColors.textMuted),
                    const SizedBox(width: 4),
                    Text(
                      dueDate.substring(0, 10),
                      style: TextStyle(
                        color: isOverdue ? AppColors.danger : AppColors.textMuted,
                        fontSize: 13,
                      ),
                    ),
                    const Spacer(),
                  ] else
                    const Spacer(),
                  if (estHours != null) ...[
                    const Icon(Icons.access_time,
                        size: 14, color: AppColors.textMuted),
                    const SizedBox(width: 4),
                    Text(
                      '$estHours hrs',
                      style: const TextStyle(
                          color: AppColors.textMuted, fontSize: 13),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _chip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
