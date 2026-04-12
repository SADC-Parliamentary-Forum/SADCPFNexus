import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:local_auth/local_auth.dart';
import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';

/// Login: email/password + optional biometric. Theme-aware (light/dark).
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
  bool _rememberMe = true;
  bool _isLoading = false;
  String? _errorMessage;
  bool _biometricLoading = false;

  // 2FA state
  bool _mfaRequired = false;
  final _totpController = TextEditingController();
  bool _totpLoading = false;

  Future<void> _handleBiometricLogin() async {
    final storage = ref.read(authStorageProvider);
    final token = await storage.getToken();
    if (token == null || token.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text(
              'Sign in with email first to enable biometric login.',
            ),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Theme.of(context).colorScheme.errorContainer,
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
            SnackBar(
              content: const Text('Biometrics not available.'),
              behavior: SnackBarBehavior.floating,
              backgroundColor: Theme.of(context).colorScheme.errorContainer,
            ),
          );
        }
        return;
      }
      final authenticated = await localAuth.authenticate(
        localizedReason: 'Authenticate to sign in to SADC PF Nexus',
        options: const AuthenticationOptions(stickyAuth: true),
      );
      if (authenticated && mounted) {
        final session = ref.read(authSessionControllerProvider);
        await session.bootstrap();
        if (!mounted) return;
        if (session.state.isAuthenticated) {
          context.go('/dashboard');
          return;
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text(
              'Stored session is no longer valid. Please sign in again.',
            ),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Theme.of(context).colorScheme.errorContainer,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Biometric failed: ${e.toString().split('.').last}',
            ),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Theme.of(context).colorScheme.errorContainer,
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
    _totpController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    final session = ref.read(authSessionControllerProvider);
    final result = await session.login(
      _emailController.text.trim(),
      _passwordController.text,
      rememberMe: _rememberMe,
    );
    if (!mounted) return;
    setState(() => _isLoading = false);
    if (result.mfaRequired) {
      setState(() {
        _mfaRequired = true;
        _totpController.clear();
        _errorMessage = null;
      });
    } else if (result.isSuccess) {
      context.go('/dashboard');
    } else {
      setState(() => _errorMessage = result.error);
    }
  }

  Future<void> _handleVerifyTotp() async {
    final code = _totpController.text.trim();
    if (code.length != 6) return;
    setState(() { _totpLoading = true; _errorMessage = null; });
    final repo = ref.read(authRepositoryProvider);
    final result = await repo.verifyMfa(code);
    if (!mounted) return;
    setState(() => _totpLoading = false);
    if (result.isSuccess) {
      context.go('/dashboard');
    } else {
      setState(() => _errorMessage = result.error);
    }
  }

  @override
  Widget _buildTotpStep(BuildContext context, ColorScheme c) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const SizedBox(height: 48),
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: c.primary.withValues(alpha: 0.1),
                  border: Border.all(color: c.primary.withValues(alpha: 0.4), width: 2),
                ),
                child: Icon(Icons.verified_user_rounded, size: 40, color: c.primary),
              ),
              const SizedBox(height: 20),
              Text(
                'Two-Factor Authentication',
                style: GoogleFonts.publicSans(
                  color: c.onSurface,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Enter the 6-digit code from your authenticator app to continue.',
                style: GoogleFonts.publicSans(
                  color: c.onSurface.withValues(alpha: 0.6),
                  fontSize: 13,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 36),
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: c.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: c.outline),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.06),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    if (_errorMessage != null) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: AppColors.danger.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.danger.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline, color: AppColors.danger, size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _errorMessage!,
                                style: GoogleFonts.publicSans(
                                  color: AppColors.danger,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                    TextField(
                      controller: _totpController,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      textAlign: TextAlign.center,
                      style: GoogleFonts.publicSans(
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 12,
                        color: c.onSurface,
                      ),
                      decoration: InputDecoration(
                        counterText: '',
                        hintText: '000000',
                        hintStyle: GoogleFonts.publicSans(
                          fontSize: 28,
                          fontWeight: FontWeight.w400,
                          letterSpacing: 12,
                          color: c.onSurface.withValues(alpha: 0.3),
                        ),
                        filled: true,
                        fillColor: c.surface,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: c.outline),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: c.primary, width: 2),
                        ),
                        contentPadding: const EdgeInsets.symmetric(vertical: 18),
                      ),
                      onChanged: (_) => setState(() {}),
                      onSubmitted: (_) => _handleVerifyTotp(),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: (_totpController.text.length == 6 && !_totpLoading)
                            ? _handleVerifyTotp
                            : null,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: c.primary,
                          foregroundColor: c.onPrimary,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: _totpLoading
                            ? SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  color: c.onPrimary,
                                  strokeWidth: 2.5,
                                ),
                              )
                            : Text(
                                'Verify Code',
                                style: GoogleFonts.publicSans(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () => setState(() {
                        _mfaRequired = false;
                        _errorMessage = null;
                        _totpController.clear();
                      }),
                      child: Text(
                        'Back to Sign In',
                        style: GoogleFonts.publicSans(
                          color: c.onSurface.withValues(alpha: 0.6),
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final c = theme.colorScheme;

    if (_mfaRequired) return _buildTotpStep(context, c);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const SizedBox(height: 32),
              // Logo
              Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: c.surface,
                  border: Border.all(
                    color: c.primary.withValues(alpha: 0.5),
                    width: 2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: c.primary.withValues(alpha: 0.2),
                      blurRadius: 20,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: Icon(
                  Icons.account_balance_rounded,
                  size: 44,
                  color: c.primary,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'SADC PF Nexus',
                style: GoogleFonts.publicSans(
                  color: c.onSurface,
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Parliamentary Forum Governance Platform',
                style: GoogleFonts.publicSans(
                  color: c.onSurface.withValues(alpha: 0.7),
                  fontSize: 13,
                  letterSpacing: 0.3,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 40),
              // Form card
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: c.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: c.outline),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.06),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Sign In',
                        style: GoogleFonts.publicSans(
                          color: c.onSurface,
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Enter your credentials to continue',
                        style: GoogleFonts.publicSans(
                          color: c.onSurface.withValues(alpha: 0.7),
                          fontSize: 13,
                        ),
                      ),
                      if (_errorMessage != null) ...[
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.danger.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: AppColors.danger.withValues(alpha: 0.3),
                            ),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.error_outline,
                                color: AppColors.danger,
                                size: 20,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  _errorMessage!,
                                  style: GoogleFonts.publicSans(
                                    color: AppColors.danger,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 20),
                      Text(
                        'EMAIL ADDRESS',
                        style: GoogleFonts.publicSans(
                          color: c.onSurface.withValues(alpha: 0.8),
                          fontSize: 11,
                          letterSpacing: 1.0,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        autocorrect: false,
                        style: GoogleFonts.publicSans(
                          color: c.onSurface,
                          fontSize: 15,
                        ),
                        decoration: InputDecoration(
                          hintText: 'you@sadcpf.org',
                          hintStyle: TextStyle(
                            color: c.onSurface.withValues(alpha: 0.5),
                          ),
                          prefixIcon: Icon(
                            Icons.email_outlined,
                            color: c.onSurface.withValues(alpha: 0.6),
                            size: 20,
                          ),
                        ),
                        validator: (val) {
                          if (val == null || val.isEmpty) {
                            return 'Email is required';
                          }
                          if (!val.contains('@')) {
                            return 'Enter a valid email';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'PASSWORD',
                        style: GoogleFonts.publicSans(
                          color: c.onSurface.withValues(alpha: 0.8),
                          fontSize: 11,
                          letterSpacing: 1.0,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _passwordController,
                        obscureText: _obscurePassword,
                        style: GoogleFonts.publicSans(
                          color: c.onSurface,
                          fontSize: 15,
                        ),
                        decoration: InputDecoration(
                          hintText: '••••••••',
                          hintStyle: TextStyle(
                            color: c.onSurface.withValues(alpha: 0.5),
                          ),
                          prefixIcon: Icon(
                            Icons.lock_outline,
                            color: c.onSurface.withValues(alpha: 0.6),
                            size: 20,
                          ),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscurePassword
                                  ? Icons.visibility_outlined
                                  : Icons.visibility_off_outlined,
                              color: c.onSurface.withValues(alpha: 0.6),
                              size: 20,
                            ),
                            onPressed: () => setState(
                              () => _obscurePassword = !_obscurePassword,
                            ),
                          ),
                        ),
                        validator: (val) {
                          if (val == null || val.isEmpty) {
                            return 'Password is required';
                          }
                          if (val.length < 8) {
                            return 'Minimum 8 characters';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 24),
                      CheckboxListTile(
                        value: _rememberMe,
                        onChanged: _isLoading
                            ? null
                            : (value) {
                                setState(() => _rememberMe = value ?? true);
                              },
                        dense: true,
                        visualDensity: const VisualDensity(
                          horizontal: -4,
                          vertical: -4,
                        ),
                        contentPadding: EdgeInsets.zero,
                        controlAffinity: ListTileControlAffinity.leading,
                        activeColor: c.primary,
                        title: Text(
                          'Remember me',
                          style: GoogleFonts.publicSans(
                            color: c.onSurface,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        subtitle: Text(
                          'Keep me signed in on this device/browser.',
                          style: GoogleFonts.publicSans(
                            color: c.onSurface.withValues(alpha: 0.65),
                            fontSize: 11,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: ElevatedButton(
                          onPressed: _isLoading ? null : _handleLogin,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: c.primary,
                            foregroundColor: c.onPrimary,
                            disabledBackgroundColor: c.outline.withValues(
                              alpha: 0.5,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                            elevation: 0,
                          ),
                          child: _isLoading
                              ? SizedBox(
                                  height: 22,
                                  width: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: c.onPrimary,
                                  ),
                                )
                              : Text(
                                  'Sign In',
                                  style: GoogleFonts.publicSans(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 15,
                                  ),
                                ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Center(
                        child: TextButton.icon(
                          onPressed: _biometricLoading
                              ? null
                              : _handleBiometricLogin,
                          icon: _biometricLoading
                              ? SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: c.primary,
                                  ),
                                )
                              : Icon(
                                  Icons.fingerprint,
                                  color: c.primary,
                                  size: 22,
                                ),
                          label: Text(
                            _biometricLoading
                                ? 'Authenticating…'
                                : 'Use biometric login',
                            style: GoogleFonts.publicSans(
                              color: c.primary,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 28),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.shield_outlined,
                    color: c.onSurface.withValues(alpha: 0.5),
                    size: 14,
                  ),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      'Secured by SADC PF Security Framework',
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.publicSans(
                        color: c.onSurface.withValues(alpha: 0.5),
                        fontSize: 11,
                      ),
                    ),
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
