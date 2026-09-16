class AssetScanBasketItem {
  const AssetScanBasketItem({
    required this.id,
    required this.assetId,
    this.name,
    this.tagNumber,
    this.scanMethod,
  });

  final int id;
  final int assetId;
  final String? name;
  final String? tagNumber;
  final String? scanMethod;

  String get label {
    final tag = (tagNumber ?? '').trim();
    final title = (name ?? '').trim();
    if (tag.isNotEmpty && title.isNotEmpty) return '$tag — $title';
    if (tag.isNotEmpty) return tag;
    if (title.isNotEmpty) return title;
    return 'Asset $assetId';
  }

  static AssetScanBasketItem fromJson(Map<String, dynamic> json) => AssetScanBasketItem(
        id: (json['id'] as num?)?.toInt() ?? 0,
        assetId: (json['asset_id'] as num?)?.toInt() ?? 0,
        name: json['name']?.toString(),
        tagNumber: json['tag_number']?.toString(),
        scanMethod: json['scan_method']?.toString(),
      );
}

class AssetScanBasket {
  const AssetScanBasket({
    required this.id,
    required this.status,
    this.handoverId,
    this.items = const [],
  });

  final int id;
  final String status;
  final int? handoverId;
  final List<AssetScanBasketItem> items;

  bool get isOpen => status == 'open';

  static AssetScanBasket fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'];
    return AssetScanBasket(
      id: (json['id'] as num?)?.toInt() ?? 0,
      status: json['status']?.toString() ?? 'open',
      handoverId: (json['handover_id'] as num?)?.toInt(),
      items: rawItems is List
          ? rawItems
              .whereType<Map>()
              .map((row) => AssetScanBasketItem.fromJson(Map<String, dynamic>.from(row)))
              .toList()
          : const [],
    );
  }
}

class TenantUserOption {
  const TenantUserOption({required this.id, required this.name, this.email});

  final int id;
  final String name;
  final String? email;

  String get label {
    final mail = (email ?? '').trim();
    if (mail.isEmpty) return name;
    return '$name ($mail)';
  }

  static TenantUserOption? fromJson(Map<String, dynamic> json) {
    final rawId = json['id'];
    final id = rawId is int ? rawId : int.tryParse(rawId?.toString() ?? '');
    if (id == null) return null;
    final name = json['name']?.toString().trim() ?? '';
    if (name.isEmpty) return null;
    return TenantUserOption(
      id: id,
      name: name,
      email: json['email']?.toString(),
    );
  }
}
