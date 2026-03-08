import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/utils/date_format.dart';

class UserSupportHealthScreen extends ConsumerStatefulWidget {
  const UserSupportHealthScreen({super.key});
  @override
  ConsumerState<UserSupportHealthScreen> createState() => _UserSupportHealthScreenState();
}

class _UserSupportHealthScreenState extends ConsumerState<UserSupportHealthScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  bool _loadingTickets = true;
  String? _ticketsError;
  List<Map<String, dynamic>> _tickets = [];

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _loadTickets();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _loadTickets() async {
    setState(() { _loadingTickets = true; _ticketsError = null; });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get<Map<String, dynamic>>('/support/tickets', queryParameters: {'per_page': 50});
      if (!mounted) return;
      final data = res.data?['data'] as List<dynamic>?;
      setState(() {
        _tickets = (data ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _loadingTickets = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() { _ticketsError = 'Failed to load tickets.'; _loadingTickets = false; });
    }
  }

  void _showNewTicketDialog() {
    final subjectCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    var priority = 'medium';
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialog) => AlertDialog(
          backgroundColor: AppColors.bgSurface,
          title: const Text('New Support Ticket', style: TextStyle(color: AppColors.textPrimary)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: subjectCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Subject',
                    border: OutlineInputBorder(),
                    labelStyle: TextStyle(color: AppColors.textSecondary),
                  ),
                  style: const TextStyle(color: AppColors.textPrimary),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: descCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Description (optional)',
                    border: OutlineInputBorder(),
                    labelStyle: TextStyle(color: AppColors.textSecondary),
                  ),
                  style: const TextStyle(color: AppColors.textPrimary),
                  maxLines: 3,
                ),
                const SizedBox(height: 12),
                const Text('Priority', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                Row(
                  children: [
                    ChoiceChip(
                      label: const Text('Low'),
                      selected: priority == 'low',
                      onSelected: (_) => setDialog(() => priority = 'low'),
                      selectedColor: AppColors.primary.withValues(alpha: 0.3),
                    ),
                    const SizedBox(width: 8),
                    ChoiceChip(
                      label: const Text('Medium'),
                      selected: priority == 'medium',
                      onSelected: (_) => setDialog(() => priority = 'medium'),
                      selectedColor: AppColors.primary.withValues(alpha: 0.3),
                    ),
                    const SizedBox(width: 8),
                    ChoiceChip(
                      label: const Text('High'),
                      selected: priority == 'high',
                      onSelected: (_) => setDialog(() => priority = 'high'),
                      selectedColor: AppColors.primary.withValues(alpha: 0.3),
                    ),
                  ],
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            FilledButton(
              onPressed: () async {
                if (subjectCtrl.text.trim().isEmpty) return;
                Navigator.pop(ctx);
                try {
                  final dio = ref.read(apiClientProvider).dio;
                  await dio.post('/support/tickets', data: {
                    'subject': subjectCtrl.text.trim(),
                    'description': descCtrl.text.trim().isEmpty ? null : descCtrl.text.trim(),
                    'priority': priority,
                  });
                  if (mounted) _loadTickets();
                } catch (_) {
                  if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to create ticket.')));
                }
              },
              child: const Text('Submit'),
            ),
          ],
        ),
      ),
    );
  }

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
      SizedBox(
        width: double.infinity,
        height: 44,
        child: ElevatedButton.icon(
          onPressed: _showNewTicketDialog,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: AppColors.bgDark,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
          icon: const Icon(Icons.add, size: 16),
          label: const Text('New Support Ticket', style: TextStyle(fontWeight: FontWeight.w700)),
        ),
      ),
      const SizedBox(height: 16),
      const Text('MY TICKETS', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
      const SizedBox(height: 10),
      if (_loadingTickets)
        const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator(color: AppColors.primary)))
      else if (_ticketsError != null)
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Text(_ticketsError!, style: const TextStyle(color: AppColors.danger)),
              const SizedBox(height: 8),
              TextButton(onPressed: _loadTickets, child: const Text('Retry')),
            ],
          ),
        )
      else if (_tickets.isEmpty)
        const Padding(padding: EdgeInsets.all(16), child: Text('No tickets yet.', style: TextStyle(color: AppColors.textMuted)))
      else
        ..._tickets.map((t) {
          final status = (t['status'] as String?) ?? 'open';
          final statusLabel = status == 'in_progress' ? 'In Progress' : (status == 'open' ? 'Open' : status == 'resolved' ? 'Resolved' : status);
          final statusColor = status == 'open' ? AppColors.danger : (status == 'in_progress' ? AppColors.warning : AppColors.success);
          final pri = (t['priority'] as String?) ?? 'medium';
          final priorityLabel = pri == 'high' ? 'High' : (pri == 'low' ? 'Low' : 'Medium');
          final priorityColor = pri == 'high' ? AppColors.danger : (pri == 'medium' ? AppColors.warning : AppColors.success);
          final createdAt = t['created_at'] != null ? AppDateFormatter.short(t['created_at'] as String) : '—';
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text('#${t['reference_number'] ?? t['id']}', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: priorityColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(4)),
                      child: Text(priorityLabel, style: TextStyle(color: priorityColor, fontSize: 9, fontWeight: FontWeight.w700)),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(t['subject'] as String? ?? '', style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
                      child: Text(statusLabel, style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w700)),
                    ),
                    const Spacer(),
                    Text(createdAt, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                  ],
                ),
              ],
            ),
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
