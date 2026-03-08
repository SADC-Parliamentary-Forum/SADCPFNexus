import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

/// Stitch-aligned primary button (filled).
class StitchPrimaryButton extends StatelessWidget {
  const StitchPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.minHeight = 52,
    this.isLoading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final double minHeight;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    return SizedBox(
      width: double.infinity,
      height: minHeight,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: c.primary,
          foregroundColor: c.onPrimary,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(kStitchRoundness),
          ),
        ),
        child: isLoading
            ? SizedBox(
                height: 24,
                width: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(c.onPrimary),
                ),
              )
            : (icon != null
                ? Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(icon, size: 20),
                      const SizedBox(width: kStitchSpace8),
                      Text(
                        label,
                        style: textTheme.labelLarge?.copyWith(
                          color: c.onPrimary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  )
                : Text(
                    label,
                    style: textTheme.labelLarge?.copyWith(
                      color: c.onPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  )),
      ),
    );
  }
}

/// Stitch-aligned secondary/outlined button.
class StitchOutlinedButton extends StatelessWidget {
  const StitchOutlinedButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.minHeight = 52,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final double minHeight;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    return SizedBox(
      width: double.infinity,
      height: minHeight,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: c.primary,
          side: BorderSide(color: c.outline),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(kStitchRoundness),
          ),
        ),
        child: icon != null
            ? Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, size: 20, color: c.primary),
                  const SizedBox(width: kStitchSpace8),
                  Text(
                    label,
                    style: textTheme.labelLarge?.copyWith(
                      color: c.primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              )
            : Text(
                label,
                style: textTheme.labelLarge?.copyWith(
                  color: c.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
      ),
    );
  }
}

/// Stitch-aligned text button.
class StitchTextButton extends StatelessWidget {
  const StitchTextButton({
    super.key,
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        foregroundColor: c.primary,
      ),
      child: Text(
        label,
        style: textTheme.labelLarge?.copyWith(
          color: c.primary,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
