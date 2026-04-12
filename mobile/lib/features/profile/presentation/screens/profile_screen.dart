import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/auth/auth_providers.dart';
import '../../../../core/notifications/fcm_service.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_provider.dart';
import '../../../../shared/widgets/shell_drawer_scope.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  String? _name;
  String? _email;
  bool _loading = true;
  bool _loggingOut = false;

  @override
  void initState() {
    super.initState();
    _loadUser();
  }

  Future<void> _loadUser() async {
    final auth = ref.read(authRepositoryProvider);
    final name = await auth.getStoredUserName();
    final email = await auth.getStoredUserEmail();
    if (mounted) {
      setState(() {
        _name = name;
        _email = email;
        _loading = false;
      });
    }
  }

  Future<void> _logout() async {
    setState(() => _loggingOut = true);
    // Unregister FCM token before logout so no more pushes come to this device.
    await ref.read(fcmServiceProvider).unregister();
    await ref.read(authSessionControllerProvider).logout();
    if (!mounted) return;
    context.go('/login');
  }

  String get _initials {
    if (_name == null || _name!.isEmpty) return '?';
    return _name!.split(' ')
        .where((e) => e.isNotEmpty)
        .take(2)
        .map((e) => e[0])
        .join()
        .toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: SafeArea(
        child: _loading
            ? Center(child: CircularProgressIndicator(color: theme.colorScheme.primary))
            : CustomScrollView(
                slivers: [
                  SliverAppBar(
                    pinned: false,
                    backgroundColor: theme.scaffoldBackgroundColor,
                    elevation: 0,
                    leading: IconButton(
                      icon: const Icon(Icons.menu),
                      onPressed: ShellDrawerScope.openDrawerOf(context),
                    ),
                    title: Text(
                      'Profile',
                      style: theme.textTheme.titleLarge?.copyWith(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),

                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                      child: Column(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(24),
                            decoration: BoxDecoration(
                              color: theme.colorScheme.surface,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: theme.colorScheme.outline),
                            ),
                            child: Column(
                              children: [
                                Stack(
                                  children: [
                                    Container(
                                      width: 80, height: 80,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: theme.colorScheme.primary.withValues(alpha: 0.15),
                                        border: Border.all(
                                          color: theme.colorScheme.primary.withValues(alpha: 0.4), width: 2),
                                      ),
                                      child: Center(
                                        child: Text(_initials,
                                          style: TextStyle(
                                            color: theme.colorScheme.primary,
                                            fontSize: 28,
                                            fontWeight: FontWeight.w800,
                                          )),
                                      ),
                                    ),
                                    Positioned(
                                      bottom: 2, right: 2,
                                      child: Container(
                                        width: 18, height: 18,
                                        decoration: const BoxDecoration(
                                          color: AppColors.success,
                                          shape: BoxShape.circle,
                                        ),
                                        child: const Icon(Icons.check, size: 11, color: Colors.white),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 16),
                                Text(_name ?? 'User',
                                  textAlign: TextAlign.center,
                                  style: theme.textTheme.titleMedium?.copyWith(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w800,
                                  )),
                                const SizedBox(height: 4),
                                if (_email != null)
                                  Text(_email!,
                                    textAlign: TextAlign.center,
                                    style: theme.textTheme.bodyMedium?.copyWith(fontSize: 13)),
                                const SizedBox(height: 12),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                                  decoration: BoxDecoration(
                                    color: theme.colorScheme.primary.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(color: theme.colorScheme.primary.withValues(alpha: 0.2)),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.verified_user_outlined, size: 13, color: theme.colorScheme.primary),
                                      const SizedBox(width: 5),
                                      Text('Staff Member',
                                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
                                          color: theme.colorScheme.primary)),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),

                          const SizedBox(height: 20),

                          // Info section
                          _Section(
                            title: 'Account',
                            icon: Icons.person_outline,
                            children: [
                              _InfoTile(
                                icon: Icons.person,
                                label: 'Full Name',
                                value: _name ?? '—',
                              ),
                              _InfoTile(
                                icon: Icons.email_outlined,
                                label: 'Email Address',
                                value: _email ?? '—',
                              ),
                              const _InfoTile(
                                icon: Icons.corporate_fare,
                                label: 'Organisation',
                                value: 'SADC Parliamentary Forum',
                              ),
                            ],
                          ),

                          const SizedBox(height: 14),

                          // Settings section
                          _Section(
                            title: 'Preferences',
                            icon: Icons.settings_outlined,
                            children: [
                              const _ThemeTile(),
                              _ActionTile(
                                icon: Icons.notifications_outlined,
                                label: 'Notifications',
                                iconColor: theme.colorScheme.primary,
                                iconBg: theme.colorScheme.primary,
                                onTap: () {},
                              ),
                              _ActionTile(
                                icon: Icons.security,
                                label: 'Security Settings',
                                iconColor: AppColors.warning,
                                iconBg: AppColors.warning,
                                onTap: () => context.push('/profile/security'),
                              ),
                              _ActionTile(
                                icon: Icons.wifi_off,
                                label: 'Offline Drafts',
                                iconColor: AppColors.info,
                                iconBg: AppColors.info,
                                onTap: () => context.push('/offline/drafts'),
                              ),
                              _ActionTile(
                                icon: Icons.help_outline,
                                label: 'Help & Support',
                                iconColor: AppColors.success,
                                iconBg: AppColors.success,
                                onTap: () => context.push('/support'),
                              ),
                            ],
                          ),

                          const SizedBox(height: 14),

                          // App info
                          const _Section(
                            title: 'Application',
                            icon: Icons.info_outline,
                            children: [
                              _InfoTile(
                                icon: Icons.phone_android,
                                label: 'App Version',
                                value: 'v4.2.0',
                              ),
                              _InfoTile(
                                icon: Icons.business,
                                label: 'System',
                                value: 'SADCPFNexus',
                              ),
                            ],
                          ),

                          const SizedBox(height: 24),

                          GestureDetector(
                            onTap: _loggingOut ? null : _logout,
                            child: Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: theme.colorScheme.error.withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: theme.colorScheme.error.withValues(alpha: 0.25)),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 38, height: 38,
                                    decoration: BoxDecoration(
                                      color: theme.colorScheme.error.withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: _loggingOut
                                        ? Center(child: SizedBox(
                                            width: 18, height: 18,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2, color: theme.colorScheme.error)))
                                        : Icon(Icons.logout, color: theme.colorScheme.error, size: 20),
                                  ),
                                  const SizedBox(width: 12),
                                  Text(
                                    _loggingOut ? 'Signing out…' : 'Sign Out',
                                    style: theme.textTheme.titleSmall?.copyWith(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: theme.colorScheme.error,
                                    )),
                                  const Spacer(),
                                  Icon(Icons.chevron_right, color: theme.colorScheme.error, size: 18),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<Widget> children;
  const _Section({required this.title, required this.icon, required this.children});

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8, left: 4),
          child: Row(
            children: [
              Icon(icon, size: 13, color: c.onSurface.withValues(alpha: 0.5)),
              const SizedBox(width: 5),
              Text(title.toUpperCase(),
                style: textTheme.labelSmall?.copyWith(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: c.onSurface.withValues(alpha: 0.5),
                  letterSpacing: 1.2,
                )),
            ],
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: c.outline),
          ),
          child: Column(
            children: children.asMap().entries.map((entry) {
              final isLast = entry.key == children.length - 1;
              return Column(
                children: [
                  entry.value,
                  if (!isLast)
                    Divider(height: 1, color: c.outline.withValues(alpha: 0.5),
                      indent: 60, endIndent: 16),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }
}

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoTile({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 34, height: 34,
            decoration: BoxDecoration(
              color: c.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, size: 17, color: c.onSurface.withValues(alpha: 0.7)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                  style: textTheme.labelSmall?.copyWith(
                    fontSize: 10, fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(value,
                  style: textTheme.bodyMedium?.copyWith(
                    fontSize: 13, fontWeight: FontWeight.w500)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Theme (Light/Dark) setting. Default is light; switchable in Profile > Preferences.
class _ThemeTile extends ConsumerWidget {
  const _ThemeTile();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);
    final isDark = themeMode == ThemeMode.dark;
    return GestureDetector(
      onTap: () => _showThemeDialog(context, ref),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(9),
              ),
              child: Icon(
                isDark ? Icons.dark_mode : Icons.light_mode,
                size: 17,
                color: Theme.of(context).colorScheme.primary,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Appearance',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            Text(
              isDark ? 'Dark' : 'Light',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(width: 8),
            Icon(Icons.chevron_right, size: 16, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5)),
          ],
        ),
      ),
    );
  }

  void _showThemeDialog(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(themeModeProvider.notifier);
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Theme.of(ctx).colorScheme.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: const Text('Appearance'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: const Text('Light'),
              leading: const Icon(Icons.light_mode),
              onTap: () {
                notifier.setThemeMode(ThemeMode.light);
                Navigator.of(ctx).pop();
              },
            ),
            ListTile(
              title: const Text('Dark'),
              leading: const Icon(Icons.dark_mode),
              onTap: () {
                notifier.setThemeMode(ThemeMode.dark);
                Navigator.of(ctx).pop();
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color iconColor;
  final Color iconBg;
  final VoidCallback onTap;
  const _ActionTile({
    required this.icon,
    required this.label,
    required this.iconColor,
    required this.iconBg,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final c = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 34, height: 34,
              decoration: BoxDecoration(
                color: iconBg.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(9),
              ),
              child: Icon(icon, size: 17, color: iconColor),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(label,
                style: textTheme.bodyMedium?.copyWith(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                )),
            ),
            Icon(Icons.chevron_right, size: 16, color: c.onSurface.withValues(alpha: 0.5)),
          ],
        ),
      ),
    );
  }
}
