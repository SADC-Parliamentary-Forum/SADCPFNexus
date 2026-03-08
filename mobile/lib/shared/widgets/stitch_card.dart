import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

/// Stitch-aligned card: theme surface, border, [kStitchCardRoundness].
/// Use for list items, content blocks, and forms.
class StitchCard extends StatelessWidget {
  const StitchCard({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.onTap,
  });

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final c = theme.colorScheme;
    final card = Container(
      padding: padding ?? const EdgeInsets.all(kStitchSpace16),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(kStitchCardRoundness),
        border: Border.all(color: c.outline, width: 1),
      ),
      child: child,
    );
    if (onTap != null) {
      return Padding(
        padding: margin ?? EdgeInsets.zero,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(kStitchCardRoundness),
            child: card,
          ),
        ),
      );
    }
    return Padding(
      padding: margin ?? EdgeInsets.zero,
      child: card,
    );
  }
}
