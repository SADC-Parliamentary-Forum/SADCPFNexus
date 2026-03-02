import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class AppColors {
  // Primary green — matches mobile design #13ec80
  static const Color primary = Color(0xFF13EC80);
  static const Color primaryDark = Color(0xFF0DC46A);
  static const Color primaryLight = Color(0xFF3EFFA0);

  // Background
  static const Color bgDark = Color(0xFF102219);      // Dark bg
  static const Color bgSurface = Color(0xFF1A2C24);   // Card surface
  static const Color bgCard = Color(0xFF1A3326);      // Elevated card

  // Text
  static const Color textPrimary = Color(0xFFE2E8E5);
  static const Color textSecondary = Color(0xFF8FAEA0);
  static const Color textMuted = Color(0xFF618975);

  // Borders
  static const Color border = Color(0xFF1E3028);

  // Status colors
  static const Color success = Color(0xFF10B981);
  static const Color warning = Color(0xFFF59E0B);
  static const Color danger = Color(0xFFEF4444);
  static const Color info = Color(0xFF3B82F6);

  // Gold accent (institutional)
  static const Color gold = Color(0xFFD4AF37);

  AppColors._();
}

class AppTheme {
  static ThemeData get darkTheme => ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: AppColors.bgDark,
    primaryColor: AppColors.primary,
    colorScheme: const ColorScheme.dark(
      primary: AppColors.primary,
      primaryContainer: Color(0xFF0DC46A),
      secondary: AppColors.gold,
      surface: AppColors.bgSurface,
      error: AppColors.danger,
      onPrimary: Color(0xFF102219),
      onSurface: AppColors.textPrimary,
      outline: AppColors.border,
    ),
    fontFamily: 'PublicSans',

    // AppBar theme
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.bgDark,
      foregroundColor: AppColors.textPrimary,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: true,
      iconTheme: IconThemeData(color: AppColors.textPrimary),
      systemOverlayStyle: SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
      ),
    ),

    // Card theme
    cardTheme: CardTheme(
      color: AppColors.bgSurface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.border, width: 1),
      ),
    ),

    // Input decoration
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
        foregroundColor: const Color(0xFF102219),
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
      displayLarge:  TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w800),
      displayMedium: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700),
      displaySmall:  TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700),
      headlineLarge: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700),
      headlineMedium:TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600),
      headlineSmall: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600),
      titleLarge:    TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 18),
      titleMedium:   TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 16),
      titleSmall:    TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w500, fontSize: 14),
      bodyLarge:     TextStyle(color: AppColors.textPrimary, fontSize: 16),
      bodyMedium:    TextStyle(color: AppColors.textPrimary, fontSize: 14),
      bodySmall:     TextStyle(color: AppColors.textSecondary, fontSize: 12),
      labelLarge:    TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14),
      labelMedium:   TextStyle(color: AppColors.textSecondary, fontSize: 12),
      labelSmall:    TextStyle(color: AppColors.textMuted, fontSize: 10),
    ),

    // Divider
    dividerTheme: const DividerThemeData(
      color: AppColors.border,
      thickness: 1,
    ),

    // Bottom nav
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AppColors.bgSurface,
      indicatorColor: AppColors.primary.withOpacity(0.15),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const IconThemeData(color: AppColors.primary, size: 24);
        }
        return const IconThemeData(color: AppColors.textSecondary, size: 24);
      }),
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const TextStyle(
            color: AppColors.primary,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          );
        }
        return const TextStyle(
          color: AppColors.textSecondary,
          fontSize: 11,
        );
      }),
    ),
  );

  AppTheme._();
}
