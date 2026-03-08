import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Stitch "Travel Requisition Form" project (projects/12240393499596954021)
// Design tokens: primary #13ec80, font PUBLIC_SANS, roundness ROUND_EIGHT.
// Default: light theme; dark theme switchable in Profile > Settings.
// ─────────────────────────────────────────────────────────────────────────────

/// Stitch-aligned palette. Light theme is default; dark theme uses same
/// primary with dark surfaces (see [AppTheme.darkTheme]).
class AppColors {
  // Primary — Stitch Travel Requisition Form customColor
  static const Color primary = Color(0xFF13EC80);
  static const Color primaryDark = Color(0xFF0FBD66);
  static const Color primaryLight = Color(0xFF5AFFA8);

  // Light backgrounds
  static const Color bgDark = Color(0xFFF4F8F6);
  static const Color bgSurface = Color(0xFFFFFFFF);
  static const Color bgCard = Color(0xFFEDF5F1);

  // Dark theme surfaces (use in dark ThemeData)
  static const Color bgDarkDark = Color(0xFF0E1412);
  static const Color bgSurfaceDark = Color(0xFF1A211D);
  static const Color bgCardDark = Color(0xFF242D28);

  // Text (light)
  static const Color textPrimary = Color(0xFF0E2318);
  static const Color textSecondary = Color(0xFF3A5D4F);
  static const Color textMuted = Color(0xFF7A9A88);

  // Text (dark)
  static const Color textPrimaryDark = Color(0xFFE8F0EC);
  static const Color textSecondaryDark = Color(0xFFB0C4BB);
  static const Color textMutedDark = Color(0xFF7A9A88);

  // Borders
  static const Color border = Color(0xFFC8E0D4);
  static const Color borderDark = Color(0xFF2D3B35);

  // Status
  static const Color success = Color(0xFF16A34A);
  static const Color warning = Color(0xFFD97706);
  static const Color danger = Color(0xFFDC2626);
  static const Color info = Color(0xFF2563EB);
  static const Color gold = Color(0xFFB45309);

  AppColors._();
}

/// ROUND_EIGHT from Stitch
const double _kStitchRoundness = 8.0;
const double _kCardRoundness = 12.0;

TextTheme _textTheme(Color primary, Color onSurface, Color secondary) {
  final base = GoogleFonts.publicSansTextTheme();
  return TextTheme(
    displayLarge: base.displayLarge!.copyWith(color: onSurface, fontWeight: FontWeight.w800),
    displayMedium: base.displayMedium!.copyWith(color: onSurface, fontWeight: FontWeight.w700),
    displaySmall: base.displaySmall!.copyWith(color: onSurface, fontWeight: FontWeight.w700),
    headlineLarge: base.headlineLarge!.copyWith(color: onSurface, fontWeight: FontWeight.w700),
    headlineMedium: base.headlineMedium!.copyWith(color: onSurface, fontWeight: FontWeight.w600),
    headlineSmall: base.headlineSmall!.copyWith(color: onSurface, fontWeight: FontWeight.w600),
    titleLarge: base.titleLarge!.copyWith(color: onSurface, fontWeight: FontWeight.w600, fontSize: 18),
    titleMedium: base.titleMedium!.copyWith(color: onSurface, fontWeight: FontWeight.w600, fontSize: 16),
    titleSmall: base.titleSmall!.copyWith(color: onSurface, fontWeight: FontWeight.w500, fontSize: 14),
    bodyLarge: base.bodyLarge!.copyWith(color: onSurface, fontSize: 16),
    bodyMedium: base.bodyMedium!.copyWith(color: onSurface, fontSize: 14),
    bodySmall: base.bodySmall!.copyWith(color: secondary, fontSize: 12),
    labelLarge: base.labelLarge!.copyWith(color: onSurface, fontWeight: FontWeight.w600, fontSize: 14),
    labelMedium: base.labelMedium!.copyWith(color: secondary, fontSize: 12),
    labelSmall: base.labelSmall!.copyWith(color: AppColors.textMuted, fontSize: 10),
  );
}

