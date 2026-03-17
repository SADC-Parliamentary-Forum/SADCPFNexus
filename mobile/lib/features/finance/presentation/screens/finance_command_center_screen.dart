import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  DATA MODELS
// ─────────────────────────────────────────────────────────────────────────────
class _AgingBucket {
  final String label;
  final double amount;
  final Color barColor;
  final double fraction;
  const _AgingBucket({
    required this.label,
    required this.amount,
    required this.barColor,
    required this.fraction,
  });
}

class _BudgetAlert {
  final String name;
  final double pct;
  final Color barColor;
  const _BudgetAlert({
    required this.name,
    required this.pct,
    required this.barColor,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  SCREEN
// ─────────────────────────────────────────────────────────────────────────────
class FinanceCommandCenterScreen extends StatelessWidget {
  const FinanceCommandCenterScreen({super.key});

  static const List<_AgingBucket> _aging = [
    _AgingBucket(
        label: '< 30 Days',
        amount: 12400,
        barColor: Color(0xFF10B981),
        fraction: 0.27),
    _AgingBucket(
        label: '30-60 Days',
        amount: 8200,
        barColor: Color(0xFFF59E0B),
        fraction: 0.18),
    _AgingBucket(
        label: '60-90 Days',
        amount: 18500,
        barColor: Color(0xFFEF4444),
        fraction: 0.41),
    _AgingBucket(
        label: '> 90 Days',
        amount: 6150,
        barColor: Color(0xFF991B1B),
        fraction: 0.14),
  ];

  static const List<_BudgetAlert> _alerts = [
    _BudgetAlert(
        name: 'IT Infrastructure', pct: 0.92, barColor: Color(0xFFEF4444)),
    _BudgetAlert(
        name: 'Consultancy Fees', pct: 0.88, barColor: Color(0xFFF59E0B)),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text(
          'Finance Command',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.success.withValues(alpha: 0.4)),
            ),
            child: const Text(
              'Audit Ready',
              style: TextStyle(
                color: AppColors.success,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          // ── Row 1: Cycle Time + Advance Cap ──────────────────────────
          Row(
            children: [
              Expanded(child: _CycleTimeCard()),
              const SizedBox(width: 12),
              Expanded(child: _AdvanceCapCard()),
            ],
          ),
          const SizedBox(height: 20),

          // ── Imprest Aging ─────────────────────────────────────────────
          const _SectionHeader(title: 'Imprest Aging'),
          const SizedBox(height: 12),
          _buildAgingCard(),
          const SizedBox(height: 20),

          // ── Travel Cost Analysis ──────────────────────────────────────
          const _SectionHeader(title: 'Travel Cost Analysis'),
          const SizedBox(height: 12),
          _TravelCostChart(),
          const SizedBox(height: 20),

          // ── Budget Variance Alerts ────────────────────────────────────
          const _SectionHeader(title: 'Budget Variance Alerts'),
          const SizedBox(height: 12),
          _buildAlertsCard(),
        ],
      ),
    );
  }

  Widget _buildAgingCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '\$45,200',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 32,
              fontWeight: FontWeight.w800,
              letterSpacing: -1,
            ),
          ),
          const Text(
            'OUTSTANDING',
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 18),
          ..._aging.map((b) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _AgingRow(bucket: b),
              )),
        ],
      ),
    );
  }

  Widget _buildAlertsCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: _alerts
            .map((a) => Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: _AlertRow(alert: a),
                ))
            .toList(),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SUB-WIDGETS
// ─────────────────────────────────────────────────────────────────────────────
class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: const TextStyle(
        color: AppColors.textPrimary,
        fontSize: 15,
        fontWeight: FontWeight.w700,
      ),
    );
  }
}

class _CycleTimeCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.speed_rounded,
                color: AppColors.primary, size: 20),
          ),
          const SizedBox(height: 14),
          const Text(
            '4.2',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 34,
              fontWeight: FontWeight.w800,
              letterSpacing: -1,
            ),
          ),
          const Text(
            'Days',
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'CYCLE TIME',
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.5,
            ),
          ),
        ],
      ),
    );
  }
}

