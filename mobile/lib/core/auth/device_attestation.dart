import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';

import 'auth_providers.dart';

/// Device biometric attestation. Optionally records a timesheet clock-in.
/// Never claims vendor biometric ingest — this is local_auth + API attest.
Future<bool> attestDeviceBiometric(
  BuildContext context,
  WidgetRef ref, {
  required String reason,
  bool clockIn = false,
}) async {
  final messenger = ScaffoldMessenger.of(context);
  try {
    final localAuth = LocalAuthentication();
    final canCheck = await localAuth.canCheckBiometrics || await localAuth.isDeviceSupported();
    if (!canCheck) {
      messenger.showSnackBar(const SnackBar(content: Text('Biometrics are not available on this device.')));
      return false;
    }
    final ok = await localAuth.authenticate(
      localizedReason: reason,
      options: const AuthenticationOptions(stickyAuth: true, biometricOnly: false),
    );
    if (!ok) {
      return false;
    }
    if (clockIn) {
      await ref.read(apiClientProvider).dio.post<Map<String, dynamic>>(
        '/hr/timesheets/attendance/clock',
        data: {
          'direction': 'in',
          'method': 'biometric',
          'device_attested': true,
        },
      );
    }
    if (context.mounted) {
      messenger.showSnackBar(const SnackBar(content: Text('Device attestation recorded.')));
    }
    return true;
  } catch (e) {
    messenger.showSnackBar(SnackBar(content: Text('Attestation failed: $e')));
    return false;
  }
}
