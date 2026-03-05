import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class UserProfileSecurityScreen extends StatefulWidget {
  const UserProfileSecurityScreen({super.key});
  @override
  State<UserProfileSecurityScreen> createState() => _UserProfileSecurityScreenState();
}

class _UserProfileSecurityScreenState extends State<UserProfileSecurityScreen> {
  bool _biometric = true;
  bool _twoFactor = true;
  bool _loginAlerts = true;
  bool _sessionTimeout = false;

  final _sessions = [
    {'device': 'iPhone 15 Pro', 'location': 'Windhoek, Namibia', 'time': 'Active now', 'current': true, 'icon': Icons.smartphone},
    {'device': 'MacBook Pro', 'location': 'Windhoek, Namibia', 'time': '2h ago', 'current': false, 'icon': Icons.laptop_mac},
    {'device': 'iPad Air', 'location': 'Gaborone, Botswana', 'time': '3 days ago', 'current': false, 'icon': Icons.tablet_mac},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('Security Settings', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Security Score
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [AppColors.primary.withValues(alpha: 0.15), AppColors.bgSurface]),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
            ),
            child: Row(children: [
              SizedBox(width: 64, height: 64,
                child: Stack(alignment: Alignment.center, children: [
                  CircularProgressIndicator(value: 0.88, strokeWidth: 5,
                    backgroundColor: AppColors.bgDark, valueColor: const AlwaysStoppedAnimation(AppColors.primary)),
                  const Text('88', style: TextStyle(color: AppColors.primary, fontSize: 18, fontWeight: FontWeight.w900)),
                ]),
              ),
              const SizedBox(width: 16),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Security Score', style: TextStyle(color: AppColors.textPrimary, fontSize: 15, fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                const Text('Strong — Enable session timeout to reach 100%', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
                const SizedBox(height: 8),
                Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
                  child: const Text('Strong Protection', style: TextStyle(color: AppColors.primary, fontSize: 10, fontWeight: FontWeight.w700))),
              ])),
            ]),
          ),
          const SizedBox(height: 20),
          // Authentication
          const Text('AUTHENTICATION', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 10),
          _settingsTile(
            icon: Icons.fingerprint,
            label: 'Biometric Login',
            subtitle: 'Use fingerprint or Face ID to sign in',
            value: _biometric,
            onChanged: (v) => setState(() => _biometric = v),
            color: AppColors.primary,
          ),
          _settingsTile(
            icon: Icons.security,
            label: 'Two-Factor Authentication',
            subtitle: 'Receive SMS code on each login',
            value: _twoFactor,
            onChanged: (v) => setState(() => _twoFactor = v),
            color: AppColors.success,
          ),
          const SizedBox(height: 16),
          // Alerts
          const Text('ALERTS & SESSIONS', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 10),
          _settingsTile(
            icon: Icons.notifications_active_outlined,
            label: 'Login Alerts',
            subtitle: 'Notify me of new device sign-ins',
            value: _loginAlerts,
            onChanged: (v) => setState(() => _loginAlerts = v),
            color: AppColors.warning,
          ),
          _settingsTile(
            icon: Icons.timer_outlined,
            label: 'Session Timeout',
            subtitle: 'Auto sign out after 30 minutes of inactivity',
            value: _sessionTimeout,
            onChanged: (v) => setState(() => _sessionTimeout = v),
            color: AppColors.info,
          ),
          const SizedBox(height: 16),
          // Actions
          const Text('ACCOUNT ACTIONS', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 10),
          _actionTile(Icons.lock_reset_outlined, 'Change Password', 'Last changed 90 days ago', AppColors.primary, () {}),
          _actionTile(Icons.key_outlined, 'Reset Biometric PIN', 'Requires HR approval', AppColors.warning, () {}),
          _actionTile(Icons.download_outlined, 'Download Activity Log', 'Last 90 days of activity', AppColors.info, () {}),
          const SizedBox(height: 16),
          // Active sessions
          const Text('ACTIVE SESSIONS', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 10),
          ..._sessions.map((s) => _sessionTile(s)),
          const SizedBox(height: 12),
          TextButton.icon(
            onPressed: () {},
            icon: const Icon(Icons.logout, color: AppColors.danger, size: 16),
            label: const Text('Sign Out All Other Sessions', style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.w700)),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _settingsTile({required IconData icon, required String label, required String subtitle, required bool value, required ValueChanged<bool> onChanged, required Color color}) =>
    Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
      child: Row(children: [
        Container(width: 36, height: 36,
          decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, color: color, size: 18)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
          Text(subtitle, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
        ])),
        Switch(
          value: value, onChanged: onChanged,
          activeColor: AppColors.primary, activeTrackColor: AppColors.primary.withValues(alpha: 0.3),
          inactiveThumbColor: AppColors.textMuted, inactiveTrackColor: AppColors.bgDark,
        ),
      ]),
    );

  Widget _actionTile(IconData icon, String label, String sub, Color color, VoidCallback onTap) =>
    GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
        child: Row(children: [
          Container(width: 36, height: 36,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: color, size: 18)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
            Text(sub, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
          ])),
          const Icon(Icons.chevron_right, color: AppColors.textMuted, size: 18),
        ]),
      ),
    );

  Widget _sessionTile(Map<String, dynamic> s) => Container(
    margin: const EdgeInsets.only(bottom: 8),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: AppColors.bgSurface,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: s['current'] as bool ? AppColors.primary.withValues(alpha: 0.4) : AppColors.border),
    ),
    child: Row(children: [
      Icon(s['icon'] as IconData, color: s['current'] as bool ? AppColors.primary : AppColors.textMuted, size: 22),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(s['device'] as String, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
          if (s['current'] as bool) ...[
            const SizedBox(width: 6),
            Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(4)),
              child: const Text('This device', style: TextStyle(color: AppColors.primary, fontSize: 9, fontWeight: FontWeight.w700))),
          ],
        ]),
        Text('${s['location']}  ·  ${s['time']}', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
      ])),
      if (!(s['current'] as bool))
        TextButton(onPressed: () {}, child: const Text('Revoke', style: TextStyle(color: AppColors.danger, fontSize: 12, fontWeight: FontWeight.w700))),
    ]),
  );
}
