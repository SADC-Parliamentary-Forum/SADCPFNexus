import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';

class UserProfileSecurityScreen extends ConsumerStatefulWidget {
  const UserProfileSecurityScreen({super.key});

  @override
  ConsumerState<UserProfileSecurityScreen> createState() =>
      _UserProfileSecurityScreenState();
}

class _UserProfileSecurityScreenState
    extends ConsumerState<UserProfileSecurityScreen> {
  bool _loading = true;
  bool _biometricEnabled = false;
  bool _loginAlerts = true;
  bool _sessionTimeout = false;
  bool _biometricAvailable = false;
  String? _error;
  Map<String, dynamic>? _profile;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final prefs = await SharedPreferences.getInstance();
      final localAuth = LocalAuthentication();
      final profileRes =
          await ref.read(apiClientProvider).dio.get<Map<String, dynamic>>('/profile');
      final canCheck = await localAuth.canCheckBiometrics;

      if (!mounted) return;
      setState(() {
        _profile = profileRes.data == null
            ? <String, dynamic>{}
            : Map<String, dynamic>.from(profileRes.data as Map);
        _biometricEnabled = prefs.getBool('security.biometric_enabled') ?? false;
        _loginAlerts = prefs.getBool('security.login_alerts') ?? true;
        _sessionTimeout = prefs.getBool('security.session_timeout') ?? false;
        _biometricAvailable = canCheck;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load security settings.';
        _loading = false;
      });
    }
  }

  Future<void> _storeBool(String key, bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(key, value);
  }

  Future<void> _toggleBiometric(bool value) async {
    if (value && !_biometricAvailable) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Biometrics are not available on this device.'),
          backgroundColor: AppColors.warning,
        ),
      );
      return;
    }
    await _storeBool('security.biometric_enabled', value);
    if (mounted) setState(() => _biometricEnabled = value);
  }

  Future<void> _toggleLoginAlerts(bool value) async {
    await _storeBool('security.login_alerts', value);
    if (mounted) setState(() => _loginAlerts = value);
  }

  Future<void> _toggleSessionTimeout(bool value) async {
    await _storeBool('security.session_timeout', value);
    if (mounted) setState(() => _sessionTimeout = value);
  }

  Future<void> _changePassword() async {
    final currentController = TextEditingController();
    final passwordController = TextEditingController();
    final confirmController = TextEditingController();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Change Password'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: currentController,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Current Password'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: passwordController,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'New Password'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: confirmController,
              obscureText: true,
              decoration:
                  const InputDecoration(labelText: 'Confirm New Password'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Update'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await ref.read(apiClientProvider).dio.put(
        '/profile/password',
        data: {
          'current_password': currentController.text,
          'password': passwordController.text,
          'password_confirmation': confirmController.text,
        },
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Password updated successfully.'),
          backgroundColor: AppColors.success,
        ),
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Password update failed. Check your input and try again.'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios_new,
            size: 18,
            color: AppColors.textPrimary,
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Security Settings',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textPrimary),
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
                          style: const TextStyle(color: AppColors.danger),
                        ),
                        const SizedBox(height: 12),
                        TextButton(onPressed: _load, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            AppColors.primary.withValues(alpha: 0.15),
                            AppColors.bgSurface,
                          ],
                        ),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: AppColors.primary.withValues(alpha: 0.25),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _profile?['name']?.toString() ?? 'Current User',
                            style: const TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _profile?['email']?.toString() ?? '-',
                            style: const TextStyle(
                              color: AppColors.textMuted,
                              fontSize: 11,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            _biometricAvailable
                                ? 'Biometric login is available on this device.'
                                : 'Biometric login is not available on this device.',
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'AUTHENTICATION',
                      style: TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.8,
                      ),
                    ),
                    const SizedBox(height: 10),
                    _settingsTile(
                      icon: Icons.fingerprint,
                      label: 'Biometric Login',
                      subtitle: _biometricAvailable
                          ? 'Use device biometrics after an initial sign-in.'
                          : 'Unavailable on this device.',
                      value: _biometricEnabled,
                      onChanged: _toggleBiometric,
                      color: AppColors.primary,
                    ),
                    _settingsTile(
                      icon: Icons.notifications_active_outlined,
                      label: 'Login Alerts',
                      subtitle: 'Store alert preference locally on this device.',
                      value: _loginAlerts,
                      onChanged: _toggleLoginAlerts,
                      color: AppColors.warning,
                    ),
                    _settingsTile(
                      icon: Icons.timer_outlined,
                      label: 'Session Timeout',
                      subtitle: 'Remember your timeout preference on this device.',
                      value: _sessionTimeout,
                      onChanged: _toggleSessionTimeout,
                      color: AppColors.info,
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'ACCOUNT ACTIONS',
                      style: TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.8,
                      ),
                    ),
                    const SizedBox(height: 10),
                    _actionTile(
                      Icons.lock_reset_outlined,
                      'Change Password',
                      'Update your account password using the server API.',
                      AppColors.primary,
                      _changePassword,
                    ),
                    _actionTile(
                      Icons.logout_outlined,
                      'Sign Out',
                      'Clear the stored session on this device.',
                      AppColors.danger,
                      () async {
                        await ref.read(authSessionControllerProvider).logout();
                        if (!mounted) return;
                        context.go('/login');
                      },
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.bgSurface,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: const Text(
                        'Server-managed active session listings and remote session revocation are not exposed by the current API, so this screen only shows real settings and actions the mobile client can actually perform.',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 12,
                          height: 1.5,
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),
                  ],
                ),
    );
  }

  Widget _settingsTile({
    required IconData icon,
    required String label,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
    required Color color,
  }) =>
      Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.bgSurface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
            Switch(
              value: value,
              onChanged: onChanged,
              activeColor: AppColors.primary,
              activeTrackColor: AppColors.primary.withValues(alpha: 0.3),
              inactiveThumbColor: AppColors.textMuted,
              inactiveTrackColor: AppColors.bgDark,
            ),
          ],
        ),
      );

  Widget _actionTile(
    IconData icon,
    String label,
    String sub,
    Color color,
    VoidCallback onTap,
  ) =>
      GestureDetector(
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: color, size: 18),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      sub,
                      style: const TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: AppColors.textMuted, size: 18),
            ],
          ),
        ),
      );
}
