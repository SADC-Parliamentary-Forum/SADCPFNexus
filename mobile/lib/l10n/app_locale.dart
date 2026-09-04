import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const String kLocalePrefKey = 'sadcpf_locale';

enum AppLanguage { en, fr, pt }

extension AppLanguageX on AppLanguage {
  String get code => name;

  Locale get locale => Locale(code);

  String get nativeLabel => switch (this) {
        AppLanguage.en => 'English',
        AppLanguage.fr => 'Français',
        AppLanguage.pt => 'Português',
      };

  static AppLanguage fromCode(String? raw) {
    return switch (raw) {
      'fr' => AppLanguage.fr,
      'pt' => AppLanguage.pt,
      _ => AppLanguage.en,
    };
  }
}

final appLanguageProvider =
    StateNotifierProvider<AppLanguageNotifier, AppLanguage>((ref) {
  return AppLanguageNotifier();
});

class AppLanguageNotifier extends StateNotifier<AppLanguage> {
  AppLanguageNotifier() : super(AppLanguage.en) {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    state = AppLanguageX.fromCode(prefs.getString(kLocalePrefKey));
  }

  Future<void> setLanguage(AppLanguage language) async {
    if (state == language) return;
    state = language;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(kLocalePrefKey, language.code);
  }
}
