<?php

namespace App\Modules\Assets\Support;

use Dompdf\FontMetrics;

/**
 * Picks the largest font size at which a label line fits its box, measured with
 * dompdf's own font metrics, so long names, serials and locations shrink and wrap
 * instead of being clipped.
 */
final class AssetLabelTextFit
{
    /** Matches the label view's CSS: [family, weight, base pt (null = template font), letter-spacing em, uppercase]. */
    public const STYLES = [
        'org' => ['DejaVu Sans', 'bold', 7.0, 0.04, true],
        'notice' => ['DejaVu Sans', 'normal', 6.0, 0.0, false],
        'tag' => ['DejaVu Sans Mono', 'bold', 11.0, 0.0, false],
        'name' => ['DejaVu Sans', 'normal', null, 0.0, false],
        'meta' => ['DejaVu Sans', 'normal', 6.5, 0.0, false],
    ];

    public const LINE_HEIGHT = 1.15;

    public const MIN_PT = 4.5;

    private const PT_PER_MM = 72 / 25.4;

    /** Measured widths run slightly under dompdf's rendered ones; keep a margin. */
    private const WIDTH_SAFETY = 0.96;

    public function __construct(private readonly FontMetrics $metrics) {}

    public function fontSize(string $class, string $text, float $wMm, float $hMm, float $namePt): float
    {
        [$family, $weight, $basePt, $spacingEm, $upper] = self::STYLES[$class] ?? self::STYLES['meta'];
        $basePt ??= $namePt;
        $text = $upper ? mb_strtoupper($text) : $text;
        $font = (string) $this->metrics->getFont($family, $weight);
        $maxW = $wMm * self::PT_PER_MM * self::WIDTH_SAFETY;
        $maxH = $hMm * self::PT_PER_MM;

        for ($pt = $basePt; $pt > self::MIN_PT; $pt -= 0.25) {
            $lines = $this->lineCount($text, $font, $pt, $spacingEm * $pt, $maxW);
            if ($lines !== null && $lines * $pt * self::LINE_HEIGHT <= $maxH) {
                return round($pt, 2);
            }
        }

        return self::MIN_PT;
    }

    /** Greedy word wrap, as dompdf does; null when a single word is wider than the box. */
    private function lineCount(string $text, string $font, float $pt, float $charSpacing, float $maxW): ?int
    {
        $space = $this->metrics->getTextWidth(' ', $font, $pt, 0, $charSpacing);
        $lines = 1;
        $lineW = 0.0;
        foreach (preg_split('/\s+/u', trim($text)) ?: [] as $word) {
            $w = $this->metrics->getTextWidth($word, $font, $pt, 0, $charSpacing);
            if ($w > $maxW) {
                return null;
            }
            if ($lineW > 0 && $lineW + $space + $w > $maxW) {
                $lines++;
                $lineW = $w;
            } else {
                $lineW += ($lineW > 0 ? $space : 0) + $w;
            }
        }

        return $lines;
    }
}
