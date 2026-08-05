import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../shared/widgets/searchable_list_filter.dart';
import '../../../../../shared/widgets/stitch_card.dart';
import '../../../../../shared/widgets/stitch_screen.dart';

class HrDirectoryScreen extends ConsumerStatefulWidget {
  const HrDirectoryScreen({super.key});

  @override
  ConsumerState<HrDirectoryScreen> createState() => _HrDirectoryScreenState();
}

class _HrDirectoryScreenState extends ConsumerState<HrDirectoryScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _files = [];
  List<Map<String, dynamic>> _filtered = [];

  String _searchQuery = '';
  String _selectedFilter = 'all';

  bool _isHr = false;

  // Stats
  int _total = 0;
  int _active = 0;
  int _probation = 0;
  int _warnings = 0;

  // Pagination — `/hr/files` is server-paginated (per_page capped at 100).
  static const _perPage = 100;
  int _currentPage = 1;
  int _lastPage = 1;
  bool _hasMorePages = false;
  bool _loadingMore = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadData());
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(authRepositoryProvider);
      final roles = await repo.getStoredRoles();
      _isHr = roles.any((r) =>
          r.toLowerCase().contains('hr') || r.toLowerCase().contains('admin'));

      final res = await ref.read(apiClientProvider).dio.get<dynamic>(
        '/hr/files',
        queryParameters: {'per_page': _perPage, 'page': 1},
      );
      final data = res.data;
      final List<dynamic> raw = (data is Map && data['data'] != null)
          ? data['data'] as List<dynamic>
          : (data is List ? data : []);
      _files = raw.cast<Map<String, dynamic>>();
      if (data is Map) {
        _currentPage = (data['current_page'] as num?)?.toInt() ?? 1;
        _lastPage = (data['last_page'] as num?)?.toInt() ?? 1;
        _total = (data['total'] as num?)?.toInt() ?? _files.length;
      } else {
        _currentPage = 1;
        _lastPage = 1;
        _total = _files.length;
      }
      _hasMorePages = _currentPage < _lastPage;

      _recomputeStats();
      _applyFilters();
      setState(() => _loading = false);
    } catch (e) {
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  /// Fetches the next page of employee files and appends it to the list.
  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMorePages) return;
    setState(() => _loadingMore = true);
    try {
      final nextPage = _currentPage + 1;
      final res = await ref.read(apiClientProvider).dio.get<dynamic>(
        '/hr/files',
        queryParameters: {'per_page': _perPage, 'page': nextPage},
      );
      final data = res.data;
      final List<dynamic> raw = (data is Map && data['data'] != null)
          ? data['data'] as List<dynamic>
          : (data is List ? data : []);
      _files.addAll(raw.cast<Map<String, dynamic>>());
      if (data is Map) {
        _currentPage = (data['current_page'] as num?)?.toInt() ?? nextPage;
        _lastPage = (data['last_page'] as num?)?.toInt() ?? _lastPage;
        _total = (data['total'] as num?)?.toInt() ?? _total;
      }
      _hasMorePages = _currentPage < _lastPage;

      _recomputeStats();
      _applyFilters();
      if (mounted) setState(() => _loadingMore = false);
    } catch (_) {
      if (mounted) {
        setState(() => _loadingMore = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to load more files.')),
        );
      }
    }
  }

  /// Recomputes stat tiles from the files loaded so far. When more pages
  /// remain, `_total` still reflects the server-reported grand total, but
  /// the breakdown counts only cover loaded records until "Load more" is
  /// used to fetch the rest.
  void _recomputeStats() {
    _active = _files.where((f) => f['employment_status'] == 'active').length;
    _probation =
        _files.where((f) => f['probation_status'] == 'on_probation').length;
    _warnings = _files.where((f) => f['active_warning_flag'] == true).length;
  }

  void _applyFilters() {
    var result = List<Map<String, dynamic>>.from(_files);

    if (_searchQuery.isNotEmpty) {
      result = result.where((f) {
        return matchesSearchText(
          f,
          _searchQuery,
          const [
            'employee_name',
            'name',
            'job_title',
            'position',
            'department'
          ],
        );
      }).toList();
    }

    if (_selectedFilter != 'all') {
      result = result.where((f) {
        switch (_selectedFilter) {
          case 'active':
            return f['employment_status'] == 'active';
          case 'probation':
            return f['probation_status'] == 'on_probation';
          case 'separated':
            return f['employment_status'] == 'terminated' ||
                f['employment_status'] == 'separated';
          case 'expiring':
            final expiry = f['contract_end_date'] as String?;
            if (expiry == null) return false;
            try {
              final date = DateTime.parse(expiry);
              final now = DateTime.now();
              return date.difference(now).inDays <= 90 && date.isAfter(now);
            } catch (_) {
              return false;
            }
          default:
            return true;
        }
      }).toList();
    }

    setState(() => _filtered = result);
  }

  @override
  Widget build(BuildContext context) {
    return StitchScreen(
      title: 'Employee Files',
      fallbackRoute: '/dashboard',
      floatingActionButton: _isHr
          ? FloatingActionButton(
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.textPrimary,
              onPressed: _showCreateFileSheet,
              child: const Icon(Icons.person_add_outlined),
            )
          : null,
      body: _loading
          ? const StitchLoadingState(label: 'Loading employee files')
          : _error != null
              ? StitchErrorState(
                  message: 'Failed to load employee files.',
                  onRetry: _loadData,
                )
              : RefreshIndicator(
                  onRefresh: _loadData,
                  color: AppColors.primary,
                  child: CustomScrollView(
                    slivers: [
                      SliverToBoxAdapter(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildSearch(),
                            _buildFilters(),
                            _buildStats(),
                          ],
                        ),
                      ),
                      if (_filtered.isEmpty)
                        SliverFillRemaining(
                          child: _buildEmpty(),
                        )
                      else
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 80),
                          sliver: SliverList(
                            delegate: SliverChildBuilderDelegate(
                              (_, i) => Padding(
                                padding: const EdgeInsets.only(bottom: 10),
                                child: _FileCard(
                                  file: _filtered[i],
                                  onTap: () => context.push(
                                    '/hr/files/detail',
                                    extra: _filtered[i]['id'] as int,
                                  ),
                                ),
                              ),
                              childCount: _filtered.length,
                            ),
                          ),
                        ),
                      if (_hasMorePages && _selectedFilter == 'all' && _searchQuery.isEmpty)
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 80),
                            child: Center(
                              child: OutlinedButton(
                                onPressed: _loadingMore ? null : _loadMore,
                                child: _loadingMore
                                    ? const SizedBox(
                                        width: 16,
                                        height: 16,
                                        child: CircularProgressIndicator(
                                            strokeWidth: 2),
                                      )
                                    : const Text('Load more'),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
    );
  }

  Future<void> _showCreateFileSheet() async {
    final formKey = GlobalKey<FormState>();
    final employeeIdCtrl = TextEditingController();
    final staffNumberCtrl = TextEditingController();
    final positionCtrl = TextEditingController();
    bool submitting = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) {
        return StatefulBuilder(builder: (ctx, setSheetState) {
          return Padding(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 20,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
            ),
            child: Form(
              key: formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    const Expanded(
                      child: Text('New HR File',
                          style: TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 17,
                              fontWeight: FontWeight.w800)),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close,
                          color: AppColors.textMuted, size: 20),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ]),
                  const SizedBox(height: 16),
                  // Employee ID
                  TextFormField(
                    controller: employeeIdCtrl,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(
                        color: AppColors.textPrimary, fontSize: 14),
                    decoration: _inputDecoration('Employee ID *'),
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) {
                        return 'Employee ID is required';
                      }
                      if (int.tryParse(v.trim()) == null) {
                        return 'Must be a numeric ID';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  // Staff number
                  TextFormField(
                    controller: staffNumberCtrl,
                    style: const TextStyle(
                        color: AppColors.textPrimary, fontSize: 14),
                    decoration: _inputDecoration('Staff Number'),
                  ),
                  const SizedBox(height: 12),
                  // Current position
                  TextFormField(
                    controller: positionCtrl,
                    style: const TextStyle(
                        color: AppColors.textPrimary, fontSize: 14),
                    decoration: _inputDecoration('Current Position'),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      onPressed: submitting
                          ? null
                          : () async {
                              if (!formKey.currentState!.validate()) return;
                              setSheetState(() => submitting = true);

                              try {
                                final body = <String, dynamic>{
                                  'employee_id':
                                      int.parse(employeeIdCtrl.text.trim()),
                                };
                                if (staffNumberCtrl.text.trim().isNotEmpty) {
                                  body['staff_number'] =
                                      staffNumberCtrl.text.trim();
                                }
                                if (positionCtrl.text.trim().isNotEmpty) {
                                  body['current_position'] =
                                      positionCtrl.text.trim();
                                }

                                await ref
                                    .read(apiClientProvider)
                                    .dio
                                    .post('/hr/files', data: body);

                                if (!mounted || !ctx.mounted) return;
                                Navigator.pop(ctx);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                      content: Text(
                                          'HR file created successfully.')),
                                );
                                _loadData();
                              } catch (e) {
                                if (!mounted || !ctx.mounted) return;
                                setSheetState(() => submitting = false);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                      content: Text(
                                          'Failed to create file: ${e.toString()}')),
                                );
                              }
                            },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: AppColors.textPrimary,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                      ),
                      child: submitting
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: AppColors.textPrimary))
                          : const Text('Create File',
                              style: TextStyle(
                                  fontWeight: FontWeight.w700, fontSize: 15)),
                    ),
                  ),
                ],
              ),
            ),
          );
        });
      },
    );
  }

  InputDecoration _inputDecoration(String label) => InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
        filled: true,
        fillColor: AppColors.bgDark,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.danger),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        isDense: true,
      );

  Widget _buildSearch() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: DebouncedSearchField(
        value: _searchQuery,
        hintText: 'Search by name, position, department...',
        onChanged: (value) {
          _searchQuery = value;
          _applyFilters();
        },
      ),
    );
  }

  Widget _buildFilters() {
    final filters = [
      ('all', 'All'),
      ('active', 'Active'),
      ('probation', 'Probation'),
      ('separated', 'Separated'),
      ('expiring', 'Contract Expiring'),
    ];
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: filters.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final isSelected = _selectedFilter == filters[i].$1;
          return GestureDetector(
            onTap: () {
              setState(() => _selectedFilter = filters[i].$1);
              _applyFilters();
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: isSelected
                    ? AppColors.primary.withValues(alpha: 0.15)
                    : AppColors.bgSurface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isSelected ? AppColors.primary : AppColors.border,
                ),
              ),
              child: Text(
                filters[i].$2,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                  color:
                      isSelected ? AppColors.primary : AppColors.textSecondary,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildStats() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Row(
        children: [
          _MiniStat(label: 'Total', value: _total, color: AppColors.info),
          const SizedBox(width: 8),
          _MiniStat(label: 'Active', value: _active, color: AppColors.success),
          const SizedBox(width: 8),
          _MiniStat(
              label: 'Probation',
              value: _probation,
              color: const Color(0xFFF59E0B)),
          const SizedBox(width: 8),
          _MiniStat(
              label: 'Warnings', value: _warnings, color: AppColors.danger),
        ],
      ),
    );
  }

  Widget _buildEmpty() {
    return const StitchEmptyState(
      icon: Icons.folder_shared_outlined,
      title: 'No employee files found',
      message: 'Try adjusting your search or filter.',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _MiniStat extends StatelessWidget {
  final String label;
  final int value;
  final Color color;

  const _MiniStat({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '$value',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
            Text(
              label,
              style: const TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _FileCard extends StatelessWidget {
  final Map<String, dynamic> file;
  final VoidCallback onTap;

  const _FileCard({required this.file, required this.onTap});

  static Color _avatarColor(String name) {
    final colors = [
      const Color(0xFF0EA5E9),
      const Color(0xFF8B5CF6),
      const Color(0xFFEC4899),
      const Color(0xFF10B981),
      const Color(0xFFF59E0B),
      const Color(0xFFEF4444),
      const Color(0xFF6366F1),
    ];
    final hash = name.codeUnits.fold(0, (a, b) => a + b);
    return colors[hash % colors.length];
  }

  static Color _fileStatusColor(String? status) {
    switch (status) {
      case 'active':
        return AppColors.success;
      case 'under_review':
        return const Color(0xFFF59E0B);
      case 'archived':
        return AppColors.textMuted;
      default:
        return AppColors.textMuted;
    }
  }

  static String _fileStatusLabel(String? status) {
    switch (status) {
      case 'active':
        return 'Active';
      case 'under_review':
        return 'Under Review';
      case 'archived':
        return 'Archived';
      default:
        return status ?? 'Unknown';
    }
  }

  static Color _employmentStatusColor(String? status) {
    switch (status) {
      case 'active':
        return AppColors.success;
      case 'terminated':
      case 'separated':
        return AppColors.danger;
      case 'on_notice':
        return const Color(0xFFF59E0B);
      default:
        return AppColors.textMuted;
    }
  }

  static String _employmentStatusLabel(String? status) {
    switch (status) {
      case 'active':
        return 'Employed';
      case 'terminated':
        return 'Terminated';
      case 'separated':
        return 'Separated';
      case 'on_notice':
        return 'On Notice';
      default:
        return status ?? 'Unknown';
    }
  }

  @override
  Widget build(BuildContext context) {
    final name =
        (file['employee_name'] ?? file['name'] ?? 'Unknown').toString();
    final position = (file['job_title'] ?? file['position'] ?? '').toString();
    final department = (file['department'] ?? '').toString();
    final fileStatus = file['file_status'] as String?;
    final empStatus = file['employment_status'] as String?;
    final warningFlag = file['active_warning_flag'] == true;
    final contractExpiry = file['contract_end_date'] as String?;
    final probation = file['probation_status'] == 'on_probation';

    final avatarColor = _avatarColor(name);
    final initials = name
        .split(' ')
        .where((s) => s.isNotEmpty)
        .take(2)
        .map((s) => s[0].toUpperCase())
        .join();

    bool contractExpiringSoon = false;
    String? expiryLabel;
    if (contractExpiry != null) {
      try {
        final expDate = DateTime.parse(contractExpiry);
        final now = DateTime.now();
        final daysLeft = expDate.difference(now).inDays;
        if (daysLeft <= 90 && daysLeft >= 0) {
          contractExpiringSoon = true;
          expiryLabel = 'Contract expires in $daysLeft days';
        }
      } catch (_) {}
    }

    return StitchCard(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          // Avatar
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: avatarColor.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                initials,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: avatarColor,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        name,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                    if (warningFlag)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.danger.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(5),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.flag, size: 10, color: AppColors.danger),
                            SizedBox(width: 2),
                            Text(
                              'Warning',
                              style: TextStyle(
                                fontSize: 9,
                                color: AppColors.danger,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
                if (position.isNotEmpty)
                  Text(
                    position,
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textSecondary,
                    ),
                  ),
                if (department.isNotEmpty)
                  Text(
                    department,
                    style: const TextStyle(
                        fontSize: 10, color: AppColors.textMuted),
                  ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    _SmallBadge(
                      label: _fileStatusLabel(fileStatus),
                      color: _fileStatusColor(fileStatus),
                    ),
                    const SizedBox(width: 6),
                    _SmallBadge(
                      label: _employmentStatusLabel(empStatus),
                      color: _employmentStatusColor(empStatus),
                    ),
                    if (probation) ...[
                      const SizedBox(width: 6),
                      const _SmallBadge(
                        label: 'Probation',
                        color: Color(0xFFF59E0B),
                      ),
                    ],
                  ],
                ),
                if (contractExpiringSoon && expiryLabel != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.schedule,
                          size: 11, color: Color(0xFFF59E0B)),
                      const SizedBox(width: 3),
                      Text(
                        expiryLabel,
                        style: const TextStyle(
                          fontSize: 10,
                          color: Color(0xFFF59E0B),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: AppColors.textMuted, size: 20),
        ],
      ),
    );
  }
}

class _SmallBadge extends StatelessWidget {
  final String label;
  final Color color;

  const _SmallBadge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(5),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 9,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}
