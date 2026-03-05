import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class SearchReportingScreen extends StatefulWidget {
  const SearchReportingScreen({super.key});

  @override
  State<SearchReportingScreen> createState() => _SearchReportingScreenState();
}

class _SearchReportingScreenState extends State<SearchReportingScreen> {
  final TextEditingController _searchController = TextEditingController();
  bool _isGridView = false;

  String? _selectedDepartment;
  String? _selectedProgram;
  String? _selectedBudgetLine;

  final List<String> _departments = [
    'Finance',
    'HR',
    'Governance',
    'Secretariat',
    'IT'
  ];
  final List<String> _programs = [
    'Program Alpha',
    'Program Beta',
    'SADC Modernization',
    'Audit 2024'
  ];
  final List<String> _budgetLines = [
    'BL-001 Core Operations',
    'BL-002 Infrastructure',
    'BL-003 Personnel',
    'BL-004 Travel'
  ];

  final List<String> _recentSearches = [
    'Budget FY2024',
    'Travel Policy',
    'Audit Logs',
  ];

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
          icon: const Icon(Icons.arrow_back_ios_new,
              size: 18, color: AppColors.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'Search & Reporting',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: Icon(
              _isGridView ? Icons.list_rounded : Icons.grid_view_rounded,
              color: AppColors.textSecondary,
              size: 20,
            ),
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
                style: const TextStyle(
                    color: AppColors.textPrimary, fontSize: 14),
                decoration: const InputDecoration(
                  hintText: 'Search documents, approvals...',
                  hintStyle: TextStyle(
                      color: AppColors.textMuted, fontSize: 14),
                  prefixIcon: Icon(Icons.search_rounded,
                      color: AppColors.textMuted, size: 20),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(
                      vertical: 14, horizontal: 16),
                  filled: false,
                ),
              ),
            ),
            const SizedBox(height: 14),

            // Filter chips row
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildFilterChip('Module'),
                  const SizedBox(width: 8),
                  _buildFilterChip('Date'),
                  const SizedBox(width: 8),
                  _buildFilterChip('Role'),
                  const SizedBox(width: 8),
                  _buildFilterChip('Status'),
                ],
              ),
            ),
            const SizedBox(height: 22),

            // Recent Searches
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Recent Searches',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                GestureDetector(
                  onTap: () {},
                  child: const Text(
                    'Clear All',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _recentSearches.map((s) {
                return GestureDetector(
                  onTap: () {
                    _searchController.text = s;
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 7),
                    decoration: BoxDecoration(
                      color: Colors.transparent,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                          color: AppColors.primary.withValues(alpha: 0.5)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.history_rounded,
                            color: AppColors.primary, size: 13),
                        const SizedBox(width: 5),
                        Text(
                          s,
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 22),

            // Advanced Filters
            const Text(
              'Advanced Filters',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 10),
            _buildDropdown(
              hint: 'Select Department',
              value: _selectedDepartment,
              items: _departments,
              onChanged: (v) => setState(() => _selectedDepartment = v),
            ),
            const SizedBox(height: 10),
            _buildDropdown(
              hint: 'Select Program',
              value: _selectedProgram,
              items: _programs,
              onChanged: (v) => setState(() => _selectedProgram = v),
            ),
            const SizedBox(height: 10),
            _buildDropdown(
              hint: 'Budget Line',
              value: _selectedBudgetLine,
              items: _budgetLines,
              onChanged: (v) => setState(() => _selectedBudgetLine = v),
            ),
            const SizedBox(height: 22),

            // Quick Report Generation
            const Text(
              'Quick Report Generation',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
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
                  icon: Icons.speed_rounded,
                  iconColor: AppColors.primary,
                  title: 'Workflow SLA',
                  subtitle: 'HR performance metrics & KPI tracking',
                ),
                _buildReportCard(
                  icon: Icons.bar_chart_rounded,
                  iconColor: AppColors.warning,
                  title: 'Budget Variance',
                  subtitle: 'Export PDF report for Q3 2024',
                ),
                _buildReportCard(
                  icon: Icons.security_rounded,
                  iconColor: AppColors.info,
                  title: 'Audit Log Export',
                  subtitle: 'Comprehensive system access logs (CSV)',
                ),
                _buildReportCard(
                  icon: Icons.summarize_rounded,
                  iconColor: AppColors.gold,
                  title: 'Executive Summary',
                  subtitle: 'High-level overview for leadership',
                ),
              ],
            ),
            const SizedBox(height: 22),

            // Top Results
            const Text(
              'Top Results',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 10),
            _buildResultItem(
              icon: Icons.picture_as_pdf_rounded,
              iconColor: AppColors.danger,
              title: 'Q3 Financial Report.pdf',
              subtitle: 'Finance Dept · 20m ago',
            ),
            const SizedBox(height: 8),
            _buildResultItem(
              icon: Icons.check_circle_rounded,
              iconColor: AppColors.success,
              title: 'Travel Request #4029',
              subtitle: 'Finance Dept · Dr. Dhumeni',
            ),
            const SizedBox(height: 8),
            _buildResultItem(
              icon: Icons.person_rounded,
              iconColor: AppColors.info,
              title: 'Sarah Jenkins',
              subtitle: 'HR Dept · Online',
              trailingBadge: 'Online',
              trailingColor: AppColors.success,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label) {
    return GestureDetector(
      onTap: () {},
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.bgSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.keyboard_arrow_down_rounded,
                color: AppColors.textMuted, size: 14),
          ],
        ),
      ),
    );
  }

  Widget _buildDropdown({
    required String hint,
    required String? value,
    required List<String> items,
    required ValueChanged<String?> onChanged,
  }) {
    return Container(
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
          hint: Text(
            hint,
            style: const TextStyle(
                color: AppColors.textMuted, fontSize: 13),
          ),
          items: items.map((item) {
            return DropdownMenuItem<String>(
              value: item,
              child: Text(
                item,
                style: const TextStyle(
                    color: AppColors.textPrimary, fontSize: 13),
              ),
            );
          }).toList(),
          onChanged: onChanged,
          dropdownColor: AppColors.bgCard,
          iconEnabledColor: AppColors.textMuted,
          isExpanded: true,
        ),
      ),
    );
  }

  Widget _buildReportCard({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
  }) {
    return GestureDetector(
      onTap: () {},
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.bgSurface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(9),
              ),
              child: Icon(icon, color: iconColor, size: 17),
            ),
            const SizedBox(height: 8),
            Text(
              title,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 9,
                height: 1.4,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildResultItem({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    String? trailingBadge,
    Color? trailingColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                      color: AppColors.textSecondary, fontSize: 11),
                ),
              ],
            ),
          ),
          if (trailingBadge != null && trailingColor != null)
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: trailingColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                trailingBadge,
                style: TextStyle(
                  color: trailingColor,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
              ),
            )
          else
            const Icon(Icons.chevron_right_rounded,
                color: AppColors.textMuted, size: 16),
        ],
      ),
    );
  }
}
