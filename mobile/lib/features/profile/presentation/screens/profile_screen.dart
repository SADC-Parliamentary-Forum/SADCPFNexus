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
    if (mounted) {
      context.go('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        backgroundColor: AppColors.bgSurface,
        foregroundColor: AppColors.textPrimary,
      ),
      backgroundColor: AppColors.bgDark,
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 24),
                  Center(
                    child: CircleAvatar(
                      radius: 48,
                      backgroundColor: AppColors.primary.withValues(alpha: 0.2),
                      child: Text(
                        (_name?.isNotEmpty == true)
                            ? _name!.split(' ').map((e) => e.isNotEmpty ? e[0] : '').take(2).join().toUpperCase()
                            : '?',
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    _name ?? 'User',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  if (_email != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      _email!,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: AppColors.textSecondary,
                          ),
                    ),
                  ],
                  const SizedBox(height: 48),
                  OutlinedButton.icon(
                    onPressed: _loggingOut ? null : _logout,
                    icon: _loggingOut
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                          )
                        : const Icon(Icons.logout, size: 20, color: AppColors.primary),
                    label: Text(_loggingOut ? 'Signing out…' : 'Sign out', style: const TextStyle(color: AppColors.primary)),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      side: const BorderSide(color: AppColors.primary),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
