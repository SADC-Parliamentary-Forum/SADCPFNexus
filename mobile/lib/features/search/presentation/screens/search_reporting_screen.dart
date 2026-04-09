import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';

class SearchReportingScreen extends ConsumerStatefulWidget {
  const SearchReportingScreen({super.key});

  @override
  ConsumerState<SearchReportingScreen> createState() => _SearchReportingScreenState();
}

class _SearchReportingScreenState extends ConsumerState<SearchReportingScreen> {
  final TextEditingController _searchController = TextEditingController();
  bool _isGridView = false;

  String? _selectedDepartment;
  String? _selectedProgram;
  String? _selectedBudget;

  // Loaded from API
  List<String> _departments = [];
  List<String> _programs = [];
  List<String> _budgets = [];
  bool _filtersLoading = true;

  final List<String> _recentSearches = [
    'Budget FY2026',
    'Travel Policy',
    'Audit Logs',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadFilters());
  }

  Future<void> _loadFilters() async {
    final api = ref.read(apiClientProvider);
    try {
      final results = await Future.wait([
        api.dio.get<Map<String, dynamic>>('/admin/departments'),
        api.dio.get<Map<String, dynamic>>('/programmes'),
        api.dio.get<Map<String, dynamic>>('/finance/budgets'),
      ]);

      final deptData = (results[0].data?['data'] as List?) ?? [];
      final progData = (results[1].data?['data'] as List?) ?? [];
      final budgetData = (results[2].data?['data'] as List?) ?? [];

      if (!mounted) return;
      setState(() {
        _departments = deptData
            .map((d) => (d as Map<String, dynamic>)['name'] as String? ?? '')
            .where((n) => n.isNotEmpty)
            .toList();
        _programs = progData
            .map((p) => (p as Map<String, dynamic>)['title'] as String? ?? '')
            .where((n) => n.isNotEmpty)
            .toList();
        _budgets = budgetData
            .map((b) => (b as Map<String, dynamic>)['name'] as String? ?? '')
            .where((n) => n.isNotEmpty)
            .toList();
        _filtersLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _filtersLoading = false);
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
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
          icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text('Search & Reporting',
          style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        centerTitle: true,
        actions: [
          IconButton(
            icon: Icon(
              _isGridView ? Icons.list_rounded : Icons.grid_view_rounded,
              color: AppColors.textSecondary, size: 20),
            onPressed: () => setState(() => _isGridView = !_isGridView),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Search bar
            Container(
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.border),
              ),
              child: TextField(
                controller: _searchController,
                style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                decoration: const InputDecoration(
                  hintText: 'Search documents, approvals...',
                  hintStyle: TextStyle(color: AppColors.textMuted, fontSize: 14),
                  prefixIcon: Icon(Icons.search_rounded, color: AppColors.textMuted, size: 20),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                  filled: false,
                ),
              ),
            ),
            const SizedBox(height: 14),

            // Filter chips row
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(children: [
                _buildFilterChip('Module'),
                const SizedBox(width: 8),
                _buildFilterChip('Date'),
                const SizedBox(width: 8),
                _buildFilterChip('Role'),
                const SizedBox(width: 8),
                _buildFilterChip('Status'),
              ]),
            ),
            const SizedBox(height: 22),

            // Recent Searches
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              const Text('Recent Searches',
                style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
              GestureDetector(
                onTap: () {},
                child: const Text('Clear All',
                  style: TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w600)),
              ),
            ]),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _recentSearches.map((s) => GestureDetector(
                onTap: () => _searchController.text = s,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.primary.withValues(alpha: 0.5)),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.history_rounded, color: AppColors.primary, size: 13),
                    const SizedBox(width: 5),
                    Text(s, style: const TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w500)),
                  ]),
                ),
              )).toList(),
            ),
            const SizedBox(height: 22),

            // Advanced Filters
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              const Text('Advanced Filters',
                style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
              if (_filtersLoading)
                const SizedBox(
                  width: 14, height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                ),
            ]),
            const SizedBox(height: 10),
            _buildDropdown(
              hint: 'Select Department',
              value: _selectedDepartment,
              items: _departments,
              onChanged: (v) => setState(() => _selectedDepartment = v),
            ),
            const SizedBox(height: 10),
            _buildDropdown(
              hint: 'Select Programme',
              value: _selectedProgram,
              items: _programs,
              onChanged: (v) => setState(() => _selectedProgram = v),
            ),
            const SizedBox(height: 10),
            _buildDropdown(
              hint: 'Budget',
              value: _selectedBudget,
              items: _budgets,
              onChanged: (v) => setState(() => _selectedBudget = v),
            ),
            const SizedBox(height: 22),

            // Quick Report Generation
            const Text('Quick Report Generation',
              style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
            const SizedBox(height: 10),
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 1.5,
              children: [
                _buildReportCard(
                  icon: Icons.speed_rounded, iconColor: AppColors.primary,
                  title: 'Workflow SLA', subtitle: 'HR performance metrics & KPI tracking'),
                _buildReportCard(
                  icon: Icons.bar_chart_rounded, iconColor: AppColors.warning,
                  title: 'Budget Variance', subtitle: 'Export PDF report for current period'),
                _buildReportCard(
                  icon: Icons.security_rounded, iconColor: AppColors.info,
                  title: 'Audit Log Export', subtitle: 'Comprehensive system access logs (CSV)'),
                _buildReportCard(
                  icon: Icons.summarize_rounded, iconColor: AppColors.gold,
                  title: 'Executive Summary', subtitle: 'High-level overview for leadership'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label) => GestureDetector(
    onTap: () {},
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w500)),
        const SizedBox(width: 4),
        const Icon(Icons.keyboard_arrow_down_rounded, color: AppColors.textMuted, size: 14),
      ]),
    ),
  );

  Widget _buildDropdown({
    required String hint,
    required String? value,
    required List<String> items,
    required ValueChanged<String?> onChanged,
  }) => Container(
    height: 48,
    padding: const EdgeInsets.symmetric(horizontal: 14),
    decoration: BoxDecoration(
      color: AppColors.bgSurface,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: AppColors.border),
    ),
    child: DropdownButtonHideUnderline(
      child: DropdownButton<String>(
        value: value,
        hint: Text(hint, style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
        items: [
          DropdownMenuItem<String>(value: null, child: Text(hint, style: const TextStyle(color: AppColors.textMuted, fontSize: 13))),
          ...items.map((item) => DropdownMenuItem<String>(
            value: item,
            child: Text(item, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13)),
          )),
        ],
        onChanged: onChanged,
        dropdownColor: AppColors.bgCard,
        iconEnabledColor: AppColors.textMuted,
        isExpanded: true,
      ),
    ),
  );

  Widget _buildReportCard({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
  }) => GestureDetector(
    onTap: () {},
    child: Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 32, height: 32,
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(9),
          ),
          child: Icon(icon, color: iconColor, size: 17),
        ),
        const SizedBox(height: 8),
        Text(title,
          style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w700),
          maxLines: 1, overflow: TextOverflow.ellipsis),
        const SizedBox(height: 2),
        Text(subtitle,
          style: const TextStyle(color: AppColors.textMuted, fontSize: 9, height: 1.4),
          maxLines: 2, overflow: TextOverflow.ellipsis),
      ]),
    ),
  );
}
