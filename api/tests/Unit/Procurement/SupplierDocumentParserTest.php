<?php

namespace Tests\Unit\Procurement;

use App\Modules\Procurement\Support\ArithmeticValidator;
use App\Modules\Procurement\Support\DocumentTextExtractor;
use App\Modules\Procurement\Support\SupplierDocumentParser;
use App\Support\Money;
use Tests\Support\InvoicePdfFixture;
use Tests\TestCase;

class SupplierDocumentParserTest extends TestCase
{
    public function test_parses_jvj_invoice_text(): void
    {
        $parsed = (new SupplierDocumentParser())->parse(InvoicePdfFixture::inv0001Text());

        $this->assertSame('invoice', $parsed['document_type']);
        $this->assertGreaterThanOrEqual(80, $parsed['classification_confidence']);
        $this->assertSame('INV0001', $parsed['fields']['document_number']);
        $this->assertSame('2026-05-27', $parsed['fields']['document_date']);
        $this->assertStringContainsStringIgnoringCase('JVJ', (string) $parsed['fields']['supplier_name']);
        $this->assertCount(5, $parsed['lines']);
        $this->assertTrue(Money::equals('4499.69', $parsed['fields']['subtotal']));
        $this->assertTrue(Money::equals('4499.69', $parsed['fields']['grand_total']));
        $this->assertFalse($parsed['fields']['vat_identified']);
        $descriptions = array_column($parsed['lines'], 'source_description');
        $this->assertTrue(collect($descriptions)->contains(fn ($d) => str_contains(strtolower($d), 'call out')));
        $this->assertTrue(collect($descriptions)->contains(fn ($d) => str_contains(strtolower($d), 'labour')));
        $this->assertTrue(collect($descriptions)->contains(fn ($d) => str_contains(strtolower($d), 'pen corller')));
    }

    public function test_extracts_text_from_pdf_tj_operators(): void
    {
        $text = (new DocumentTextExtractor())->fromPdf(InvoicePdfFixture::inv0001Pdf());
        $this->assertStringContainsString('INV0001', $text);
        $this->assertStringContainsString('JVJ Plumbing', $text);
    }

    public function test_image_ocr_is_explicitly_unconfigured(): void
    {
        $result = (new DocumentTextExtractor())->extract('not-an-image', 'image/jpeg', 'scan.jpg');
        $this->assertFalse($result['ocr_available']);
        $this->assertSame('ocr_unconfigured', $result['method']);
    }

    public function test_arithmetic_accepts_jvj_totals(): void
    {
        $lines = (new SupplierDocumentParser())->parse(InvoicePdfFixture::inv0001Text())['lines'];
        $result = (new ArithmeticValidator())->validate($lines, '4499.69', null, null, '4499.69');
        $this->assertTrue($result['ok'], implode(' ', $result['issues']));
    }

    public function test_money_uses_cents(): void
    {
        $this->assertSame(449969, Money::toCents('4,499.69'));
        $this->assertSame('4499.69', Money::fromCents(449969));
        $this->assertTrue(Money::equals('1300.00', '1,300.00'));
    }
}
