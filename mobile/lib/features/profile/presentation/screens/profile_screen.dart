import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';

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
    final auth = ref.read(authRepositoryProvider);
    await auth.logout();
    if (mounted) context.go('/login');
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
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
            : CustomScrollView(
                slivers: [
                  // Header bar
                  const SliverAppBar(
                    pinned: false,
                    backgroundColor: AppColors.bgDark,
                    elevation: 0,
                    automaticallyImplyLeading: false,
                    title: Text('Profile',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary)),
                  ),

                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                      child: Column(
                        children: [
                          // Avatar card
                          Container(
                            padding: const EdgeInsets.all(24),
                            decoration: BoxDecoration(
                              color: AppColors.bgSurface,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Column(
                              children: [
                                // Avatar
                                Stack(
                                  children: [
                                    Container(
                                      width: 80, height: 80,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: AppColors.primary.withValues(alpha:0.15),
                                        border: Border.all(
                                          color: AppColors.primary.withValues(alpha:0.4), width: 2),
                                      ),
                                      child: Center(
                                        child: Text(_initials,
                                          style: const TextStyle(
                                            color: AppColors.primary,
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
                                  style: const TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.textPrimary,
                                  )),
                                const SizedBox(height: 4),
                                if (_email != null)
                                  Text(_email!,
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                      fontSize: 13,
                                      color: AppColors.textSecondary,
                                    )),
                                const SizedBox(height: 12),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                                  decoration: BoxDecoration(
                                    color: AppColors.primary.withValues(alpha:0.1),
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(color: AppColors.primary.withValues(alpha:0.2)),
                                  ),
                                  child: const Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.verified_user_outlined, size: 13, color: AppColors.primary),
                                      SizedBox(width: 5),
                                      Text('Staff Member',
                                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
                                          color: AppColors.primary)),
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
                              _ActionTile(
                                icon: Icons.notifications_outlined,
                                label: 'Notifications',
                                iconColor: AppColors.primary,
                                iconBg: AppColors.primary,
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

                          // Sign out button
                          GestureDetector(
                            onTap: _loggingOut ? null : _logout,
                            child: Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: AppColors.danger.withValues(alpha:0.08),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: AppColors.danger.withValues(alpha:0.25)),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 38, height: 38,
                                    decoration: BoxDecoration(
                                      color: AppColors.danger.withValues(alpha:0.12),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: _loggingOut
                                        ? const Center(child: SizedBox(
                                            width: 18, height: 18,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2, color: AppColors.danger)))
                                        : const Icon(Icons.logout, color: AppColors.danger, size: 20),
                                  ),
                                  const SizedBox(width: 12),
                                  Text(
                                    _loggingOut ? 'Signing out…' : 'Sign Out',
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.danger,
                                    )),
                                  const Spacer(),
                                  const Icon(Icons.chevron_right, color: AppColors.danger, size: 18),
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8, left: 4),
          child: Row(
            children: [
              Icon(icon, size: 13, color: AppColors.textMuted),
              const SizedBox(width: 5),
              Text(title.toUpperCase(),
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textMuted,
                  letterSpacing: 1.2,
                )),
            ],
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            children: children.asMap().entries.map((entry) {
              final isLast = entry.key == children.length - 1;
              return Column(
                children: [
                  entry.value,
                  if (!isLast)
                    Divider(height: 1, color: AppColors.border.withValues(alpha:0.5),
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
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 34, height: 34,
            decoration: BoxDecoration(
              color: AppColors.bgDark,
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, size: 17, color: AppColors.textSecondary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                  style: const TextStyle(fontSize: 10, color: AppColors.textMuted,
                    fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(value,
                  style: const TextStyle(fontSize: 13, color: AppColors.textPrimary,
                    fontWeight: FontWeight.w500)),
              ],
            ),
          ),
        ],
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
    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 34, height: 34,
              decoration: BoxDecoration(
                color: iconBg.withValues(alpha:0.12),
                borderRadius: BorderRadius.circular(9),
              ),
              child: Icon(icon, size: 17, color: iconColor),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(label,
                style: const TextStyle(fontSize: 13, color: AppColors.textPrimary,
                  fontWeight: FontWeight.w500)),
            ),
            const Icon(Icons.chevron_right, size: 16, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}
