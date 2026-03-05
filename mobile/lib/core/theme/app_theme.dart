import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class AppColors {
  // Primary green — Emerald 600, good contrast on white (4.5:1+)
  static const Color primary = Color(0xFF059669);
  static const Color primaryDark = Color(0xFF047857);
  static const Color primaryLight = Color(0xFF10B981);

  // Backgrounds (semantic names kept; values remapped to light)
  static const Color bgDark = Color(0xFFF4F8F6);      // Page / scaffold bg
  static const Color bgSurface = Color(0xFFFFFFFF);   // Card surface
  static const Color bgCard = Color(0xFFEDF5F1);      // Elevated / inner card

  // Text
  static const Color textPrimary = Color(0xFF0E2318);    // Near-black
  static const Color textSecondary = Color(0xFF3A5D4F);  // Dark gray-green
  static const Color textMuted = Color(0xFF7A9A88);      // Medium gray-green

  // Borders
  static const Color border = Color(0xFFC8E0D4);

  // Status — adjusted for light backgrounds
  static const Color success = Color(0xFF16A34A);   // Green 600
  static const Color warning = Color(0xFFD97706);   // Amber 600
  static const Color danger = Color(0xFFDC2626);    // Red 600
  static const Color info = Color(0xFF2563EB);      // Blue 600

  // Institutional gold — darker for contrast on light
  static const Color gold = Color(0xFFB45309);      // Amber 700

  AppColors._();
}

class AppTheme {
  static ThemeData get lightTheme => ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: AppColors.bgDark,
    primaryColor: AppColors.primary,
    colorScheme: const ColorScheme.light(
      primary: AppColors.primary,
      primaryContainer: Color(0xFFD1FAE5),
      secondary: AppColors.gold,
      surface: AppColors.bgSurface,
      error: AppColors.danger,
      onPrimary: Colors.white,
      onSurface: AppColors.textPrimary,
      onError: Colors.white,
      outline: AppColors.border,
    ),
    fontFamily: 'PublicSans',

    // AppBar
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.bgDark,
      foregroundColor: AppColors.textPrimary,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: true,
      iconTheme: IconThemeData(color: AppColors.textPrimary),
      systemOverlayStyle: SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,   // dark icons on light bg
        statusBarBrightness: Brightness.light,
      ),
    ),

    // Card
    cardTheme: CardTheme(
      color: AppColors.bgSurface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.border, width: 1),
      ),
    ),

    // Input
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.bgCard,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.primary, width: 2),
      ),
      labelStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
      hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 14),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    ),

    // Elevated button
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        minimumSize: const Size(double.infinity, 52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w700,
          fontFamily: 'PublicSans',
        ),
      ),
    ),

    // Text theme
    textTheme: const TextTheme(
      displayLarge:   TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w800),
      displayMedium:  TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700),
      displaySmall:   TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700),
      headlineLarge:  TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700),
      headlineMedium: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600),
      headlineSmall:  TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600),
      titleLarge:     TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 18),
      titleMedium:    TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 16),
      titleSmall:     TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w500, fontSize: 14),
      bodyLarge:      TextStyle(color: AppColors.textPrimary, fontSize: 16),
      bodyMedium:     TextStyle(color: AppColors.textPrimary, fontSize: 14),
      bodySmall:      TextStyle(color: AppColors.textSecondary, fontSize: 12),
      labelLarge:     TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14),
      labelMedium:    TextStyle(color: AppColors.textSecondary, fontSize: 12),
      labelSmall:     TextStyle(color: AppColors.textMuted, fontSize: 10),
    ),

    // Divider
    dividerTheme: const DividerThemeData(
      color: AppColors.border,
      thickness: 1,
    ),

    // Bottom nav
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
          return const TextStyle(
            color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.w600);
        }
        return const TextStyle(color: AppColors.textMuted, fontSize: 11);
      }),
    ),

    // PopupMenu
    popupMenuTheme: PopupMenuThemeData(
      color: AppColors.bgSurface,
      elevation: 4,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.border),
      ),
    ),
  );

  // Keep a reference so existing code can still call darkTheme if needed
  static ThemeData get darkTheme => lightTheme;

  AppTheme._();
}
