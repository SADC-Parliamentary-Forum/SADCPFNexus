import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class TimesheetsIncidentsScreen extends StatefulWidget {
  const TimesheetsIncidentsScreen({super.key});

  @override
  State<TimesheetsIncidentsScreen> createState() =>
      _TimesheetsIncidentsScreenState();
}

class _TimesheetsIncidentsScreenState extends State<TimesheetsIncidentsScreen>
    with SingleTickerProviderStateMixin {
  int _selectedNav = 1; // Governance active
  int _selectedTab = 0; // This Week | History
  int _selectedDay = 2; // Wednesday (index 2 = Wed 14 = today)

  static const _weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  static const _weekDates = [12, 13, 14, 15, 16, 17, 18];

  static const _activities = [
    _Activity(
      title: 'Parl. Procedures',
      time: '09:00 AM - 12:00 PM',
      duration: '3.5h',
      status: 'Approved',
    ),
    _Activity(
      title: 'Policy Review',
      time: '01:30 PM - 04:00 PM',
      duration: '2.5h',
      status: 'Pending',
    ),
  ];

  static const _cases = [
    _IncidentCase(
      caseId: '#2023-001',
      title: 'Unauthorized Access Attempt',
      badge: 'Hearing Workflow',
      badgeColor: AppColors.info,
      description:
          'Security breach reported in Sector 4 server room. Pending review by the disciplinary committee.',
      avatarCount: 2,
      timeAgo: '3d ago',
    ),
    _IncidentCase(
      caseId: '#2023-052',
      title: 'Asset Misallocation',
      badge: 'Investigation',
      badgeColor: AppColors.warning,
      description:
          'Discrepancies found in quarterly asset reconciliation. Finance department under review.',
      avatarCount: 3,
      timeAgo: '3d ago',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      body: SafeArea(
        child: Column(
          children: [
            _buildAppBar(),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                children: [
                  _buildDailyLogSection(),
                  const SizedBox(height: 20),
                  _buildIncidentManagementSection(),
                  const SizedBox(height: 16),
                ],
              ),
            ),
            _buildBottomNav(),
          ],
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.border),
              ),
              child: const Icon(Icons.arrow_back_ios_new,
                  size: 16, color: AppColors.textPrimary),
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Text(
              'Timesheets & Incidents',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.bgSurface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.border),
            ),
            child: const Icon(Icons.calendar_month_outlined,
                size: 18, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildDailyLogSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section header + tab toggle
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Daily Log',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            Container(
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: ['This Week', 'History'].asMap().entries.map((entry) {
                  final i = entry.key;
                  final label = entry.value;
                  final isActive = i == _selectedTab;
                  return GestureDetector(
                    onTap: () => setState(() => _selectedTab = i),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: isActive ? AppColors.primary : Colors.transparent,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        label,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: isActive
                              ? AppColors.bgDark
                              : AppColors.textSecondary,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Weekly calendar row
        Container(
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(_weekDays.length, (i) {
              final isToday = i == 2; // Wed 14
              final isSelected = i == _selectedDay;
              return GestureDetector(
                onTap: () => setState(() => _selectedDay = i),
                child: Column(
                  children: [
                    Text(
                      _weekDays[i],
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                        color: isSelected
                            ? AppColors.primary
                            : AppColors.textMuted,
                      ),
                    ),
                    const SizedBox(height: 6),
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: isSelected
                            ? AppColors.primary
                            : (isToday
                                ? AppColors.primary.withValues(alpha: 0.12)
                                : Colors.transparent),
                        shape: BoxShape.circle,
                        border: isToday && !isSelected
                            ? Border.all(
                                color: AppColors.primary.withValues(alpha: 0.5))
                            : null,
                      ),
                      child: Center(
                        child: Text(
                          '${_weekDates[i]}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: isSelected
                                ? AppColors.bgDark
                                : (isToday
                                    ? AppColors.primary
                                    : AppColors.textSecondary),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }),
          ),
        ),
        const SizedBox(height: 12),

        // Activity list
        ..._activities.map((a) => _ActivityCard(activity: a)),
        const SizedBox(height: 10),

        // Log New Activity button
        GestureDetector(
          onTap: () {},
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 13),
            decoration: BoxDecoration(
              border: Border.all(color: AppColors.primary),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.add, size: 16, color: AppColors.primary),
                SizedBox(width: 6),
                Text(
                  'Log New Activity',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildIncidentManagementSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Incident Management',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 12),

        // Quick Report Incident card
        GestureDetector(
          onTap: () {},
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppColors.warning.withValues(alpha: 0.25),
                  AppColors.warning.withValues(alpha: 0.1),
                ],
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
              ),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.warning.withValues(alpha: 0.4)),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.warning_amber_outlined,
                      color: AppColors.warning, size: 24),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Quick Report Incident',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Flag urgent security or ethics issues →',
                        style: TextStyle(
                          fontSize: 11,
                          color: AppColors.warning,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right,
                    color: AppColors.warning, size: 20),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),

        // Active Cases header
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'ACTIVE CASES',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: AppColors.textSecondary,
                letterSpacing: 1.2,
              ),
            ),
            GestureDetector(
              onTap: () {},
              child: const Text(
                'View All',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primary,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        ..._cases.map((c) => _IncidentCaseCard(caseData: c)),
      ],
    );
  }

  Widget _buildBottomNav() {
    final items = [
      (icon: Icons.home_outlined, activeIcon: Icons.home, label: 'Home'),
      (icon: Icons.gavel_outlined, activeIcon: Icons.gavel, label: 'Governance'),
      (icon: Icons.analytics_outlined, activeIcon: Icons.analytics, label: 'Reports'),
      (icon: Icons.person_outline, activeIcon: Icons.person, label: 'Profile'),
    ];

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.bgSurface,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 64,
          child: Row(
            children: items.asMap().entries.map((entry) {
              final i = entry.key;
              final item = entry.value;
              final isActive = i == _selectedNav;
              return Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _selectedNav = i),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 4),
                        decoration: BoxDecoration(
                          color: isActive
                              ? AppColors.primary.withValues(alpha: 0.15)
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Icon(
                          isActive ? item.activeIcon : item.icon,
                          color: isActive
                              ? AppColors.primary
                              : AppColors.textSecondary,
                          size: 22,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        item.label,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight:
                              isActive ? FontWeight.w600 : FontWeight.w400,
                          color: isActive
                              ? AppColors.primary
                              : AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }
}

// ── Data models ───────────────────────────────────────────────────────────────
class _Activity {
  final String title;
  final String time;
  final String duration;
  final String status;
  const _Activity({
    required this.title,
    required this.time,
    required this.duration,
    required this.status,
  });
}

class _IncidentCase {
  final String caseId;
  final String title;
  final String badge;
  final Color badgeColor;
  final String description;
  final int avatarCount;
  final String timeAgo;
  const _IncidentCase({
    required this.caseId,
    required this.title,
    required this.badge,
    required this.badgeColor,
    required this.description,
    required this.avatarCount,
    required this.timeAgo,
  });
}

// ── Sub-widgets ───────────────────────────────────────────────────────────────
class _ActivityCard extends StatelessWidget {
  final _Activity activity;
  const _ActivityCard({required this.activity});

  @override
  Widget build(BuildContext context) {
    final isApproved = activity.status == 'Approved';
    final statusColor = isApproved ? AppColors.success : AppColors.warning;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 3,
            height: 48,
            decoration: BoxDecoration(
              color: statusColor,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  activity.title,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  activity.time,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                  border:
                      Border.all(color: statusColor.withValues(alpha: 0.3)),
                ),
                child: Text(
                  activity.status,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: statusColor,
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                activity.duration,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _IncidentCaseCard extends StatelessWidget {
  final _IncidentCase caseData;
  const _IncidentCaseCard({required this.caseData});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'CASE ${caseData.caseId}',
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textMuted,
                  fontFamily: 'monospace',
                ),
              ),
              const Spacer(),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: caseData.badgeColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  caseData.badge,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: caseData.badgeColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            caseData.title,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            caseData.description,
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              // Avatar stack
              SizedBox(
                width: caseData.avatarCount * 20.0 + 8,
                height: 24,
                child: Stack(
                  children: List.generate(caseData.avatarCount, (i) {
                    final colors = [
                      AppColors.primary,
                      AppColors.info,
                      AppColors.gold,
                    ];
                    return Positioned(
                      left: i * 18.0,
                      child: Container(
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          color: colors[i % colors.length]
                              .withValues(alpha: 0.3),
                          shape: BoxShape.circle,
                          border: Border.all(
                              color: AppColors.bgSurface, width: 1.5),
                        ),
                        child: Icon(
                          Icons.person,
                          size: 12,
                          color: colors[i % colors.length],
                        ),
                      ),
                    );
                  }),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'Uploaded ${caseData.timeAgo}',
                style: const TextStyle(
                  fontSize: 10,
                  color: AppColors.textMuted,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
