import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class AssetConditionReportScreen extends StatefulWidget {
  const AssetConditionReportScreen({super.key});
  @override
  State<AssetConditionReportScreen> createState() => _AssetConditionReportScreenState();
}

class _AssetConditionReportScreenState extends State<AssetConditionReportScreen> {
  int _condition = 4; // 1-5
  String _category = 'Minor Wear';
  final _notesCtrl = TextEditingController();
  bool _submitting = false;

  final _conditionLabels = {1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very Good', 5: 'Excellent'};
  final _conditionColors = {
    1: AppColors.danger, 2: AppColors.warning, 3: AppColors.info,
    4: AppColors.success, 5: AppColors.primary,
  };

  final _categories = ['No Issues', 'Minor Wear', 'Damage', 'Missing Parts', 'Needs Service'];

  @override
  void dispose() {
    _notesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('Condition Report', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Asset info card
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
            child: Row(children: [
              Container(width: 52, height: 52,
                decoration: BoxDecoration(color: AppColors.bgDark, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
                child: const Icon(Icons.laptop_mac, color: AppColors.textSecondary, size: 28)),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('MacBook Pro 16" M2', style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                const Text('SADC-TT-2304', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
                const SizedBox(height: 4),
                Row(children: [
                  Container(width: 6, height: 6, decoration: const BoxDecoration(color: AppColors.success, shape: BoxShape.circle)),
                  const SizedBox(width: 4),
                  const Text('Last Inspected: 12 Oct 2023', style: TextStyle(color: AppColors.textMuted, fontSize: 10)),
                ]),
              ])),
            ]),
          ),
          const SizedBox(height: 20),
          // Condition rating
          const Text('CONDITION RATING', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
            child: Column(children: [
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Text(_conditionLabels[_condition]!, style: TextStyle(
                  color: _conditionColors[_condition], fontSize: 22, fontWeight: FontWeight.w800)),
              ]),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(5, (i) {
                  final val = i + 1;
                  final selected = val == _condition;
                  final color = _conditionColors[val]!;
                  return GestureDetector(
                    onTap: () => setState(() => _condition = val),
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 6),
                      width: 44, height: 44,
                      decoration: BoxDecoration(
                        color: selected ? color.withValues(alpha: 0.2) : AppColors.bgDark,
                        shape: BoxShape.circle,
                        border: Border.all(color: selected ? color : AppColors.border, width: selected ? 2 : 1),
                      ),
                      child: Center(child: Text('$val', style: TextStyle(color: selected ? color : AppColors.textMuted, fontSize: 16, fontWeight: FontWeight.w700))),
                    ),
                  );
                }),
              ),
              const SizedBox(height: 12),
              const Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text('Poor', style: TextStyle(color: AppColors.textMuted, fontSize: 10)),
                Text('Excellent', style: TextStyle(color: AppColors.textMuted, fontSize: 10)),
              ]),
            ]),
          ),
          const SizedBox(height: 16),
          const Text('ISSUE CATEGORY', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8, runSpacing: 8,
            children: _categories.map((cat) {
              final active = _category == cat;
              return GestureDetector(
                onTap: () => setState(() => _category = cat),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: active ? AppColors.primary.withValues(alpha: 0.15) : AppColors.bgSurface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: active ? AppColors.primary : AppColors.border),
                  ),
                  child: Text(cat, style: TextStyle(
                    color: active ? AppColors.primary : AppColors.textSecondary,
                    fontSize: 12, fontWeight: FontWeight.w600,
                  )),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          // Photo evidence
          const Text('PHOTO EVIDENCE', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
            child: Row(children: [
              GestureDetector(
                onTap: () {},
                child: Container(
                  width: 72, height: 72,
                  decoration: BoxDecoration(color: AppColors.bgDark, borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.primary.withValues(alpha: 0.4), width: 1.5)),
                  child: const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Icon(Icons.add_a_photo, color: AppColors.primary, size: 22),
                    SizedBox(height: 4),
                    Text('Add Photo', style: TextStyle(color: AppColors.primary, fontSize: 9, fontWeight: FontWeight.w700)),
                  ]),
                ),
              ),
              const SizedBox(width: 10),
              const Expanded(child: Text('Add up to 5 photos to document asset condition. Photos will be stored in Evidence Vault.',
                style: TextStyle(color: AppColors.textMuted, fontSize: 11))),
            ]),
          ),
          const SizedBox(height: 16),
          // Notes
          const Text('NOTES', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 10),
          Container(
            decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
            child: TextField(
              controller: _notesCtrl,
              maxLines: 4,
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
              decoration: const InputDecoration(
                hintText: 'Describe condition, visible damage, or notes for maintenance team...',
                hintStyle: TextStyle(color: AppColors.textMuted, fontSize: 12),
                border: InputBorder.none,
                contentPadding: EdgeInsets.all(14),
              ),
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(width: double.infinity, height: 50,
            child: ElevatedButton(
              onPressed: _submitting ? null : () async {
                setState(() => _submitting = true);
                await Future.delayed(const Duration(seconds: 1));
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Condition report submitted successfully'), backgroundColor: AppColors.success));
                  Navigator.pop(context);
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: AppColors.bgDark,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
              child: _submitting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.bgDark))
                  : const Text('Submit Condition Report', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}