class AppTheme {
  static ThemeData get lightTheme {
    const c = AppColors.primary;
    const onP = Color(0xFF0E2318);
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: AppColors.bgDark,
      primaryColor: c,
      colorScheme: const ColorScheme.light(
        primary: AppColors.primary,
        primaryContainer: Color(0xFFB8FAD9),
        secondary: AppColors.gold,
        surface: AppColors.bgSurface,
        error: AppColors.danger,
        onPrimary: onP,
        onSurface: AppColors.textPrimary,
        onError: Colors.white,
        outline: AppColors.border,
      ),
      textTheme: _textTheme(c, AppColors.textPrimary, AppColors.textSecondary),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.bgDark,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        iconTheme: const IconThemeData(color: AppColors.textPrimary),
        titleTextStyle: GoogleFonts.publicSans(
          color: AppColors.textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w700,
        ),
        systemOverlayStyle: const SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.dark,
          statusBarBrightness: Brightness.light,
        ),
      ),
      cardTheme: CardTheme(
        color: AppColors.bgSurface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(_kCardRoundness),
          side: const BorderSide(color: AppColors.border, width: 1),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.bgCard,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_kStitchRoundness),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_kStitchRoundness),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_kStitchRoundness),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        labelStyle: GoogleFonts.publicSans(color: AppColors.textSecondary, fontSize: 12),
        hintStyle: GoogleFonts.publicSans(color: AppColors.textMuted, fontSize: 14),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: onP,
          elevation: 0,
          minimumSize: const Size(double.infinity, 52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(_kStitchRoundness),
          ),
          textStyle: GoogleFonts.publicSans(
            fontSize: 15,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.border,
        thickness: 1,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.bgSurface,
        indicatorColor: AppColors.primary.withValues(alpha: 0.12),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: AppColors.primary, size: 24);
          }
          return const IconThemeData(color: AppColors.textMuted, size: 24);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return GoogleFonts.publicSans(
              color: AppColors.primary,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            );
          }
          return GoogleFonts.publicSans(color: AppColors.textMuted, fontSize: 11);
        }),
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: AppColors.bgSurface,
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(_kStitchRoundness),
          side: const BorderSide(color: AppColors.border),
        ),
      ),
    );
  }

  static ThemeData get darkTheme {
    const c = AppColors.primary;
    const onP = Color(0xFF0E2318);
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppColors.bgDarkDark,
      primaryColor: c,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.primary,
        primaryContainer: Color(0xFF0A3D28),
        secondary: AppColors.gold,
        surface: AppColors.bgSurfaceDark,
        error: AppColors.danger,
        onPrimary: onP,
        onSurface: AppColors.textPrimaryDark,
        onError: Colors.white,
        outline: AppColors.borderDark,
      ),
      textTheme: _textTheme(
        c,
        AppColors.textPrimaryDark,
        AppColors.textSecondaryDark,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.bgDarkDark,
        foregroundColor: AppColors.textPrimaryDark,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        iconTheme: const IconThemeData(color: AppColors.textPrimaryDark),
        titleTextStyle: GoogleFonts.publicSans(
          color: AppColors.textPrimaryDark,
          fontSize: 18,
          fontWeight: FontWeight.w700,
        ),
        systemOverlayStyle: const SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.light,
          statusBarBrightness: Brightness.dark,
        ),
      ),
      cardTheme: CardTheme(
        color: AppColors.bgSurfaceDark,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(_kCardRoundness),
          side: const BorderSide(color: AppColors.borderDark, width: 1),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.bgCardDark,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_kStitchRoundness),
          borderSide: const BorderSide(color: AppColors.borderDark),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_kStitchRoundness),
          borderSide: const BorderSide(color: AppColors.borderDark),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(_kStitchRoundness),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        labelStyle: GoogleFonts.publicSans(
          color: AppColors.textSecondaryDark,
          fontSize: 12,
        ),
        hintStyle: GoogleFonts.publicSans(
          color: AppColors.textMutedDark,
          fontSize: 14,
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: onP,
          elevation: 0,
          minimumSize: const Size(double.infinity, 52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(_kStitchRoundness),
          ),
          textStyle: GoogleFonts.publicSans(
            fontSize: 15,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.borderDark,
        thickness: 1,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.bgSurfaceDark,
        indicatorColor: AppColors.primary.withValues(alpha: 0.2),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: AppColors.primary, size: 24);
          }
          return const IconThemeData(color: AppColors.textMutedDark, size: 24);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return GoogleFonts.publicSans(
              color: AppColors.primary,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            );
          }
          return GoogleFonts.publicSans(
            color: AppColors.textMutedDark,
            fontSize: 11,
          );
        }),
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: AppColors.bgSurfaceDark,
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(_kStitchRoundness),
          side: const BorderSide(color: AppColors.borderDark),
        ),
      ),
    );
  }

  AppTheme._();
}
