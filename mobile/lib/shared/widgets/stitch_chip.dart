import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

/// Stitch-aligned chip for filters or status. Uses theme colors and [kStitchRoundness].
class StitchChip extends StatelessWidget {
  const StitchChip({
    super.key,
    required this.label,
    this.selected = false,
    this.onTap,
    this.backgroundColor,
    this.foregroundColor,
  });

  final String label;
  final bool selected;
  final VoidCallback? onTap;
  final Color? backgroundColor;
  final Color? foregroundColor;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final bg = backgroundColor ?? (selected ? c.primary.withValues(alpha: 0.15) : c.surface);
    final fg = foregroundColor ?? (selected ? c.primary : c.onSurface);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(kStitchRoundness),
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: kStitchSpace12,
            vertical: kStitchSpace8,
          ),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(kStitchRoundness),
            border: Border.all(
              color: selected ? c.primary : c.outline,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Text(
            label,
            style: textTheme.labelMedium?.copyWith(
              color: fg,
              fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}
