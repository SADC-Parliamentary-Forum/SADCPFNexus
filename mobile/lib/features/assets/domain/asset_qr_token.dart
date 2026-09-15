String? parseAssetQrToken(String raw) {
  final value = raw.trim();
  if (value.isEmpty) return null;

  final fromPath = RegExp(r'/a/([A-Za-z0-9_-]+)').firstMatch(value);
  if (fromPath != null) {
    return fromPath.group(1);
  }

  final uri = Uri.tryParse(value);
  if (uri != null && uri.hasScheme) {
    final match = RegExp(r'/a/([A-Za-z0-9_-]+)').firstMatch(uri.path);
    if (match != null) {
      return match.group(1);
    }
  }

  if (RegExp(r'^[A-Za-z0-9_-]{16,}$').hasMatch(value)) {
    return value;
  }

  return null;
}
