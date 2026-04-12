import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Lightweight key-value cache backed by SharedPreferences.
///
/// Entries are stored as JSON objects with an expiry timestamp so stale data
/// is never silently returned after [ttl] has elapsed.
///
/// Usage:
///   final cache = CacheService();
///   await cache.init();
///
///   // Write
///   await cache.set('dashboard_stats', {'pending': 3}, ttl: Duration(hours: 1));
///
///   // Read (returns null if missing or expired)
///   final data = await cache.get<Map<String, dynamic>>('dashboard_stats');
///
///   // Invalidate
///   await cache.invalidate('dashboard_stats');
class CacheService {
  static const _prefix = 'sadcpf_cache_';

  SharedPreferences? _prefs;

  Future<void> init() async {
    _prefs ??= await SharedPreferences.getInstance();
  }

  SharedPreferences get _p {
    assert(_prefs != null, 'CacheService.init() must be called before use');
    return _prefs!;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /// Read a cached value. Returns null if missing or expired.
  Future<T?> get<T>(String key) async {
    await _ensureInit();
    final raw = _p.getString('$_prefix$key');
    if (raw == null) return null;

    try {
      final wrapper = jsonDecode(raw) as Map<String, dynamic>;
      final expiry = wrapper['expiry'] as int?;
      if (expiry != null && DateTime.now().millisecondsSinceEpoch > expiry) {
        // Expired — clean up silently.
        _p.remove('$_prefix$key');
        return null;
      }
      final value = wrapper['value'];
      return value as T?;
    } catch (_) {
      return null;
    }
  }

  /// Write a value. [ttl] defaults to 5 minutes.
  Future<void> set(
    String key,
    dynamic value, {
    Duration ttl = const Duration(minutes: 5),
  }) async {
    await _ensureInit();
    try {
      final expiry =
          DateTime.now().add(ttl).millisecondsSinceEpoch;
      final raw = jsonEncode({'value': value, 'expiry': expiry});
      await _p.setString('$_prefix$key', raw);
    } catch (e) {
      if (kDebugMode) debugPrint('[CacheService] set($key) failed: $e');
    }
  }

  /// Invalidate a single key.
  Future<void> invalidate(String key) async {
    await _ensureInit();
    await _p.remove('$_prefix$key');
  }

  /// Invalidate all cache entries (respects the prefix — won't touch other prefs).
  Future<void> invalidateAll() async {
    await _ensureInit();
    final keys = _p.getKeys().where((k) => k.startsWith(_prefix)).toList();
    for (final k in keys) {
      await _p.remove(k);
    }
  }

  // ---------------------------------------------------------------------------

  Future<void> _ensureInit() async {
    if (_prefs == null) await init();
  }
}

// ---------------------------------------------------------------------------
// Well-known cache keys
// ---------------------------------------------------------------------------

class CacheKeys {
  const CacheKeys._();

  static const dashboardStats      = 'dashboard_stats';
  static const notificationCount   = 'notification_count';
  static const travelRequests      = 'travel_requests';
  static const leaveRequests       = 'leave_requests';
  static const imprestRequests     = 'imprest_requests';
  static const approvalsPending    = 'approvals_pending';
  static const procurementRequests = 'procurement_requests';
  static const userProfile         = 'user_profile';
}
