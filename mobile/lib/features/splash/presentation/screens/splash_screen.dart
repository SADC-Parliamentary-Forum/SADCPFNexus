import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

/// Splash screen: branding, loading progress, then navigate to login.
/// Uses app theme (light/dark) and Stitch design tokens.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  static const Duration _kDuration = Duration(milliseconds: 2400);

  late final AnimationController _ctrl;
  late final Animation<double> _progress;
  late final Animation<double> _fade;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: _kDuration);
    _progress = CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut);
    _fade = CurvedAnimation(
      parent: _ctrl,
      curve: const Interval(0.0, 0.3, curve: Curves.easeIn),
    );
    _ctrl.forward();
    _ctrl.addStatusListener((status) {
      if (status == AnimationStatus.completed && mounted) {
        context.go('/login');
      }
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final c = theme.colorScheme;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: SafeArea(
        child: FadeTransition(
          opacity: _fade,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 40),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Spacer(flex: 2),
                // Logo
                Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: c.surface,
                    border: Border.all(
                      color: c.primary.withValues(alpha: 0.4),
                      width: 2,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: c.primary.withValues(alpha: 0.25),
                        blurRadius: 32,
                        spreadRadius: 8,
                      ),
                    ],
                  ),
                  child: Icon(
                    Icons.account_balance_rounded,
                    size: 48,
                    color: c.primary,
                  ),
                ),
                const SizedBox(height: 28),
                Text(
                  'SADCPFNexus',
                  style: GoogleFonts.publicSans(
                    color: c.onSurface,
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Unified Institutional Architecture',
                  style: GoogleFonts.publicSans(
                    color: c.onSurface.withValues(alpha: 0.7),
                    fontSize: 13,
                    fontWeight: FontWeight.w400,
                  ),
                ),
                const Spacer(flex: 2),
                // Loading bar
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'LOADING RESOURCES',
                          style: GoogleFonts.publicSans(
                            color: c.primary,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.2,
                          ),
                        ),
                        AnimatedBuilder(
                          animation: _progress,
                          builder: (_, __) => Text(
                            '${(_progress.value * 100).round()}%',
                            style: GoogleFonts.publicSans(
                              color: c.onSurface.withValues(alpha: 0.7),
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: AnimatedBuilder(
                        animation: _progress,
                        builder: (_, __) => LinearProgressIndicator(
                          value: _progress.value,
                          minHeight: 4,
                          backgroundColor: c.outline.withValues(alpha: 0.3),
                          valueColor: AlwaysStoppedAnimation<Color>(c.primary),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.lock_outline,
                      size: 12,
                      color: c.onSurface.withValues(alpha: 0.5),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'SECURED BY SADC PF',
                      style: GoogleFonts.publicSans(
                        color: c.onSurface.withValues(alpha: 0.5),
                        fontSize: 9,
                        letterSpacing: 1.0,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  'v2.8.4 Build 832',
                  style: GoogleFonts.publicSans(
                    color: c.onSurface.withValues(alpha: 0.4),
                    fontSize: 9,
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
