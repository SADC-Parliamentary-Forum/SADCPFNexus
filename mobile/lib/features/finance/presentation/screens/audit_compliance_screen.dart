import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  DATA
// ─────────────────────────────────────────────────────────────────────────────
class _Override {
  final String title;
  final String tag;
  final String tagColor; // 'red' | 'orange' | 'green'
  final String time;

  const _Override({
    required this.title,
    required this.tag,
    required this.tagColor,
    required this.time,
  });
}

class _DeptBar {
  final String dept;
  final double value; // 0-1 fraction
  final Color color;
  const _DeptBar(
      {required this.dept, required this.value, required this.color});
}

// ─────────────────────────────────────────────────────────────────────────────
//  SCREEN
// ─────────────────────────────────────────────────────────────────────────────
class AuditComplianceScreen extends StatelessWidget {
  const AuditComplianceScreen({super.key});

  static const List<_Override> _overrides = [
    _Override(
        title: 'Budget Cap Override',
        tag: 'REG-SEC',
        tagColor: 'orange',
        time: '10:42 AM'),
    _Override(
        title: 'Access Grant: Vendor',
        tag: 'MED-SEC',
        tagColor: 'orange',
        time: '09:15 AM'),
    _Override(
        title: 'Policy Exception #44',
        tag: 'LOWER',
        tagColor: 'green',
        time: 'Yesterday'),
  ];

  static const List<_DeptBar> _slaBreaches = [
    _DeptBar(dept: 'FIN', value: 0.78, color: Color(0xFFEF4444)),
    _DeptBar(dept: 'HR', value: 0.52, color: Color(0xFFF59E0B)),
    _DeptBar(dept: 'LOG', value: 0.65, color: Color(0xFFEF4444)),
    _DeptBar(dept: 'OPS', value: 0.33, color: Color(0xFF10B981)),
    _DeptBar(dept: 'IT', value: 0.44, color: Color(0xFFF59E0B)),
  ];

  Color _tagColor(String t) {
    switch (t) {
      case 'red':
        return AppColors.danger;
      case 'orange':
        return AppColors.warning;
      default:
        return AppColors.success;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: AppColors.textPrimary, size: 18),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Column(
          children: [
            Text(
              'Audit Dashboard',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
            Text(
              'SADC PF NEXUS · GOVERNANCE',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 9,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.0,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_none_rounded,
                color: AppColors.textSecondary),
            onPressed: () {},
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {},
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.bgDark,
        elevation: 0,
        child: const Icon(Icons.add_rounded, size: 28),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
        children: [
          // ── Hash Ledger Status ────────────────────────────────────────
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.bgSurface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                const Icon(Icons.verified_user_rounded,
                    color: AppColors.success, size: 18),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text(
                    'Hash Ledger Status: Verified',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                        color: AppColors.success.withValues(alpha: 0.4)),
                  ),
                  child: const Text(
                    'SECURE',
                    style: TextStyle(
                      color: AppColors.success,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.8,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── Integrity Score ───────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.bgSurface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: const Column(
              children: [
                Text(
                  '100%',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 52,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -2,
                  ),
                ),
                Text(
                  'Integrity Score',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                SizedBox(height: 8),
                Text(
                  'Last block validation 2 mins ago · Node ID: REXBD-A',
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 10,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // ── Metric Cards Row ──────────────────────────────────────────
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.bgSurface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Text(
                        'COMPLETENESS',
                        style: TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                        ),
                      ),
                      SizedBox(height: 14),
                      SizedBox(
                        width: 76,
                        height: 76,
                        child: CustomPaint(
                          painter: _RingPainter(
                            value: 0.88,
                            color: AppColors.primary,
                            bg: AppColors.border,
                          ),
                          child: Center(
                            child: Text(
                              '88%',
                              style: TextStyle(
                                color: AppColors.textPrimary,
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                      ),
                      SizedBox(height: 10),
                      Text(
                        'Data Entry Rate',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 10,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.bgSurface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'RISK LEVEL',
                        style: TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                        ),
                      ),
                      const SizedBox(height: 14),
                      _MiniBarChart(),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color:
                              AppColors.success.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Text(
                          'Low · Within Limits',
                          style: TextStyle(
                            color: AppColors.success,
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // ── SLA Breaches Chart ────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.bgSurface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Approval SLA Breaches By Department',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const Text(
                  'Last 30 Days',
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 11,
                  ),
                ),
                const SizedBox(height: 16),
                ..._slaBreaches.map((b) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 30,
                            child: Text(
                              b.dept,
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: b.value,
                                minHeight: 12,
                                backgroundColor: AppColors.border,
                                valueColor:
                                    AlwaysStoppedAnimation<Color>(b.color),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          SizedBox(
                            width: 32,
                            child: Text(
                              '${(b.value * 100).toInt()}%',
                              style: TextStyle(
                                color: b.color,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                              textAlign: TextAlign.right,
                            ),
                          ),
                        ],
                      ),
                    )),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── Recent Overrides ──────────────────────────────────────────
          const Text(
            'Recent Overrides',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          ..._overrides.map((o) => _OverrideRow(
                overrideItem: o,
                tagColor: _tagColor(o.tagColor),
              )),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SUB-WIDGETS
// ─────────────────────────────────────────────────────────────────────────────
class _RingPainter extends CustomPainter {
  final double value;
  final Color color;
  final Color bg;
  const _RingPainter(
      {required this.value, required this.color, required this.bg});

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final r = math.min(cx, cy) - 6;
    const sw = 9.0;
    final rect = Rect.fromCircle(center: Offset(cx, cy), radius: r);

    canvas.drawArc(
        rect,
        -math.pi / 2,
        2 * math.pi,
        false,
        Paint()
          ..color = bg
          ..style = PaintingStyle.stroke
          ..strokeWidth = sw);

    canvas.drawArc(
        rect,
        -math.pi / 2,
        2 * math.pi * value,
        false,
        Paint()
          ..color = color
          ..style = PaintingStyle.stroke
          ..strokeWidth = sw
          ..strokeCap = StrokeCap.round);
  }

  @override
  bool shouldRepaint(_RingPainter old) => false;
}

class _MiniBarChart extends StatelessWidget {
  final List<double> _vals = const [0.3, 0.55, 0.2, 0.45, 0.25];

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 50,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: _vals.map((v) {
          final isHigh = v == _vals.reduce(math.max);
          return Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: FractionallySizedBox(
                  heightFactor: v,
                  alignment: Alignment.bottomCenter,
                  child: Container(
                    color:
                        isHigh ? AppColors.warning : AppColors.success,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _OverrideRow extends StatelessWidget {
  final _Override overrideItem;
  final Color tagColor;
  const _OverrideRow({required this.overrideItem, required this.tagColor});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: tagColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(Icons.shield_outlined, color: tagColor, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  overrideItem.title,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  overrideItem.time,
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: tagColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
              border:
                  Border.all(color: tagColor.withValues(alpha: 0.35)),
            ),
            child: Text(
              overrideItem.tag,
              style: TextStyle(
                color: tagColor,
                fontSize: 9,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
