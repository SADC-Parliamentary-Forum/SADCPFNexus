import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class UserSupportHealthScreen extends StatefulWidget {
  const UserSupportHealthScreen({super.key});
  @override
  State<UserSupportHealthScreen> createState() => _UserSupportHealthScreenState();
}

class _UserSupportHealthScreenState extends State<UserSupportHealthScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  final _tickets = [
    {'id': '#TKT-0441', 'title': 'Cannot access Leave module', 'status': 'Open', 'priority': 'High', 'created': '2 days ago'},
    {'id': '#TKT-0438', 'title': 'Report export not working', 'status': 'In Progress', 'priority': 'Medium', 'created': '4 days ago'},
    {'id': '#TKT-0431', 'title': 'Dashboard data not refreshing', 'status': 'Resolved', 'priority': 'Low', 'created': '1 week ago'},
  ];

  final _systemChecks = [
    {'service': 'API Server', 'status': 'Operational', 'latency': '42ms'},
    {'service': 'Database', 'status': 'Operational', 'latency': '8ms'},
    {'service': 'File Storage', 'status': 'Operational', 'latency': '120ms'},
    {'service': 'Push Notifications', 'status': 'Degraded', 'latency': '—'},
    {'service': 'Biometric Auth', 'status': 'Operational', 'latency': '35ms'},
    {'service': 'WORM Archive', 'status': 'Operational', 'latency': '220ms'},
  ];

  final _faqs = [
    {'q': 'How do I reset my biometric PIN?', 'a': 'Go to Profile > Security > Reset Biometric. You will need your employee ID and HR approval.'},
    {'q': 'Why is my travel request stuck?', 'a': 'Travel requests require sequential approvals. Check the approval chain in the request detail page.'},
    {'q': 'Can I edit a submitted imprest?', 'a': 'Once submitted for approval, imprests cannot be edited. Contact Finance to withdraw and resubmit.'},
    {'q': 'How do I switch to offline mode?', 'a': 'Drafts are automatically saved offline. Use the Offline Drafts screen to manage pending submissions.'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('Support & Health', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        bottom: TabBar(
          controller: _tabs,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textMuted,
          indicatorColor: AppColors.primary,
          indicatorSize: TabBarIndicatorSize.label,
          labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
          tabs: const [Tab(text: 'My Tickets'), Tab(text: 'System'), Tab(text: 'FAQ')],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [_ticketsTab(), _systemTab(), _faqTab()],
      ),
    );
  }

  Widget _ticketsTab() => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      SizedBox(width: double.infinity, height: 44,
        child: ElevatedButton.icon(
          onPressed: () {},
          style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: AppColors.bgDark,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
          icon: const Icon(Icons.add, size: 16),
          label: const Text('New Support Ticket', style: TextStyle(fontWeight: FontWeight.w700)),
        ),
      ),
      const SizedBox(height: 16),
      const Text('MY TICKETS', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
      const SizedBox(height: 10),
      ..._tickets.map((t) {
        final statusColor = t['status'] == 'Open' ? AppColors.danger : (t['status'] == 'In Progress' ? AppColors.warning : AppColors.success);
        final priorityColor = t['priority'] == 'High' ? AppColors.danger : (t['priority'] == 'Medium' ? AppColors.warning : AppColors.success);
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Text(t['id']!, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
              const Spacer(),
              Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: priorityColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(4)),
                child: Text(t['priority']!, style: TextStyle(color: priorityColor, fontSize: 9, fontWeight: FontWeight.w700))),
            ]),
            const SizedBox(height: 6),
            Text(t['title']!, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Row(children: [
              Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
                child: Text(t['status']!, style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w700))),
              const Spacer(),
              Text(t['created']!, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
            ]),
          ]),
        );
      }),
    ],
  );

  Widget _systemTab() {
    final operational = _systemChecks.where((s) => s['status'] == 'Operational').length;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: AppColors.success.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.success.withValues(alpha: 0.3))),
          child: Row(children: [
            const Icon(Icons.check_circle, color: AppColors.success, size: 22),
            const SizedBox(width: 12),
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('System Status', style: TextStyle(color: AppColors.success, fontSize: 14, fontWeight: FontWeight.w700)),
              Text('$operational/${_systemChecks.length} services operational', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
            ]),
          ]),
        ),
        const SizedBox(height: 16),
        ..._systemChecks.map((s) {
          final isOk = s['status'] == 'Operational';
          final color = isOk ? AppColors.success : AppColors.warning;
          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
            child: Row(children: [
              Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
              const SizedBox(width: 12),
              Expanded(child: Text(s['service']!, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13))),
              Text(s['latency']!, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
              const SizedBox(width: 10),
              Text(s['status']!, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
            ]),
          );
        }),
      ],
    );
  }

  Widget _faqTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: _faqs.map((faq) => _faqItem(faq['q']!, faq['a']!)).toList(),
    );
  }

  Widget _faqItem(String q, String a) => Container(
    margin: const EdgeInsets.only(bottom: 10),
    decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
    child: Theme(
      data: ThemeData(dividerColor: Colors.transparent, colorScheme: const ColorScheme.light()),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
        title: Text(q, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
        iconColor: AppColors.primary,
        collapsedIconColor: AppColors.textMuted,
        children: [Text(a, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, height: 1.5))],
      ),
    ),
  );
}
