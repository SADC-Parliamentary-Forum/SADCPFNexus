<?php

namespace Tests\Support;

final class InvoicePdfFixture
{
    public static function inv0001Text(): string
    {
        return <<<'TXT'
TAX INVOICE
Supplier: JVJ Plumbing Service
Phone: 0813649656
Invoice Number: INV0001
Invoice Date: 27/05/2026
Payment Terms: Due on receipt
Bill To: SADC Parliamentary Forum

Description Qty Rate Total
Call out 1 350.00 350.00
Labour 1 1,300.00 1,300.00
Toilet pot seat cover 1 423.80 423.80
Toilet pot pen corller 1 325.89 325.89
Unblocking of the drain 6 350.00 2,100.00

Subtotal: 4,499.69
Total: 4,499.69
TXT;
    }

    public static function inv0001Pdf(): string
    {
        $lines = explode("\n", self::inv0001Text());
        $ops = "BT /F1 11 Tf 40 780 Td\n";
        foreach ($lines as $i => $line) {
            $escaped = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $line);
            if ($i === 0) {
                $ops .= "({$escaped}) Tj\n";
            } else {
                $ops .= "0 -14 Td ({$escaped}) Tj\n";
            }
        }
        $ops .= "ET\n";
        $len = strlen($ops);

        return "%PDF-1.4\n".
            "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n".
            "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n".
            "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n".
            "4 0 obj<< /Length {$len} >>stream\n{$ops}endstream\nendobj\n".
            "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n".
            "xref\n0 6\n0000000000 65535 f \ntrailer<< /Size 6 /Root 1 0 R >>\nstartxref\n0\n%%EOF\n";
    }

    /**
     * Chromium/Skia-style invoice: compressed binary, no selectable Tj text.
     * Mirrors production Invoice_INV0001.pdf which is a rendered 2-page export.
     */
    public static function renderedInvoicePdf(): string
    {
        $payload = random_bytes(512)."\xFF\xFE%PDF".random_bytes(256);
        $compressed = gzcompress($payload) ?: $payload;

        return "%PDF-1.4\n".
            "%\xE2\xE3\xCF\xD3\n".
            "1 0 obj<< /Title (Template 1) /Creator (Chromium) /Producer (Skia/PDF m151) >>endobj\n".
            '2 0 obj<< /Filter /FlateDecode /Length '.strlen($compressed)." >>stream\n".
            $compressed.
            "\nendstream\nendobj\n".
            "trailer<< /Root 1 0 R >>\n%%EOF\n";
    }

    public static function inv0001LiveText(): string
    {
        return <<<'TXT'
INVOICE INV0001
j v j plumbing service
Markus shipyard street
erf 2678 Windhoek
P 0813649656
juliusjwremia36@gmail.com
SUBTOTAL 	$4 499,69
TOTAL 	$4 499,69
BALANCE DUE 	$4 499,69
DESCRIPTION 	RATE 	QTY 	TOTAL
call out 	$350,00 	1 	$350,00
lobour 	$1 300,00 	1 	$1 300,00
toilet pot seat cover 	$423,80 	1 	$423,80
toilet pot pen corller 	$325,89 	1 	$325,89
unblocking of the drain 	$350,00 	6 	$2 100,00
BILL TO
sadc parliamentary forum
INVOICE DATE 	27/05/2026
INVOICE DUE 	Due On Receipt
TXT;
    }
}
