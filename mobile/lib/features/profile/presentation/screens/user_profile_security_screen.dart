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
  int _idleMinutes = 120;
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
        final idle = _profile?['idle_timeout_minutes'];
        if (idle is num) {
          _idleMinutes = idle.toInt();
        } else {
          _idleMinutes = prefs.getInt('security.idle_timeout_minutes') ?? 120;
        }
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

  Future<void> _saveIdleTimeout(int minutes) async {
    try {
      await ref.read(apiClientProvider).dio.patch(
        '/profile/idle-timeout',
        data: {'idle_timeout_minutes': minutes},
      );
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt('security.idle_timeout_minutes', minutes);
      if (mounted) setState(() => _idleMinutes = minutes);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to save session timeout.')),
      );
    }
  }

  Future<void> _changePassword() async {
    final currentController = TextEditingController();
    final passwordController = TextEditingController();
    final confirmController = TextEditingController();
    final formKey = GlobalKey<FormState>();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Change Password'),
        content: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: currentController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Current Password'),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Current password is required';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: passwordController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'New Password'),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'New password is required';
                  }
                  if (value.length < 8) {
                    return 'Minimum 8 characters';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: confirmController,
                obscureText: true,
                decoration:
                    const InputDecoration(labelText: 'Confirm New Password'),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please confirm your new password';
                  }
                  if (value != passwordController.text) {
                    return 'Passwords do not match';
                  }
                  return null;
                },
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              if (formKey.currentState?.validate() != true) return;
              Navigator.pop(ctx, true);
            },
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
    final theme = Theme.of(context);
    final c = theme.colorScheme;
    final muted = c.onSurface.withValues(alpha: 0.55);
    final secondary = c.onSurface.withValues(alpha: 0.75);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: theme.scaffoldBackgroundColor,
        elevation: 0,
        leading: IconButton(
          icon: Icon(
            Icons.arrow_back_ios_new,
            size: 18,
            color: c.onSurface,
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Security Settings',
          style: TextStyle(
            color: c.onSurface,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh, color: c.onSurface),
            onPressed: _loading ? null : _load,
          ),
        ],
      ),
      body: _loading
          ? Center(
              child: CircularProgressIndicator(color: c.primary),
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
                            c.primary.withValues(alpha: 0.15),
                            c.surface,
                          ],
                        ),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: c.primary.withValues(alpha: 0.25),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _profile?['name']?.toString() ?? 'Current User',
                            style: TextStyle(
                              color: c.onSurface,
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _profile?['email']?.toString() ?? '-',
                            style: TextStyle(
                              color: muted,
                              fontSize: 11,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            _biometricAvailable
                                ? 'Biometric login is available on this device.'
                                : 'Biometric login is not available on this device.',
                            style: TextStyle(
                              color: secondary,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      'AUTHENTICATION',
                      style: TextStyle(
                        color: muted,
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
                      color: c.primary,
                    ),
                    _settingsTile(
                      icon: Icons.notifications_active_outlined,
                      label: 'Login Alerts',
                      subtitle: 'Store alert preference locally on this device.',
                      value: _loginAlerts,
                      onChanged: _toggleLoginAlerts,
                      color: AppColors.warning,
                    ),
                    _idleTimeoutTile(c, muted, secondary),
                    const SizedBox(height: 16),
                    Text(
                      'ACCOUNT ACTIONS',
                      style: TextStyle(
                        color: muted,
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
                      c.primary,
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
                        color: c.surface,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: c.outline),
                      ),
                      child: Text(
                        'Server-managed active session listings and remote session revocation are not exposed by the current API, so this screen only shows real settings and actions the mobile client can actually perform.',
                        style: TextStyle(
                          color: secondary,
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

  Widget _idleTimeoutTile(ColorScheme c, Color muted, Color secondary) {
    const options = <int, String>{
      15: '15 minutes',
      30: '30 minutes',
      60: '1 hour',
      120: '2 hours',
      480: '8 hours',
      0: 'Never',
    };
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.outline),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.info.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.timer_outlined, color: AppColors.info, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Session Timeout',
                  style: TextStyle(
                    color: c.onSurface,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  'Sign out after inactivity. Enforced by the server.',
                  style: TextStyle(color: secondary, fontSize: 12),
                ),
              ],
            ),
          ),
          DropdownButton<int>(
            value: options.containsKey(_idleMinutes) ? _idleMinutes : 120,
            underline: const SizedBox.shrink(),
            onChanged: (value) {
              if (value != null) _saveIdleTimeout(value);
            },
            items: options.entries
                .map(
                  (e) => DropdownMenuItem<int>(
                    value: e.key,
                    child: Text(e.value, style: TextStyle(color: muted, fontSize: 12)),
                  ),
                )
                .toList(),
          ),
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
  }) {
    final c = Theme.of(context).colorScheme;
    final muted = c.onSurface.withValues(alpha: 0.55);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.outline),
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
                  style: TextStyle(
                    color: c.onSurface,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: muted,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeColor: c.primary,
            activeTrackColor: c.primary.withValues(alpha: 0.3),
            inactiveThumbColor: muted,
            inactiveTrackColor: Theme.of(context).scaffoldBackgroundColor,
          ),
        ],
      ),
    );
  }

  Widget _actionTile(
    IconData icon,
    String label,
    String sub,
    Color color,
    VoidCallback onTap,
  ) {
    final c = Theme.of(context).colorScheme;
    final muted = c.onSurface.withValues(alpha: 0.55);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: c.outline),
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
                    style: TextStyle(
                      color: c.onSurface,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    sub,
                    style: TextStyle(
                      color: muted,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: muted, size: 18),
          ],
        ),
      ),
    );
  }
}
