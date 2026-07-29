import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// On-device stocktake draft queue (parity with web localStorage key).
class StocktakeDraftLine {
  StocktakeDraftLine({
    required this.clientLineKey,
    required this.barcode,
    required this.countedQty,
    required this.queuedAt,
    this.stockItemId,
    this.sku,
    this.name,
  });

  final String clientLineKey;
  final String barcode;
  final double countedQty;
  final String queuedAt;
  final int? stockItemId;
  final String? sku;
  final String? name;

  Map<String, dynamic> toJson() => {
        'client_line_key': clientLineKey,
        'barcode': barcode,
        'counted_qty': countedQty,
        'queued_at': queuedAt,
        'stock_item_id': stockItemId,
        'sku': sku,
        'name': name,
      };

  static StocktakeDraftLine fromJson(Map<String, dynamic> json) =>
      StocktakeDraftLine(
        clientLineKey: json['client_line_key']?.toString() ?? '',
        barcode: json['barcode']?.toString() ?? '',
        countedQty: (json['counted_qty'] as num?)?.toDouble() ?? 0,
        queuedAt: json['queued_at']?.toString() ?? '',
        stockItemId: json['stock_item_id'] as int?,
        sku: json['sku']?.toString(),
        name: json['name']?.toString(),
      );
}

class StocktakeDraftQueue {
  static const key = 'sadcpf.stocktake.offlineQueue';

  static Future<List<StocktakeDraftLine>> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(key);
    if (raw == null || raw.isEmpty) return [];
    final decoded = jsonDecode(raw);
    if (decoded is! List) return [];
    return decoded
        .whereType<Map>()
        .map((e) => StocktakeDraftLine.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  static Future<void> enqueue(StocktakeDraftLine line) async {
    final prefs = await SharedPreferences.getInstance();
    final current = await load();
    current.add(line);
    await prefs.setString(
        key, jsonEncode(current.map((e) => e.toJson()).toList()));
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(key);
  }
}
