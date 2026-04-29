import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';

class VendorDetailScreen extends ConsumerStatefulWidget {
  final int vendorId;
  const VendorDetailScreen({super.key, required this.vendorId});

  @override
  ConsumerState<VendorDetailScreen> createState() => _VendorDetailScreenState();
}

class _VendorDetailScreenState extends ConsumerState<VendorDetailScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _vendor;

  // Star rating bottom sheet state
  int _myRating = 0;
  String _myReview = '';
  bool _ratingSubmitting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get<Map<String, dynamic>>(
        '/procurement/vendors/${widget.vendorId}',
      );
      if (!mounted) return;
      final v = Map<String, dynamic>.from(res.data?['data'] as Map? ?? {});
      final myR = v['my_rating'] as Map?;
      setState(() {
        _vendor = v;
        _loading = false;
        _myRating = (myR?['rating'] as int?) ?? 0;
        _myReview = (myR?['review'] as String?) ?? '';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() { _error = 'Failed to load vendor details.'; _loading = false; });
    }
  }

  Future<void> _submitRating() async {
    if (_myRating == 0) return;
    setState(() => _ratingSubmitting = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.post<dynamic>(
        '/procurement/vendors/${widget.vendorId}/ratings',
        data: {
          'rating': _myRating,
          if (_myReview.isNotEmpty) 'review': _myReview,
        },
      );
      if (!mounted) return;
      Navigator.pop(context); // close bottom sheet
      _load(); // refresh vendor data
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Rating saved.'), backgroundColor: AppColors.success),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to save rating.'), backgroundColor: AppColors.danger),
      );
    } finally {
      if (mounted) setState(() => _ratingSubmitting = false);
    }
  }

  void _showRatingSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.bgSurface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => StatefulBuilder(
        builder: (ctx, setBS) => Padding(
          padding: EdgeInsets.only(
            left: 20, right: 20, top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                const Icon(Icons.star_rate_rounded, color: Color(0xFFFBBC04), size: 22),
                const SizedBox(width: 8),
                const Text('Rate this Vendor', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: AppColors.textMuted),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ]),
              const SizedBox(height: 16),
              // Star picker
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(5, (i) {
                  final star = i + 1;
                  return GestureDetector(
                    onTap: () => setBS(() => _myRating = star),
                    child: Icon(
                      star <= _myRating ? Icons.star_rounded : Icons.star_outline_rounded,
                      color: star <= _myRating ? const Color(0xFFFBBC04) : AppColors.textMuted,
                      size: 40,
                    ),
                  );
                }),
              ),
              if (_myRating > 0)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Center(
                    child: Text(
                      ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][_myRating],
                      style: const TextStyle(color: AppColors.primary, fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
              const SizedBox(height: 16),
              TextField(
                style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: 'Write a review (optional)…',
                  hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                  filled: true,
                  fillColor: AppColors.bgDark,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.all(12),
                ),
                onChanged: (v) => _myReview = v,
                controller: TextEditingController(text: _myReview),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.bgDark,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onPressed: _myRating == 0 || _ratingSubmitting ? null : _submitRating,
                  child: _ratingSubmitting
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.bgDark))
                      : const Text('Submit Rating', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
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
          onPressed: () => context.pop(),
        ),
        title: Text(
          _vendor?['name'] as String? ?? 'Vendor Details',
          style: const TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: AppColors.textSecondary),
            onPressed: _load,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? _buildError()
              : _buildBody(),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        const Icon(Icons.error_outline_rounded, size: 40, color: AppColors.danger),
        const SizedBox(height: 12),
        Text(_error!, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
        const SizedBox(height: 16),
        ElevatedButton.icon(
          style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: AppColors.bgDark),
          icon: const Icon(Icons.refresh_rounded, size: 16),
          label: const Text('Retry', style: TextStyle(fontWeight: FontWeight.w700)),
          onPressed: _load,
        ),
      ]),
    );
  }

  Widget _buildBody() {
    final v = _vendor!;
    final isBlacklisted = v['is_blacklisted'] == true;
    final isApproved = v['is_approved'] == true;
    final isSme = v['is_sme'] == true;
    final avg = (v['ratings_avg_rating'] as num?)?.toDouble();
    final ratingsCount = v['ratings_count'] as int? ?? 0;
    final contracts = (v['recent_contracts'] as List<dynamic>?) ?? [];
    final activeContracts = contracts.where((c) => (c as Map)['status'] == 'active').length;

    return RefreshIndicator(
      color: AppColors.primary,
      backgroundColor: AppColors.bgSurface,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          // Blacklist banner
          if (isBlacklisted) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.danger.withValues(alpha: 0.3)),
              ),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Icon(Icons.gpp_bad_rounded, color: AppColors.danger, size: 18),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('Blacklisted Vendor', style: TextStyle(color: AppColors.danger, fontSize: 13, fontWeight: FontWeight.w700)),
                    if (v['blacklist_reason'] != null)
                      Text(v['blacklist_reason'] as String, style: const TextStyle(color: AppColors.danger, fontSize: 11), maxLines: 2, overflow: TextOverflow.ellipsis),
                  ]),
                ),
              ]),
            ),
            const SizedBox(height: 12),
          ],

          // Identity card
          _card(children: [
            Row(children: [
              Container(
                width: 48, height: 48,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                alignment: Alignment.center,
                child: Text(
                  (v['name'] as String? ?? '?')[0].toUpperCase(),
                  style: const TextStyle(color: AppColors.primary, fontSize: 22, fontWeight: FontWeight.w800),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(
                    v['name'] as String? ?? '',
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w800),
                  ),
                  if (v['registration_number'] != null)
                    Text(v['registration_number'] as String, style: const TextStyle(color: AppColors.textMuted, fontSize: 11, fontFamily: 'monospace')),
                ]),
              ),
            ]),
            const SizedBox(height: 10),
            Wrap(spacing: 6, runSpacing: 6, children: [
              if (isBlacklisted)
                _chip('Blacklisted', AppColors.danger)
              else if (isApproved)
                _chip('Approved', AppColors.success)
              else
                _chip('Pending Approval', AppColors.warning),
              if (isSme) _chip('SME', AppColors.info),
              if (v['category'] != null) _chip(v['category'] as String, AppColors.textSecondary),
              if (v['country'] != null) _chip(v['country'] as String, AppColors.textMuted),
            ]),
          ]),

          const SizedBox(height: 12),

          // Contact section
          _card(children: [
            _sectionHeader('Contact Information', Icons.contacts_outlined, AppColors.primary),
            if (v['contact_name'] != null) _row('Contact Person', v['contact_name'] as String),
            if (v['contact_email'] != null) _row('Email', v['contact_email'] as String),
            if (v['contact_phone'] != null) _row('Phone', v['contact_phone'] as String),
            if (v['address'] != null) _row('Address', v['address'] as String),
            if (v['website'] != null) _row('Website', v['website'] as String),
          ]),

          const SizedBox(height: 12),

          // Banking section
          if (v['bank_name'] != null || v['bank_account'] != null)
            Column(children: [
              _card(children: [
                _sectionHeader('Banking Details', Icons.account_balance_outlined, const Color(0xFF6366F1)),
                if (v['bank_name'] != null) _row('Bank', v['bank_name'] as String),
                if (v['bank_account'] != null) _row('Account', v['bank_account'] as String),
                if (v['bank_branch'] != null) _row('Branch', v['bank_branch'] as String),
                if (v['payment_terms'] != null) _row('Payment Terms', v['payment_terms'] as String),
              ]),
              const SizedBox(height: 12),
            ]),

          // Performance summary
          _card(children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              _sectionHeader('Performance', Icons.verified_outlined, const Color(0xFF8B5CF6)),
              TextButton(
                onPressed: _showRatingSheet,
                child: const Text('Rate', style: TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w700)),
              ),
            ]),
            if (avg != null) ...[
              Row(children: [
                Row(
                  children: List.generate(5, (i) => Icon(
                    i < avg.floor()
                        ? Icons.star_rounded
                        : (i == avg.floor() && avg - avg.floor() >= 0.5)
                            ? Icons.star_half_rounded
                            : Icons.star_outline_rounded,
                    color: const Color(0xFFFBBC04),
                    size: 18,
                  )),
                ),
                const SizedBox(width: 8),
                Text(
                  avg.toStringAsFixed(1),
                  style: const TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w800),
                ),
                Text(
                  '  ·  $ratingsCount ${ratingsCount == 1 ? 'rating' : 'ratings'}',
                  style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                ),
              ]),
            ] else
              const Text('No ratings yet. Be the first to rate!', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),

            const SizedBox(height: 8),
            // Active contracts count
            Row(children: [
              const Icon(Icons.description_outlined, size: 14, color: AppColors.textMuted),
              const SizedBox(width: 6),
              Text(
                '$activeContracts active contract${activeContracts == 1 ? '' : 's'}',
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
              ),
            ]),
          ]),

          const SizedBox(height: 12),

          // Quick stats
          Row(children: [
            Expanded(child: _statBox('Quotes', '${v['quotes_count'] ?? 0}', Icons.request_quote_outlined, AppColors.primary)),
            const SizedBox(width: 10),
            Expanded(child: _statBox('Contracts', '$activeContracts', Icons.description_outlined, AppColors.success)),
          ]),
        ],
      ),
    );
  }

  Widget _card({required List<Widget> children}) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
    );
  }

  Widget _sectionHeader(String title, IconData icon, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(children: [
        Container(
          width: 28, height: 28,
          decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
          alignment: Alignment.center,
          child: Icon(icon, size: 14, color: color),
        ),
        const SizedBox(width: 8),
        Text(title, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
      ]),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(width: 110, child: Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 11))),
        Expanded(child: Text(value, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600))),
      ]),
    );
  }

  Widget _chip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(label, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w700)),
    );
  }

  Widget _statBox(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Row(children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(width: 8),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(value, style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.w800)),
          Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
        ]),
      ]),
    );
  }
}
