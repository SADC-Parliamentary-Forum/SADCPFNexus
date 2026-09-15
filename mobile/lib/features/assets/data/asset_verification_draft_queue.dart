import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class AssetVerificationDraft {
  AssetVerificationDraft({
    required this.clientLineKey,
    required this.campaignId,
    required this.assetId,
    required this.result,
    required this.queuedAt,
    this.token,
  });

  final String clientLineKey;
  final int campaignId;
  final int assetId;
  final String result;
  final String queuedAt;
  final String? token;

  Map<String, dynamic> toJson() => {
        'client_line_key': clientLineKey,
        'campaign_id': campaignId,
        'asset_id': assetId,
        'result': result,
        'queued_at': queuedAt,
        'token': token,
      };

  static AssetVerificationDraft fromJson(Map<String, dynamic> json) =>
      AssetVerificationDraft(
        clientLineKey: json['client_line_key']?.toString() ?? '',
        campaignId: (json['campaign_id'] as num?)?.toInt() ?? 0,
        assetId: (json['asset_id'] as num?)?.toInt() ?? 0,
        result: json['result']?.toString() ?? 'verified',
        queuedAt: json['queued_at']?.toString() ?? '',
        token: json['token']?.toString(),
      );
}

class AssetVerificationDraftQueue {
  static const key = 'sadcpf.assets.verification.offlineQueue';

  static Future<List<AssetVerificationDraft>> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(key);
    if (raw == null || raw.isEmpty) return [];
    final decoded = jsonDecode(raw);
    if (decoded is! List) return [];
    return decoded
        .whereType<Map>()
        .map((e) => AssetVerificationDraft.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  static Future<void> enqueue(AssetVerificationDraft line) async {
    final current = await load();
    current.add(line);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      key,
      jsonEncode(current.map((e) => e.toJson()).toList()),
    );
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(key);
  }
}
