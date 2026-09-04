<?php

namespace Tests\Support;

final class InvoicePdfFixture
{
    public static function inv0001Text(): string
    {
        return <<<TXT
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
}
