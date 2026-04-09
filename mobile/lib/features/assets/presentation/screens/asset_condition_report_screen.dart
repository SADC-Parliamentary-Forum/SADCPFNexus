import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';

class AssetConditionReportScreen extends ConsumerStatefulWidget {
  const AssetConditionReportScreen({super.key});

  @override
  ConsumerState<AssetConditionReportScreen> createState() =>
      _AssetConditionReportScreenState();
}

class _AssetConditionReportScreenState
    extends ConsumerState<AssetConditionReportScreen> {
  int _condition = 4;
  String _category = 'Minor Wear';
  final _notesCtrl = TextEditingController();
  bool _loading = true;
  bool _submitting = false;
  String? _error;
  String? _selectedAssetId;
  List<Map<String, dynamic>> _assets = [];

  final _conditionLabels = const {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very Good',
    5: 'Excellent',
  };

  final _categories = const [
    'No Issues',
    'Minor Wear',
    'Damage',
    'Missing Parts',
    'Needs Service',
  ];

  @override
  void initState() {
    super.initState();
    _loadAssets();
  }

  Future<void> _loadAssets() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ref.read(apiClientProvider).dio.get<Map<String, dynamic>>(
        '/assets',
        queryParameters: {'assigned_to': 'me', 'per_page': 50},
      );
      final data = res.data?['data'] as List<dynamic>? ?? const [];
      if (!mounted) return;
      setState(() {
        _assets = data
            .map((item) => item is Map ? Map<String, dynamic>.from(item) : <String, dynamic>{})
            .toList();
        _selectedAssetId =
            _assets.isNotEmpty ? _assets.first['id']?.toString() : null;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load assigned assets.';
        _loading = false;
      });
    }
  }

  Map<String, dynamic>? get _selectedAsset {
    for (final asset in _assets) {
      if (asset['id']?.toString() == _selectedAssetId) return asset;
    }
    return null;
  }

  Future<void> _submit() async {
    final asset = _selectedAsset;
    if (asset == null) return;
    setState(() => _submitting = true);
    try {
      await ref.read(apiClientProvider).dio.post(
        '/support/tickets',
        data: {
          'subject': 'Asset condition report: ${asset['name'] ?? asset['asset_code'] ?? 'Asset'}',
          'description':
              'Asset ID: ${asset['id']}\nAsset Code: ${asset['asset_code'] ?? '-'}\nCondition: ${_conditionLabels[_condition]}\nIssue Category: $_category\nNotes: ${_notesCtrl.text.trim().isEmpty ? '-' : _notesCtrl.text.trim()}',
          'priority': _condition <= 2 || _category == 'Needs Service' ? 'high' : 'medium',
        },
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Condition report submitted as a support ticket.'),
          backgroundColor: AppColors.success,
        ),
      );
      Navigator.pop(context);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to submit condition report.'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  void dispose() {
    _notesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final asset = _selectedAsset;
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios_new,
            size: 18,
            color: AppColors.textPrimary,
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Condition Report',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _error!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AppColors.danger),
                        ),
                        const SizedBox(height: 12),
                        TextButton(onPressed: _loadAssets, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    DropdownButtonFormField<String>(
                      value: _selectedAssetId,
                      decoration: InputDecoration(
                        labelText: 'Assigned Asset',
                        labelStyle: const TextStyle(color: AppColors.textMuted),
                        filled: true,
                        fillColor: AppColors.bgSurface,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      items: _assets
                          .map(
                            (asset) => DropdownMenuItem(
                              value: asset['id']?.toString(),
                              child: Text(
                                '${asset['name'] ?? 'Asset'} (${asset['asset_code'] ?? '-'})',
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: (value) {
                        setState(() => _selectedAssetId = value);
                      },
                    ),
                    const SizedBox(height: 16),
                    if (asset != null)
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.bgSurface,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              asset['name']?.toString() ?? 'Asset',
                              style: const TextStyle(
                                color: AppColors.textPrimary,
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Code: ${asset['asset_code'] ?? '-'}',
                              style: const TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Status: ${asset['status'] ?? '-'}',
                              style: const TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                    const SizedBox(height: 20),
                    Text(
                      _conditionLabels[_condition] ?? 'Condition',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(5, (index) {
                        final value = index + 1;
                        final selected = value == _condition;
                        return GestureDetector(
                          onTap: () => setState(() => _condition = value),
                          child: Container(
                            margin: const EdgeInsets.symmetric(horizontal: 6),
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: selected
                                  ? AppColors.primary.withValues(alpha: 0.2)
                                  : AppColors.bgSurface,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: selected
                                    ? AppColors.primary
                                    : AppColors.border,
                                width: selected ? 2 : 1,
                              ),
                            ),
                            child: Center(
                              child: Text(
                                '$value',
                                style: TextStyle(
                                  color: selected
                                      ? AppColors.primary
                                      : AppColors.textMuted,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                        );
                      }),
                    ),
                    const SizedBox(height: 20),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _categories.map((cat) {
                        final active = _category == cat;
                        return GestureDetector(
                          onTap: () => setState(() => _category = cat),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 8,
                            ),
                            decoration: BoxDecoration(
                              color: active
                                  ? AppColors.primary.withValues(alpha: 0.15)
                                  : AppColors.bgSurface,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color:
                                    active ? AppColors.primary : AppColors.border,
                              ),
                            ),
                            child: Text(
                              cat,
                              style: TextStyle(
                                color: active
                                    ? AppColors.primary
                                    : AppColors.textSecondary,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _notesCtrl,
                      maxLines: 4,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 13,
                      ),
                      decoration: InputDecoration(
                        hintText:
                            'Describe the issue, visible damage, or service need...',
                        hintStyle: const TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 12,
                        ),
                        filled: true,
                        fillColor: AppColors.bgSurface,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton(
                        onPressed: _submitting ? null : _submit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: AppColors.bgDark,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: _submitting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: AppColors.bgDark,
                                ),
                              )
                            : const Text(
                                'Submit Condition Report',
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 15,
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
    );
  }
}
