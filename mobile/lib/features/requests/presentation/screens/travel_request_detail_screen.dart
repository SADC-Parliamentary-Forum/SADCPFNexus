import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/router/safe_back.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/date_format.dart';

class TravelRequestDetailScreen extends ConsumerStatefulWidget {
  const TravelRequestDetailScreen({super.key, this.requestId});

  final String? requestId;

  @override
  ConsumerState<TravelRequestDetailScreen> createState() =>
      _TravelRequestDetailScreenState();
}

class _TravelRequestDetailScreenState
    extends ConsumerState<TravelRequestDetailScreen> {
  bool _loading = true;
  bool _withdrawing = false;
  String? _error;
  Map<String, dynamic>? _request;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final requestId = widget.requestId;
    if (requestId == null || requestId.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Missing request ID.';
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final res = await ref
          .read(apiClientProvider)
          .dio
          .get<Map<String, dynamic>>('/travel/requests/$requestId');
      final data = res.data?['data'];
      if (!mounted) return;
      setState(() {
        _request =
            data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load travel request.';
        _loading = false;
      });
    }
  }

  Future<void> _withdraw() async {
    final requestId = widget.requestId;
    if (requestId == null || requestId.isEmpty) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Withdraw request?'),
        content: const Text(
          'This will delete the request if it is still in draft status.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Withdraw'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _withdrawing = true);
    try {
      await ref.read(apiClientProvider).dio.delete('/travel/requests/$requestId');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Travel request withdrawn.'),
          backgroundColor: AppColors.success,
        ),
      );
      context.safePopOrGoHome();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Only draft requests can be withdrawn.'),
          backgroundColor: AppColors.warning,
        ),
      );
    } finally {
      if (mounted) setState(() => _withdrawing = false);
    }
  }

  String _statusLabel(String? status) {
    switch ((status ?? '').toLowerCase()) {
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'draft':
        return 'Draft';
      case 'submitted':
        return 'Pending Approval';
      default:
        return status == null || status.isEmpty ? 'Unknown' : status;
    }
  }

  Color _statusColor(String? status, ColorScheme c) {
    switch ((status ?? '').toLowerCase()) {
      case 'approved':
        return c.primary;
      case 'rejected':
        return c.error;
      case 'draft':
        return c.onSurface.withValues(alpha: 0.6);
      default:
        return c.secondary;
    }
  }

  String _money(dynamic value, [String currency = 'NAD']) {
    final amount = value is num ? value.toDouble() : double.tryParse('$value');
    if (amount == null) return '-';
    return '$currency ${amount.toStringAsFixed(2)}';
  }

  String _dateRange(Map<String, dynamic> request) {
    final start = request['departure_date']?.toString();
    final end = request['return_date']?.toString();
    if (start == null || start.isEmpty) return '-';
    if (end == null || end.isEmpty) return AppDateFormatter.short(start);
    return AppDateFormatter.range(start, end);
  }

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios_new, size: 18, color: c.onSurface),
          onPressed: () => context.safePopOrGoHome(),
        ),
        title: Text(
          'Travel Request',
          style: textTheme.titleMedium?.copyWith(
            color: c.onSurface,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh, color: c.onSurface.withValues(alpha: 0.7)),
            onPressed: _loading ? null : _load,
          ),
        ],
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
                          style: TextStyle(color: c.error),
                        ),
                        const SizedBox(height: 12),
                        TextButton(onPressed: _load, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : _buildContent(context, c, textTheme, _request ?? const {}),
    );
  }

  Widget _buildContent(
    BuildContext context,
    ColorScheme c,
    TextTheme textTheme,
    Map<String, dynamic> request,
  ) {
    final status = request['status']?.toString();
    final statusColor = _statusColor(status, c);
    final itineraries = (request['itineraries'] as List<dynamic>? ?? [])
        .map((e) => e is Map ? Map<String, dynamic>.from(e) : <String, dynamic>{})
        .toList();
    final destinationParts = [
      request['destination_city']?.toString(),
      request['destination_country']?.toString(),
    ].where((e) => e != null && e.isNotEmpty).join(', ');

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.all(kStitchSpace16),
        children: [
          Container(
            padding: const EdgeInsets.all(kStitchSpace16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [statusColor.withValues(alpha: 0.1), c.surface],
              ),
              borderRadius: BorderRadius.circular(kStitchCardRoundness),
              border: Border.all(color: statusColor.withValues(alpha: 0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        _statusLabel(status),
                        style: TextStyle(
                          color: statusColor,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const Spacer(),
                    Flexible(
                      child: Text(
                        'REF: ${request['reference_number'] ?? '-'}',
                        textAlign: TextAlign.end,
                        style: TextStyle(
                          color: c.onSurface.withValues(alpha: 0.6),
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  request['purpose']?.toString() ?? 'Travel Request',
                  style: textTheme.titleMedium?.copyWith(
                    color: c.onSurface,
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  [
                    if (request['created_at'] != null)
                      'Submitted ${AppDateFormatter.short(request['created_at'].toString())}',
                    if (request['requester'] is Map)
                      'By ${request['requester']['name'] ?? 'Requester'}',
                  ].join(' · '),
                  style: TextStyle(
                    color: c.onSurface.withValues(alpha: 0.6),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _card(c, [
            _secHeader(
              c,
              textTheme,
              'Mission Details',
              Icons.flight_takeoff_outlined,
              c.primary,
            ),
            _row(c, textTheme, 'Destination', destinationParts.isEmpty ? '-' : destinationParts),
            _row(c, textTheme, 'Travel Dates', _dateRange(request)),
            _row(
              c,
              textTheme,
              'Workplan Event',
              request['workplan_event'] is Map
                  ? (request['workplan_event']['title']?.toString() ?? '-')
                  : '-',
            ),
            _row(
              c,
              textTheme,
              'Justification',
              request['justification']?.toString() ?? '-',
            ),
            const SizedBox(height: 4),
          ]),
          const SizedBox(height: 12),
          _card(c, [
            _secHeader(
              c,
              textTheme,
              'Budget & Costs',
              Icons.account_balance_wallet_outlined,
              c.secondary,
            ),
            _row(
              c,
              textTheme,
              'Currency',
              request['currency']?.toString() ?? 'NAD',
            ),
            _row(
              c,
              textTheme,
              'Estimated DSA',
              _money(
                request['estimated_dsa'] ?? request['dsa_amount'],
                request['currency']?.toString() ?? 'NAD',
              ),
            ),
            const SizedBox(height: 8),
          ]),
          if (itineraries.isNotEmpty) ...[
            const SizedBox(height: 12),
            _card(c, [
              _secHeader(c, textTheme, 'Itinerary', Icons.map_outlined, c.primary),
              ...itineraries.map(
                (itinerary) => _itRow(
                  c,
                  textTheme,
                  itinerary['travel_date']?.toString() == null
                      ? '-'
                      : AppDateFormatter.short(itinerary['travel_date'].toString()),
                  [
                    itinerary['from_location']?.toString(),
                    'to',
                    itinerary['to_location']?.toString(),
                    if (itinerary['transport_mode'] != null)
                      '(${itinerary['transport_mode']})',
                  ].where((part) => part != null && part.isNotEmpty).join(' '),
                ),
              ),
              const SizedBox(height: 8),
            ]),
          ],
          const SizedBox(height: 20),
          SizedBox(
            height: 48,
            child: OutlinedButton.icon(
              onPressed: _withdrawing ? null : _withdraw,
              style: OutlinedButton.styleFrom(
                foregroundColor: c.error,
                side: BorderSide(color: c.error),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(kStitchCardRoundness),
                ),
              ),
              icon: _withdrawing
                  ? SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: c.error,
                      ),
                    )
                  : const Icon(Icons.cancel_outlined, size: 16),
              label: Text(
                _withdrawing ? 'Withdrawing...' : 'Withdraw Request',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _card(ColorScheme c, List<Widget> children) => Container(
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(kStitchCardRoundness),
          border: Border.all(color: c.outline),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: children,
        ),
      );

  Widget _secHeader(
    ColorScheme c,
    TextTheme textTheme,
    String title,
    IconData icon,
    Color color,
  ) =>
      Padding(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(kStitchRoundness),
              ),
              child: Icon(icon, color: color, size: 14),
            ),
            const SizedBox(width: 8),
            Text(
              title,
              style: textTheme.bodyMedium?.copyWith(
                color: c.onSurface,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      );

  Widget _row(ColorScheme c, TextTheme textTheme, String label, String value) =>
      Padding(
        padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 130,
              child: Text(
                label,
                style: TextStyle(
                  color: c.onSurface.withValues(alpha: 0.6),
                  fontSize: 12,
                ),
              ),
            ),
            Expanded(
              child: Text(
                value,
                style: textTheme.bodySmall?.copyWith(
                  color: c.onSurface,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      );

  Widget _itRow(ColorScheme c, TextTheme textTheme, String date, String desc) =>
      Padding(
        padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 90,
              child: Text(
                date,
                style: TextStyle(
                  color: c.primary,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            Expanded(
              child: Text(
                desc,
                style: TextStyle(
                  color: c.onSurface.withValues(alpha: 0.7),
                  fontSize: 12,
                ),
              ),
            ),
          ],
        ),
      );
}
