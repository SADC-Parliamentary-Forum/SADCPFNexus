import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/core/theme/app_theme.dart';
import 'package:sadcpf_nexus/features/procurement/data/procurement_api_helpers.dart';
import 'package:sadcpf_nexus/shared/widgets/stitch_screen.dart';

class RiskRegisterScreen extends ConsumerStatefulWidget {
  const RiskRegisterScreen({super.key});

  @override
  ConsumerState<RiskRegisterScreen> createState() => _RiskRegisterScreenState();
}

class _RiskRegisterScreenState extends ConsumerState<RiskRegisterScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _risks = [];
  List<Map<String, dynamic>> _kris = [];

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final results = await Future.wait([
        dio.get('/risk/risks', queryParameters: {'per_page': 50}),
        dio.get('/risk/kris'),
      ]);
      if (!mounted) return;
      setState(() {
        _risks = extractListData(results[0].data);
        _kris = extractListData(results[1].data);
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load risk register.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return StitchScreen(
      title: 'Risk register',
      bottom: TabBar(
        controller: _tabs,
        labelColor: AppColors.primary,
        unselectedLabelColor: AppColors.textMuted,
        indicatorColor: AppColors.primary,
        tabs: const [Tab(text: 'Risks'), Tab(text: 'KRIs')],
      ),
      actions: [
        StitchIconAction(
          tooltip: 'Refresh',
          icon: Icons.refresh,
          onPressed: _load,
        ),
      ],
      body: _loading
          ? const StitchLoadingState(label: 'Loading risks')
          : _error != null
              ? StitchErrorState(message: _error!, onRetry: _load)
              : TabBarView(
                  controller: _tabs,
                  children: [_risksTab(), _krisTab()],
                ),
    );
  }

  Widget _risksTab() {
    if (_risks.isEmpty) {
      return const StitchEmptyState(
        icon: Icons.warning_amber_outlined,
        title: 'No risks found.',
      );
    }
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _risks.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final r = _risks[i];
          final id = r['id'];
          return ListTile(
            tileColor: AppColors.bgSurface,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: AppColors.border),
            ),
            title: Text(r['title']?.toString() ?? r['name']?.toString() ?? 'Risk',
                style: const TextStyle(
                    color: AppColors.textPrimary, fontWeight: FontWeight.w700)),
            subtitle: Text(
              '${r['status'] ?? '—'} · residual ${r['residual_rating'] ?? r['residual_score'] ?? '—'}',
              style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
            ),
            trailing:
                const Icon(Icons.chevron_right, color: AppColors.textMuted),
            onTap: id == null ? null : () => context.push('/risk/$id'),
          );
        },
      ),
    );
  }

  Widget _krisTab() {
    if (_kris.isEmpty) {
      return const StitchEmptyState(
        icon: Icons.insights_outlined,
        title: 'No KRIs available (read-only).',
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _kris.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, i) {
        final k = _kris[i];
        return ListTile(
          tileColor: AppColors.bgSurface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: AppColors.border),
          ),
          title: Text(k['name']?.toString() ?? k['title']?.toString() ?? 'KRI',
              style: const TextStyle(
                  color: AppColors.textPrimary, fontWeight: FontWeight.w600)),
          subtitle: Text(
            'Value: ${k['current_value'] ?? k['value'] ?? '—'} · status ${k['status'] ?? '—'}',
            style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
          ),
        );
      },
    );
  }
}
