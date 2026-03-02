import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:local_auth/local_auth.dart';
import '../../../../core/auth/auth_providers.dart';
import '../../../../core/auth/auth_repository.dart';
import '../../../../core/theme/app_theme.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;
  String? _errorMessage;
  bool _biometricLoading = false;

  Future<void> _handleBiometricLogin() async {
    final storage = ref.read(authStorageProvider);
    final token = await storage.getToken();
    if (token == null || token.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Sign in with email first to enable biometric login.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      return;
    }
    setState(() => _biometricLoading = true);
    try {
      final localAuth = LocalAuthentication();
      final canCheck = await localAuth.canCheckBiometrics;
      if (!canCheck) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Biometrics not available.'), behavior: SnackBarBehavior.floating),
          );
        }
        return;
      }
      final authenticated = await localAuth.authenticate(
        localizedReason: 'Authenticate to sign in to SADC PF Nexus',
        options: const AuthenticationOptions(stickyAuth: true),
      );
      if (authenticated && mounted) {
        context.go('/dashboard');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Biometric failed: ${e.toString().split('.').last}'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _biometricLoading = false);
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    final auth = ref.read(authRepositoryProvider);
    final result = await auth.login(
      _emailController.text.trim(),
      _passwordController.text,
    );
    if (!mounted) return;
    setState(() => _isLoading = false);
    if (result.isSuccess) {
      context.go('/dashboard');
    } else {
      setState(() => _errorMessage = result.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const SizedBox(height: 40),
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.bgSurface,
                  border: Border.all(color: AppColors.gold, width: 3),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withOpacity(0.2),
                      blurRadius: 24,
                      spreadRadius: 4,
                    ),
                  ],
                ),
                child: const Center(
                  child: Icon(Icons.account_balance, size: 48, color: AppColors.primary),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'SADC PF Nexus',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Parliamentary Forum Governance Platform',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                  letterSpacing: 0.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppColors.bgSurface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.border),
                ),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Sign In', style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 4),
                      Text('Enter your credentials to continue',
                          style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(height: 24),
                      Text(
                        'EMAIL ADDRESS',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          letterSpacing: 1.2,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        style: const TextStyle(color: AppColors.textPrimary),
                        decoration: const InputDecoration(
                          hintText: 'you@sadcpf.org',
                          prefixIcon: Icon(Icons.email_outlined,
                              color: AppColors.textSecondary, size: 20),
                        ),
                        validator: (val) {
                          if (val == null || val.isEmpty) return 'Email is required';
                          if (!val.contains('@')) return 'Enter a valid email';
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'PASSWORD',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          letterSpacing: 1.2,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _passwordController,
                        obscureText: _obscurePassword,
                        style: const TextStyle(color: AppColors.textPrimary),
                        decoration: InputDecoration(
                          hintText: 'password',
                          prefixIcon: const Icon(Icons.lock_outline,
                              color: AppColors.textSecondary, size: 20),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscurePassword
                                  ? Icons.visibility_outlined
                                  : Icons.visibility_off_outlined,
                              color: AppColors.textSecondary,
                              size: 20,
                            ),
                            onPressed: () =>
                                setState(() => _obscurePassword = !_obscurePassword),
                          ),
                        ),
                        validator: (val) {
                          if (val == null || val.isEmpty) return 'Password is required';
                          if (val.length < 8) return 'Minimum 8 characters';
                          return null;
                        },
                      ),
                      const SizedBox(height: 28),
                      ElevatedButton(
                        onPressed: _isLoading ? null : _handleLogin,
                        child: _isLoading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: AppColors.bgDark,
                                ),
                              )
                            : const Text('Sign In'),
                      ),
                      const SizedBox(height: 16),
                      Center(
                        child: TextButton.icon(
                          onPressed: _biometricLoading ? null : _handleBiometricLogin,
                          icon: _biometricLoading
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                                )
                              : const Icon(Icons.fingerprint, color: AppColors.primary, size: 22),
                          label: Text(
                            _biometricLoading ? 'Authenticating…' : 'Use biometric login',
                            style: const TextStyle(color: AppColors.primary, fontSize: 13),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 32),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.shield_outlined, color: AppColors.textMuted, size: 14),
                  const SizedBox(width: 6),
                  Text(
                    'Secured by SADC PF Security Framework',
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