class _AdvanceCapCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'ADVANCE CAP',
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.5,
            ),
          ),
          SizedBox(height: 16),
          Center(
            child: SizedBox(
              width: 90,
              height: 90,
              child: CustomPaint(
                painter: _DonutPainter(
                  value: 0.42,
                  foregroundColor: Color(0xFFF59E0B),
                  backgroundColor: AppColors.border,
                ),
                child: Center(
                  child: Text(
                    '42%',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
            ),
          ),
          SizedBox(height: 10),
          Center(
            child: Text(
              'of cap utilized',
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 11,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DonutPainter extends CustomPainter {
  final double value;
  final Color foregroundColor;
  final Color backgroundColor;

  const _DonutPainter({
    required this.value,
    required this.foregroundColor,
    required this.backgroundColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final radius = math.min(cx, cy) - 8;
    const strokeW = 10.0;

    final bgPaint = Paint()
      ..color = backgroundColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeW
      ..strokeCap = StrokeCap.round;

    final fgPaint = Paint()
      ..color = foregroundColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeW
      ..strokeCap = StrokeCap.round;

    final rect = Rect.fromCircle(center: Offset(cx, cy), radius: radius);
    canvas.drawArc(rect, -math.pi / 2, 2 * math.pi, false, bgPaint);
    canvas.drawArc(rect, -math.pi / 2, 2 * math.pi * value, false, fgPaint);
  }

  @override
  bool shouldRepaint(_DonutPainter old) =>
      old.value != value ||
      old.foregroundColor != foregroundColor ||
      old.backgroundColor != backgroundColor;
}

class _AgingRow extends StatelessWidget {
  final _AgingBucket bucket;
  const _AgingRow({required this.bucket});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              bucket.label,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
            Text(
              '\$${bucket.amount.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}',
              style: TextStyle(
                color: bucket.barColor,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        const SizedBox(height: 5),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: bucket.fraction,
            minHeight: 6,
            backgroundColor: AppColors.border,
            valueColor: AlwaysStoppedAnimation<Color>(bucket.barColor),
          ),
        ),
      ],
    );
  }
}

class _TravelCostChart extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    // Weekly data points (Q1 vs Q2) — 6 weeks
    final q1 = [28.0, 35.0, 22.0, 42.0, 30.0, 18.0];
    final q2 = [18.0, 25.0, 15.0, 32.0, 20.0, 12.0];

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Weekly Trend',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                  Text(
                    'Peak \$42k',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                      color: AppColors.success.withValues(alpha: 0.35)),
                ),
                child: const Text(
                  'Variance -\$21k (Savings)',
                  style: TextStyle(
                    color: AppColors.success,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 100,
            child: CustomPaint(
              size: const Size(double.infinity, 100),
              painter: _LineChartPainter(q1: q1, q2: q2),
            ),
          ),
          const SizedBox(height: 12),
          const Row(
            children: [
              _LegendDot(color: AppColors.primary, label: 'Q1'),
              SizedBox(width: 16),
              _LegendDot(color: AppColors.warning, label: 'Q2'),
            ],
          ),
        ],
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(label,
            style: const TextStyle(
                color: AppColors.textSecondary, fontSize: 11)),
      ],
    );
  }
}

class _LineChartPainter extends CustomPainter {
  final List<double> q1;
  final List<double> q2;
  const _LineChartPainter({required this.q1, required this.q2});

  @override
  void paint(Canvas canvas, Size size) {
    final maxVal = [...q1, ...q2].reduce(math.max);
    final w = size.width;
    final h = size.height;
    final stepX = w / (q1.length - 1);

    Path buildPath(List<double> data) {
      final path = Path();
      for (int i = 0; i < data.length; i++) {
        final x = i * stepX;
        final y = h - (data[i] / maxVal) * h;
        if (i == 0) {
          path.moveTo(x, y);
        } else {
          final prevX = (i - 1) * stepX;
          final prevY = h - (data[i - 1] / maxVal) * h;
          final cpX = (prevX + x) / 2;
          path.cubicTo(cpX, prevY, cpX, y, x, y);
        }
      }
      return path;
    }

    final q1Paint = Paint()
      ..color = AppColors.primary
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final q2Paint = Paint()
      ..color = AppColors.warning
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    // Draw grid lines
    final gridPaint = Paint()
      ..color = AppColors.border
      ..strokeWidth = 1;
    for (int i = 0; i < 4; i++) {
      final y = h * i / 3;
      canvas.drawLine(Offset(0, y), Offset(w, y), gridPaint);
    }

    canvas.drawPath(buildPath(q1), q1Paint);
    canvas.drawPath(buildPath(q2), q2Paint);

    // Draw dots
    for (int i = 0; i < q1.length; i++) {
      final x = i * stepX;
      final dotPaint = Paint()..color = AppColors.primary;
      canvas.drawCircle(
          Offset(x, h - (q1[i] / maxVal) * h), 3.5, dotPaint);
      dotPaint.color = AppColors.warning;
      canvas.drawCircle(
          Offset(x, h - (q2[i] / maxVal) * h), 3.5, dotPaint);
    }
  }

  @override
  bool shouldRepaint(_LineChartPainter old) => false;
}

class _AlertRow extends StatelessWidget {
  final _BudgetAlert alert;
  const _AlertRow({required this.alert});

  @override
  Widget build(BuildContext context) {
    final pctText = '${(alert.pct * 100).toInt()}%';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              alert.name,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              pctText,
              style: TextStyle(
                color: alert.barColor,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: alert.pct,
            minHeight: 7,
            backgroundColor: AppColors.border,
            valueColor: AlwaysStoppedAnimation<Color>(alert.barColor),
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Budget utilization exceeds threshold',
          style: TextStyle(
            color: AppColors.textMuted,
            fontSize: 10,
          ),
        ),
      ],
    );
  }
}
