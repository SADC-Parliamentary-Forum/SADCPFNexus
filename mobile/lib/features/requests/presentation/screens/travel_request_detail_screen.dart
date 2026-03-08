import 'package:flutter/material.dart';
import '../../../../core/router/safe_back.dart';
import '../../../../core/theme/app_theme.dart';

class TravelRequestDetailScreen extends StatelessWidget {
  const TravelRequestDetailScreen({super.key});

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
            icon: Icon(Icons.share_outlined, color: c.onSurface.withValues(alpha: 0.7)),
            onPressed: () {},
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(kStitchSpace16),
        children: [
          Container(
            padding: const EdgeInsets.all(kStitchSpace16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  c.secondary.withValues(alpha: 0.1),
                  c.surface,
                ],
              ),
              borderRadius: BorderRadius.circular(kStitchCardRoundness),
              border: Border.all(color: c.secondary.withValues(alpha: 0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: c.secondary.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.access_time, color: c.secondary, size: 12),
                          const SizedBox(width: 4),
                          Text(
                            'Pending Approval',
                            style: TextStyle(
                              color: c.secondary,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                    Text(
                      'REF: SADC-TR-2026-0041',
                      style: TextStyle(
                        color: c.onSurface.withValues(alpha: 0.6),
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  'Mission to Lusaka — SADC Finance Workshop',
                  style: textTheme.titleMedium?.copyWith(
                    color: c.onSurface,
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Submitted 04 Mar 2026  ·  Step 2 of 3 approvals',
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
            _secHeader(c, textTheme, 'Mission Details', Icons.flight_takeoff_outlined, c.primary),
            _row(c, textTheme, 'Destination', 'Lusaka, Zambia'),
            _row(c, textTheme, 'Departure', '15 Mar 2026  →  18 Mar 2026'),
            _row(c, textTheme, 'Duration', '4 nights / 5 days'),
            _row(c, textTheme, 'Purpose', 'SADC Finance Ministers Workshop'),
            _row(c, textTheme, 'Mission Type', 'Regional Meeting'),
            const SizedBox(height: 4),
          ]),
          const SizedBox(height: 12),
          _card(c, [
            _secHeader(c, textTheme, 'Budget & Costs', Icons.account_balance_wallet_outlined, c.secondary),
            _row(c, textTheme, 'Budget Line', 'GL-2026-REGIONAL-TRAVEL'),
            _row(c, textTheme, 'Estimated DSA', 'N\$2,800.00 (4 nights × USD 140)'),
            _row(c, textTheme, 'Air Travel', 'N\$3,200.00'),
            _row(c, textTheme, 'Ground Transport', 'N\$450.00'),
            Divider(color: c.outline, height: 20, indent: 14, endIndent: 14),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
              child: Row(
                children: [
                  Text(
                    'Total Estimated Cost',
                    style: textTheme.bodyMedium?.copyWith(
                      color: c.onSurface,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    'N\$6,450.00',
                    style: textTheme.titleMedium?.copyWith(
                      color: c.primary,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ]),
          const SizedBox(height: 12),
          _card(c, [
            _secHeader(c, textTheme, 'Approval Chain', Icons.account_tree_outlined, c.primary),
            _approvalStep(c, textTheme, 'Supervisor', 'James Mwape', true, false),
            _approvalStep(c, textTheme, 'Finance Officer', 'Amelia Dos Santos', false, false),
            _approvalStep(c, textTheme, 'Secretary General', 'Dr. N. Ndlovhu', false, true),
          ]),
          const SizedBox(height: 12),
          _card(c, [
            _secHeader(c, textTheme, 'Itinerary', Icons.map_outlined, c.primary),
            _itRow(c, textTheme, 'Sun 15 Mar', 'Depart Windhoek (WDH) 08:00 → Arrive Lusaka (LUN) 14:30'),
            _itRow(c, textTheme, 'Mon–Wed', 'SADC Finance Ministers Workshop sessions'),
            _itRow(c, textTheme, 'Thu 18 Mar', 'Depart Lusaka (LUN) 16:00 → Arrive Windhoek (WDH) 21:15'),
            const SizedBox(height: 8),
          ]),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {},
                  style: OutlinedButton.styleFrom(
                    foregroundColor: c.error,
                    side: BorderSide(color: c.error),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(kStitchCardRoundness),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  icon: const Icon(Icons.cancel_outlined, size: 16),
                  label: const Text('Withdraw', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {},
                  style: ElevatedButton.styleFrom(
                    backgroundColor: c.primary,
                    foregroundColor: c.onPrimary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(kStitchCardRoundness),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  icon: const Icon(Icons.picture_as_pdf_outlined, size: 16),
                  label: const Text('Print Auth Letter', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
            ],
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

  Widget _secHeader(ColorScheme c, TextTheme textTheme, String title, IconData icon, Color color) => Padding(
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

  Widget _row(ColorScheme c, TextTheme textTheme, String label, String val) => Padding(
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
            val,
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

  Widget _approvalStep(ColorScheme c, TextTheme textTheme, String role, String name, bool done, bool isLast) => Padding(
    padding: const EdgeInsets.fromLTRB(14, 6, 14, 6),
    child: Row(
      children: [
        Column(
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: done ? c.primary.withValues(alpha: 0.1) : c.surface,
                shape: BoxShape.circle,
                border: Border.all(
                  color: done ? c.primary : c.outline,
                ),
              ),
              child: Icon(
                done ? Icons.check : Icons.hourglass_empty,
                color: done ? c.primary : c.onSurface.withValues(alpha: 0.6),
                size: 14,
              ),
            ),
            if (!isLast) Container(width: 1, height: 20, color: c.outline),
          ],
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                name,
                style: textTheme.bodyMedium?.copyWith(
                  color: c.onSurface,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                role,
                style: TextStyle(color: c.onSurface.withValues(alpha: 0.6), fontSize: 11),
              ),
            ],
          ),
        ),
        if (done) Text('Approved', style: TextStyle(color: c.primary, fontSize: 11, fontWeight: FontWeight.w600)),
        if (!done && !isLast) Text('Pending', style: TextStyle(color: c.secondary, fontSize: 11, fontWeight: FontWeight.w600)),
        if (isLast) Text('Awaiting', style: TextStyle(color: c.onSurface.withValues(alpha: 0.6), fontSize: 11)),
      ],
    ),
  );

  Widget _itRow(ColorScheme c, TextTheme textTheme, String date, String desc) => Padding(
    padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 80,
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
