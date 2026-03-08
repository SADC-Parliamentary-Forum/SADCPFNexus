import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';

class PayslipScreen extends ConsumerStatefulWidget {
  const PayslipScreen({super.key});

  @override
  ConsumerState<PayslipScreen> createState() => _PayslipScreenState();
}

class _PayslipScreenState extends ConsumerState<PayslipScreen> {
  bool _loading = true;
  String? _error;
  List<dynamic> _payslips = [];
  int? _selectedIndex;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _selectedIndex = null;
    });
    try {
      final res = await ref.read(apiClientProvider).dio.get<Map<String, dynamic>>(
            '/finance/payslips',
            queryParameters: {'per_page': 24},
          );
      if (!mounted) return;
      final data = res.data?['data'] ?? res.data;
      final list = data is List ? List<dynamic>.from(data) : <dynamic>[];
      setState(() {
        _payslips = list;
        _loading = false;
        if (list.isNotEmpty) _selectedIndex = 0;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load payslips.';
        _loading = false;
      });
    }
  }

  Map<String, dynamic>? get _selected {
    if (_selectedIndex == null || _selectedIndex! >= _payslips.length) return null;
    final raw = _payslips[_selectedIndex!];
    return raw is Map ? Map<String, dynamic>.from(raw) : null;
  }

  String _periodLabel(Map<String, dynamic> p) {
    final m = p['period_month'];
    final y = p['period_year'];
    if (m != null && y != null) {
      const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      final mn = (m is int) ? m : int.tryParse(m.toString());
      return '${months[mn != null && mn >= 1 && mn <= 12 ? mn : 0]} $y';
    }
    return p['period_label']?.toString() ?? '—';
  }

  double _num(dynamic v) => (v is num) ? v.toDouble() : double.tryParse(v?.toString() ?? '') ?? 0.0;

  String _fmt(double v) =>
      'N\$${v.toStringAsFixed(2).replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+\.)'), (m) => '${m[1]},')}';

  Future<void> _downloadPdf() async {
    final p = _selected;
    if (p == null) return;
    final id = p['id'];
    if (id == null) return;
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get<List<int>>(
        '/finance/payslips/$id/download',
        options: Options(responseType: ResponseType.bytes),
      );
      if (res.data == null || res.data!.isEmpty) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No PDF available for this payslip.')));
        return;
      }
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/payslip_$id.pdf');
      await file.writeAsBytes(res.data!);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Saved: ${file.path}')));
      }
    } catch (e) {
      final msg = e is DioException && e.response?.statusCode == 404
          ? 'Payslip PDF not yet available.'
          : 'Download failed.';
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
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
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Payslip', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [
          if (_selected != null)
            TextButton.icon(
              onPressed: _downloadPdf,
              icon: const Icon(Icons.download_outlined, color: AppColors.primary, size: 16),
              label: const Text('PDF', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700)),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.danger)),
                        const SizedBox(height: 12),
                        TextButton(onPressed: _load, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : _payslips.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.receipt_long_outlined, size: 48, color: AppColors.textMuted),
                          const SizedBox(height: 12),
                          Text('No payslips yet', style: TextStyle(color: AppColors.textMuted, fontSize: 14)),
                          const SizedBox(height: 8),
                          TextButton(onPressed: _load, child: const Text('Refresh')),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      color: AppColors.primary,
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          // Period selector (list of payslips)
                          Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: AppColors.bgSurface,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Row(
                              children: List.generate(_payslips.length, (i) {
                                final p = _payslips[i] is Map ? _payslips[i] as Map<String, dynamic> : <String, dynamic>{};
                                final label = _periodLabel(p);
                                final isSelected = _selectedIndex == i;
                                return Expanded(
                                  child: GestureDetector(
                                    onTap: () => setState(() => _selectedIndex = i),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(vertical: 8),
                                      decoration: BoxDecoration(
                                        color: isSelected ? AppColors.primary : Colors.transparent,
                                        borderRadius: BorderRadius.circular(9),
                                      ),
                                      child: Text(
                                        label.split(' ').first,
                                        textAlign: TextAlign.center,
                                        style: TextStyle(
                                          color: isSelected ? Colors.white : AppColors.textMuted,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                  ),
                                );
                              }),
                            ),
                          ),
                          const SizedBox(height: 16),
                          if (_selected != null) _buildSummaryCard(_selected!),
                          const SizedBox(height: 32),
                        ],
                      ),
                    ),
    );
  }

  Widget _buildSummaryCard(Map<String, dynamic> p) {
    final net = _num(p['net_amount']);
    final gross = _num(p['gross_amount']);
    final deductions = gross - net;
    final periodLabel = _periodLabel(p);
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.primary.withValues(alpha: 0.15), AppColors.bgCard],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
      ),
      child: Column(
        children: [
          Text(periodLabel, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
          const SizedBox(height: 8),
          Text(_fmt(net), style: const TextStyle(color: AppColors.primary, fontSize: 30, fontWeight: FontWeight.w900)),
          const Text('Net Pay', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: Column(
                  children: [
                    Text(_fmt(gross), style: const TextStyle(color: AppColors.success, fontSize: 14, fontWeight: FontWeight.w800)),
                    const Text('Gross', style: TextStyle(color: AppColors.textMuted, fontSize: 10)),
                  ],
                ),
              ),
              Container(width: 1, height: 40, color: AppColors.border),
              Expanded(
                child: Column(
                  children: [
                    Text(_fmt(deductions), style: const TextStyle(color: AppColors.danger, fontSize: 14, fontWeight: FontWeight.w800)),
                    const Text('Deductions', style: TextStyle(color: AppColors.textMuted, fontSize: 10)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
