import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class BiometricEntryScreen extends StatefulWidget {
  const BiometricEntryScreen({super.key});

  @override
  State<BiometricEntryScreen> createState() => _BiometricEntryScreenState();
}

class _BiometricEntryScreenState extends State<BiometricEntryScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _glowController;
  late Animation<double> _glowAnimation;

  @override
  void initState() {
    super.initState();
    _glowController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _glowAnimation = Tween<double>(begin: 0.4, end: 1.0).animate(
      CurvedAnimation(parent: _glowController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _glowController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new,
              size: 18, color: AppColors.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'Secure Entry',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Hero image card
            Container(
              height: 200,
              width: double.infinity,
              margin: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0xFF0A1D13),
                    Color(0xFF0D2B1C),
                    Color(0xFF051009),
                  ],
                ),
                border: Border.all(color: AppColors.border),
              ),
              child: Stack(
                children: [
                  // Building silhouette decoration
                  Positioned(
                    bottom: 0,
                    left: 0,
                    right: 0,
                    child: CustomPaint(
                      size: const Size(double.infinity, 120),
                      painter: _BuildingSilhouettePainter(),
                    ),
                  ),
                  // Grid lines overlay
                  Positioned.fill(
                    child: CustomPaint(
                      painter: _GridOverlayPainter(),
                    ),
                  ),
                  // Centered green dot pulsing
                  Center(
                    child: AnimatedBuilder(
                      animation: _glowAnimation,
                      builder: (context, child) {
                        return Container(
                          width: 14,
                          height: 14,
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.primary
                                    .withValues(alpha: _glowAnimation.value),
                                blurRadius: 20,
                                spreadRadius: 4,
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                  // Institution label
                  Positioned(
                    top: 16,
                    left: 16,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: AppColors.bgDark.withValues(alpha: 0.7),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                            color: AppColors.primary.withValues(alpha: 0.3)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.shield_rounded,
                              color: AppColors.primary, size: 12),
                          SizedBox(width: 5),
                          Text(
                            'SADC PF HEADQUARTERS',
                            style: TextStyle(
                              color: AppColors.primary,
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.8,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  // Status indicator
                  Positioned(
                    bottom: 12,
                    right: 14,
                    child: Row(
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: const BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 5),
                        const Text(
                          'Secure Perimeter Active',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
              child: Column(
                children: [
                  // Welcome text
                  const Text(
                    'Welcome Back',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Please verify your identity to access the SADC Executive Dashboard.',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 14,
                      height: 1.5,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 28),

                  // Biometric card
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: AppColors.bgSurface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      children: [
                        // Fingerprint icon
                        AnimatedBuilder(
                          animation: _glowAnimation,
                          builder: (context, child) {
                            return Container(
                              width: 88,
                              height: 88,
                              decoration: BoxDecoration(
                                color: AppColors.primary.withValues(alpha: 0.1),
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: AppColors.primary.withValues(
                                        alpha:
                                            _glowAnimation.value * 0.25),
                                    blurRadius: 20,
                                    spreadRadius: 2,
                                  ),
                                ],
                              ),
                              child: const Icon(
                                Icons.fingerprint_rounded,
                                color: AppColors.primary,
                                size: 50,
                              ),
                            );
                          },
                        ),
                        const SizedBox(height: 16),
                        const Text(
                          'FaceID or Fingerprint',
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Tap to authenticate',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Unlock Now button
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton.icon(
                      onPressed: () {},
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: AppColors.bgDark,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        elevation: 0,
                      ),
                      icon: const Icon(Icons.lock_open_rounded, size: 20),
                      label: const Text(
                        'Unlock Now',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Backup PIN link
                  GestureDetector(
                    onTap: () {},
                    child: const Text(
                      'Use Backup PIN',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // SOS
                  GestureDetector(
                    onTap: () {},
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.emergency_rounded,
                            color: AppColors.danger, size: 14),
                        SizedBox(width: 5),
                        Text(
                          'SOS Emergency SOS',
                          style: TextStyle(
                            color: AppColors.danger,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Footer
                  const Text(
                    'SADCPFNexus v2.4.1 · Secure Governance Suite',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11,
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BuildingSilhouettePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF0D2018)
      ..style = PaintingStyle.fill;

    final path = Path();
    path.moveTo(0, size.height);
    path.lineTo(0, size.height * 0.5);
    path.lineTo(size.width * 0.1, size.height * 0.5);
    path.lineTo(size.width * 0.1, size.height * 0.3);
    path.lineTo(size.width * 0.15, size.height * 0.3);
    path.lineTo(size.width * 0.15, size.height * 0.1);
    path.lineTo(size.width * 0.2, size.height * 0.1);
    path.lineTo(size.width * 0.2, size.height * 0.3);
    path.lineTo(size.width * 0.3, size.height * 0.3);
    path.lineTo(size.width * 0.3, size.height * 0.5);
    path.lineTo(size.width * 0.4, size.height * 0.5);
    path.lineTo(size.width * 0.4, size.height * 0.2);
    path.lineTo(size.width * 0.5, size.height * 0.05);
    path.lineTo(size.width * 0.6, size.height * 0.2);
    path.lineTo(size.width * 0.6, size.height * 0.5);
    path.lineTo(size.width * 0.7, size.height * 0.5);
    path.lineTo(size.width * 0.7, size.height * 0.35);
    path.lineTo(size.width * 0.8, size.height * 0.35);
    path.lineTo(size.width * 0.8, size.height * 0.5);
    path.lineTo(size.width * 0.9, size.height * 0.5);
    path.lineTo(size.width * 0.9, size.height * 0.4);
    path.lineTo(size.width, size.height * 0.4);
    path.lineTo(size.width, size.height);
    path.close();

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _GridOverlayPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.primary.withValues(alpha: 0.05)
      ..strokeWidth = 0.5;

    const spacing = 24.0;
    for (double x = 0; x < size.width; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
