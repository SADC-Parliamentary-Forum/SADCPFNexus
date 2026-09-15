<?php

namespace Tests\Unit\Documents;

use App\Modules\Documents\Services\DocumentNumberingService;
use App\Modules\Documents\Services\PurchaseOrderDocumentRenderer;
use App\Modules\Documents\Support\PurchaseOrderLayoutSanitizer;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class DocumentNumberingAndLayoutTest extends TestCase
{
    public function test_normalise_strips_spaces_and_case(): void
    {
        $svc = new DocumentNumberingService;
        $this->assertSame('S04015', $svc->normalize('S 04015'));
        $this->assertSame('S04015', $svc->normalize('s04015'));
        $this->assertSame('S04015', $svc->normalize('S-04015'));
    }

    public function test_pattern_formats_padded_sequence(): void
    {
        $svc = new DocumentNumberingService;
        $this->assertSame('S 04016', $svc->formatFromPattern('S {SEQ:5}', 4016));
        $this->assertSame('S04016', $svc->formatFromPattern('S{SEQ:5}', 4016));
    }

    public function test_parse_legacy_s04015_detects_next(): void
    {
        $svc = new DocumentNumberingService;
        $parsed = $svc->parseLegacyReference('S04015');
        $this->assertSame('S', $parsed['prefix']);
        $this->assertSame(4015, $parsed['sequence']);
        $pattern = $svc->patternFromParts($parsed['prefix'], ' ', 5);
        $this->assertSame('S 04016', $svc->formatFromPattern($pattern, $parsed['sequence'] + 1));
    }

    public function test_parse_legacy_with_space(): void
    {
        $svc = new DocumentNumberingService;
        $parsed = $svc->parseLegacyReference('S 04015');
        $this->assertSame('S', $parsed['prefix']);
        $this->assertSame(' ', $parsed['separator']);
        $this->assertSame(4015, $parsed['sequence']);
    }

    public function test_deferred_tokens_are_rejected(): void
    {
        $this->expectException(ValidationException::class);
        (new DocumentNumberingService)->assertPatternSupported('GIZ/{PROJECT}/{SEQ:3}');
    }

    public function test_layout_sanitizer_drops_unknown_types_and_bindings(): void
    {
        $clean = PurchaseOrderLayoutSanitizer::sanitize([
            'page' => ['size' => 'A4', 'orientation' => 'portrait', 'margin_mm' => ['top' => 12, 'right' => 12, 'bottom' => 12, 'left' => 12]],
            'elements' => [
                ['id' => 'ok', 'type' => 'field', 'binding' => 'po.reference', 'x_mm' => 10, 'y_mm' => 10, 'w_mm' => 40, 'h_mm' => 8],
                ['id' => 'bad-type', 'type' => 'iframe', 'x_mm' => 10, 'y_mm' => 10, 'w_mm' => 40, 'h_mm' => 8],
                ['id' => 'bad-bind', 'type' => 'field', 'binding' => 'users.password', 'x_mm' => 10, 'y_mm' => 10, 'w_mm' => 40, 'h_mm' => 8],
            ],
        ]);
        $this->assertCount(1, $clean['elements']);
        $this->assertSame('po.reference', $clean['elements'][0]['binding']);
    }

    public function test_cost_centre_binding_renders(): void
    {
        $html = app(PurchaseOrderDocumentRenderer::class)->toHtml(
            PurchaseOrderLayoutSanitizer::sanitize([
                'page' => ['size' => 'A4', 'orientation' => 'portrait', 'margin_mm' => ['top' => 12, 'right' => 12, 'bottom' => 12, 'left' => 12]],
                'elements' => [
                    ['type' => 'field', 'binding' => 'cost_centre', 'x_mm' => 12, 'y_mm' => 20, 'w_mm' => 40, 'h_mm' => 8],
                ],
            ]),
            [
                'po' => ['reference' => 'S 04016'],
                'cost_centre' => 'CC-FORUM',
            ],
            'real',
        );
        $this->assertStringContainsString('CC-FORUM', $html);
    }

    public function test_qr_title_uses_issued_verify_url_not_preview(): void
    {
        $html = app(PurchaseOrderDocumentRenderer::class)->toHtml(
            PurchaseOrderLayoutSanitizer::sanitize([
                'page' => ['size' => 'A4', 'orientation' => 'portrait', 'margin_mm' => ['top' => 12, 'right' => 12, 'bottom' => 12, 'left' => 12]],
                'elements' => [
                    ['type' => 'qr', 'x_mm' => 178, 'y_mm' => 268, 'w_mm' => 18, 'h_mm' => 18],
                ],
            ]),
            [
                'po' => ['reference' => 'S 04016'],
                'qr' => 'data:image/png;base64,AAAA',
                'verify_url' => 'https://portal.test/verify/po/issuedtokenabc',
            ],
            'real',
        );
        $this->assertStringContainsString('/verify/po/issuedtokenabc', $html);
        $this->assertStringNotContainsString('/verify/po/preview', $html);
    }

    public function test_continued_header_css_is_not_forced_on_first_page(): void
    {
        $html = app(PurchaseOrderDocumentRenderer::class)->toHtml(
            PurchaseOrderLayoutSanitizer::sanitize([
                'page' => ['size' => 'A4', 'orientation' => 'portrait', 'margin_mm' => ['top' => 12, 'right' => 12, 'bottom' => 12, 'left' => 12]],
                'elements' => [],
            ]),
            ['po' => ['reference' => 'S 04016']],
            'design',
        );
        $this->assertStringContainsString('.items thead tr.cont { display: none; }', $html);
        $this->assertStringContainsString('.items thead:not(:first-child) tr.cont { display: table-row; }', $html);
        $this->assertDoesNotMatchRegularExpression('/\.items thead tr\.cont \{ display: table-row; \}/', $html);
    }

    public function test_amount_in_words_includes_millions(): void
    {
        $words = app(\App\Modules\Documents\Services\PurchaseOrderDocumentContext::class)
            ->amountInWords(1_250_000, 'NAD');
        $this->assertStringContainsString('million', strtolower($words));
        $this->assertStringNotContainsString('thousand thousand', strtolower($words));
    }
}
