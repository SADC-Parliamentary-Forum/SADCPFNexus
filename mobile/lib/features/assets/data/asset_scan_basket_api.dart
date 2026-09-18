import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../procurement/data/procurement_api_helpers.dart';
import '../domain/asset_scan_basket.dart';

class AssetScanBasketApi {
  AssetScanBasketApi(this._dio);

  static const prefsKey = 'sadcpf.assets.scanBasketId';

  final Dio _dio;

  Future<AssetScanBasket> create() async {
    final res = await _dio.post<dynamic>('/assets/scan-baskets', data: <String, dynamic>{});
    final basket = AssetScanBasket.fromJson(extractObjectData(res.data) ?? {});
    await persistId(basket.id);
    return basket;
  }

  Future<AssetScanBasket> show(int id) async {
    final res = await _dio.get<dynamic>('/assets/scan-baskets/$id');
    return AssetScanBasket.fromJson(extractObjectData(res.data) ?? {});
  }

  Future<AssetScanBasket> addItem(int id, {String? token, String? nfcUid}) async {
    final res = await _dio.post<dynamic>(
      '/assets/scan-baskets/$id/items',
      data: {
        if (token != null && token.trim().isNotEmpty) 'token': token.trim(),
        if (nfcUid != null && nfcUid.trim().isNotEmpty) 'nfc_uid': nfcUid.trim(),
      },
    );
    return AssetScanBasket.fromJson(extractObjectData(res.data) ?? {});
  }

  Future<int> startHandover(int id, {required int toUserId}) async {
    final res = await _dio.post<dynamic>(
      '/assets/scan-baskets/$id/start-handover',
      data: {
        'type': 'issue',
        'custody_target_type': 'person',
        'to_user_id': toUserId,
      },
    );
    final data = extractObjectData(res.data) ?? {};
    await clearPersistedId();
    return (data['id'] as num?)?.toInt() ?? 0;
  }

  Future<List<TenantUserOption>> listUsers() async {
    final res = await _dio.get<dynamic>('/tenant-users');
    return extractListData(res.data).map(TenantUserOption.fromJson).whereType<TenantUserOption>().toList();
  }

  static Future<int?> loadPersistedId() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getInt(prefsKey);
    if (raw == null || raw <= 0) return null;
    return raw;
  }

  static Future<void> persistId(int id) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(prefsKey, id);
  }

  static Future<void> clearPersistedId() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(prefsKey);
  }
}
