/// Friendly date formatting for display. Converts API ISO strings
/// (e.g. 2027-03-31T00:00:00.000000Z) to readable formats.
class AppDateFormatter {
  static const _months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  /// Parse ISO or Y-m-d string to DateTime, or null.
  /// Handles: 2025-03-07, 2025-03-07T00:00:00.000000Z, 2025-03-07T14:30:00Z
  static DateTime? parse(String? value) {
    if (value == null || value.isEmpty) return null;
    try {
      final s = value.trim().split('T').first.split(' ').first;
      final parts = s.split('-');
      if (parts.length >= 3) {
        return DateTime(
          int.parse(parts[0]),
          int.parse(parts[1]),
          int.parse(parts[2]),
        );
      }
      return DateTime.tryParse(value);
    } catch (_) {
      return null;
    }
  }

  /// e.g. "31 Mar 2027"
  static String short(String? value) {
    final d = parse(value);
    if (d == null) return '—';
    return '${d.day} ${_months[d.month - 1]} ${d.year}';
  }

  /// e.g. "31 Mar 2027" for single day; "28 Mar – 31 Mar 2027" for range
  static String range(String? start, String? end) {
    final s = parse(start);
    final e = parse(end);
    if (s == null && e == null) return '—';
    if (s == null) return short(end);
    if (e == null) return short(start);
    if (s.year == e.year && s.month == e.month && s.day == e.day) {
      return short(start);
    }
    if (s.year == e.year && s.month == e.month) {
      return '${s.day} – ${e.day} ${_months[e.month - 1]} ${e.year}';
    }
    if (s.year == e.year) {
      return '${s.day} ${_months[s.month - 1]} – ${e.day} ${_months[e.month - 1]} ${e.year}';
    }
    return '${short(start)} – ${short(end)}';
  }

  /// Compact range for cards/tables: "7–14 Mar 2025" or "7 Mar – 14 Apr 2025"
  static String rangeCompact(String? start, String? end) {
    final s = parse(start);
    final e = parse(end);
    if (s == null && e == null) return '—';
    if (s == null) return short(end);
    if (e == null) return short(start);
    if (s.year == e.year && s.month == e.month && s.day == e.day) {
      return short(start);
    }
    if (s.year == e.year && s.month == e.month) {
      return '${s.day}–${e.day} ${_months[e.month - 1]} ${e.year}';
    }
    if (s.year == e.year) {
      return '${s.day} ${_months[s.month - 1]} – ${e.day} ${_months[e.month - 1]} ${e.year}';
    }
    return '${short(start)} – ${short(end)}';
  }

  /// e.g. "Mon, 31 Mar 2027"
  static String withWeekday(String? value) {
    final d = parse(value);
    if (d == null) return '—';
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    final w = days[d.weekday - 1];
    return '$w, ${d.day} ${_months[d.month - 1]} ${d.year}';
  }

  /// e.g. "Mar 2027" or "Feb 2026"
  static String monthYear(String? value) {
    final d = parse(value);
    if (d == null) return '—';
    return '${_months[d.month - 1]} ${d.year}';
  }
}
