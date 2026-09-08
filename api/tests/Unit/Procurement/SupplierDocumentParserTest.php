<?php

namespace Tests\Unit\Procurement;

use App\Modules\Procurement\Support\ArithmeticValidator;
use App\Modules\Procurement\Support\DocumentTextExtractor;
use App\Modules\Procurement\Support\SupplierDocumentParser;
use App\Support\Money;
use Tests\Support\InvoicePdfFixture;
use Tests\Support\LpoDocxFixture;
use Tests\TestCase;

class SupplierDocumentParserTest extends TestCase
{
    public function test_parses_jvj_invoice_text(): void
    {
        $parsed = (new SupplierDocumentParser)->parse(InvoicePdfFixture::inv0001Text());

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
        $text = (new DocumentTextExtractor)->fromPdf(InvoicePdfFixture::inv0001Pdf());
        $this->assertStringContainsString('INV0001', $text);
        $this->assertStringContainsString('JVJ Plumbing', $text);
    }

    public function test_image_ocr_is_explicitly_unconfigured(): void
    {
        $result = (new DocumentTextExtractor)->extract('not-an-image', 'image/jpeg', 'scan.jpg');
        $this->assertFalse($result['ocr_available']);
        $this->assertSame('ocr_unconfigured', $result['method']);
        $this->assertSame('', $result['text']);
        $this->assertStringContainsString('not configured', $result['message']);
        $this->assertStringContainsString('Upload remains the live intake path', $result['message']);
    }

    public function test_imap_mailbox_adapter_is_explicitly_unconfigured(): void
    {
        $imap = new \App\Modules\Procurement\Support\ImapUnconfiguredAdapter;
        $this->assertFalse($imap->isConfigured());
        $this->expectException(\Illuminate\Validation\ValidationException::class);
        $imap->poll();
    }

    public function test_arithmetic_accepts_jvj_totals(): void
    {
        $lines = (new SupplierDocumentParser)->parse(InvoicePdfFixture::inv0001Text())['lines'];
        $result = (new ArithmeticValidator)->validate($lines, '4499.69', null, null, '4499.69');
        $this->assertTrue($result['ok'], implode(' ', $result['issues']));
    }

    public function test_money_uses_cents(): void
    {
        $this->assertSame(449969, Money::toCents('4,499.69'));
        $this->assertSame('4499.69', Money::fromCents(449969));
        $this->assertTrue(Money::equals('1300.00', '1,300.00'));
        $this->assertSame(449969, Money::toCents('$4 499,69'));
        $this->assertSame(130000, Money::toCents('$1 300,00'));
        $this->assertSame(35000, Money::toCents('$350,00'));
    }

    public function test_parses_wave_invoice_nad_comma_decimals(): void
    {
        $parsed = (new SupplierDocumentParser)->parse(InvoicePdfFixture::inv0001LiveText());

        $this->assertSame('invoice', $parsed['document_type']);
        $this->assertSame('INV0001', $parsed['fields']['document_number']);
        $this->assertSame('2026-05-27', $parsed['fields']['document_date']);
        $this->assertStringContainsStringIgnoringCase('plumbing', (string) $parsed['fields']['supplier_name']);
        $this->assertCount(5, $parsed['lines']);
        $this->assertTrue(Money::equals('4499.69', $parsed['fields']['subtotal']));
        $this->assertTrue(Money::equals('4499.69', $parsed['fields']['grand_total']));
        $descriptions = array_column($parsed['lines'], 'source_description');
        $this->assertTrue(collect($descriptions)->contains(fn ($d) => str_contains(strtolower($d), 'call out')));
        $this->assertTrue(collect($descriptions)->contains(fn ($d) => str_contains(strtolower($d), 'unblocking')));
    }

    public function test_rendered_pdf_extracts_as_valid_utf8_without_dumping_binary(): void
    {
        $pdf = InvoicePdfFixture::renderedInvoicePdf();
        $result = (new DocumentTextExtractor)->extract($pdf, 'application/pdf', 'Invoice_INV0001.pdf');
        $this->assertTrue(mb_check_encoding($result['text'], 'UTF-8'));
        $this->assertNotFalse(json_encode(['text' => $result['text'], 'message' => $result['message'] ?? null]));
        $this->assertSame('pdf_no_text', $result['method']);
        $this->assertStringNotContainsString('%PDF-1.4', $result['text']);
        $this->assertStringContainsString('selectable text', (string) ($result['message'] ?? ''));
    }

    public function test_parses_official_lpo_s04015(): void
    {
        $parsed = (new SupplierDocumentParser())->parse(LpoDocxFixture::s04015Text());

        $this->assertSame('purchase_order', $parsed['document_type']);
        $this->assertGreaterThanOrEqual(80, $parsed['classification_confidence']);
        $this->assertFalse($parsed['needs_manual_classification']);
        $this->assertSame('S 04015', $parsed['fields']['document_number']);
        $this->assertSame('2026-08-03', $parsed['fields']['document_date']);
        $this->assertStringContainsStringIgnoringCase('JVJ Plumbing', (string) $parsed['fields']['supplier_name']);
        $this->assertSame('0814731483', $parsed['fields']['supplier_phone']);
        $this->assertCount(5, $parsed['lines']);
        $this->assertTrue(Money::equals('4499.69', $parsed['fields']['subtotal']));
        $this->assertTrue(Money::equals('4499.69', $parsed['fields']['grand_total']));
        $this->assertFalse($parsed['fields']['vat_identified']);
        $descriptions = array_column($parsed['lines'], 'source_description');
        $this->assertTrue(collect($descriptions)->contains(fn ($d) => str_contains(strtolower($d), 'call out')));
        $this->assertTrue(collect($descriptions)->contains(fn ($d) => str_contains(strtolower($d), 'unblocking')));
    }

    public function test_docx_extractor_joins_split_runs_and_table_rows(): void
    {
        $text = (new DocumentTextExtractor())->fromDocx(LpoDocxFixture::s04015Docx());
        $this->assertStringContainsString('PURCHASE ORDER', $text);
        $this->assertMatchesRegularExpression('/S\\s*0?\\s*4015/', preg_replace('/\\s+/', ' ', $text) ?? $text);
        $this->assertStringContainsString('Call out', $text);
        $this->assertStringContainsString('JVJ Plumbing Services', $text);
        $this->assertStringNotContainsString('N o.', $text);
        $this->assertStringNotContainsString('4,499.6 9', $text);
    }

    public function test_arithmetic_accepts_lpo_s04015_totals(): void
    {
        $parsed = (new SupplierDocumentParser())->parse(LpoDocxFixture::s04015Text());
        $result = (new ArithmeticValidator())->validate(
            $parsed['lines'],
            $parsed['fields']['subtotal'],
            $parsed['fields']['vat_amount'],
            $parsed['fields']['discount_amount'] ?? null,
            $parsed['fields']['grand_total'],
        );
        $this->assertTrue($result['ok'], implode(' ', $result['issues']));
    }
}
