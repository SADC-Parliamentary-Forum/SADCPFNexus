<?php

namespace Tests\Support;

/**
 * Minimal Word LPO that reproduces the live S 04015 JVJ document:
 * adjacent w:t runs (No. / S 04015 / 4,499.69) and a QTY table with dollars/cents columns.
 */
final class LpoDocxFixture
{
    public static function s04015Text(): string
    {
        return <<<TXT
PURCHASE ORDER No. S 04015
DATE: 2026/08/03
TO: JVJ Plumbing Services
Windhoek
Cell: 0814731483
PROJECT: Forum
QTY | DESCRIPTION | PRICE UNIT | TOTAL
 |  | N$ | c | N$ | C
 | SADC Forum House |  |  |  |
 | Blockage: Accessible Toilet |  |  |  |
1 | Call out |  |  | 350 | 00
1 | Labour |  |  | 1,300 | 00
1 | Toilet Pot seat cover |  |  | 423 | 80
1 | Toilet Pot pen Corller |  |  | 325 | 89
6 | Unblocking drain | 350 | 00 | 2,100 | 00
SUBTOTAL
Sub-total : N$ 4,499.69
VAT:
Total N$ 4,499.69
TXT;
    }

    public static function s04015Docx(): string
    {
        $document = <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:t>PURCHASE ORDER</w:t></w:r>
      <w:r><w:t xml:space="preserve"> </w:t></w:r>
      <w:r><w:t>N</w:t></w:r>
      <w:r><w:t>o.</w:t></w:r>
      <w:r><w:t xml:space="preserve"> </w:t></w:r>
      <w:r><w:t>S</w:t></w:r>
      <w:r><w:t xml:space="preserve"> </w:t></w:r>
      <w:r><w:t>0</w:t></w:r>
      <w:r><w:t>4015</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>DATE:</w:t></w:r>
      <w:r><w:t xml:space="preserve"> </w:t></w:r>
      <w:r><w:t>202</w:t></w:r>
      <w:r><w:t>6</w:t></w:r>
      <w:r><w:t>/</w:t></w:r>
      <w:r><w:t>0</w:t></w:r>
      <w:r><w:t>8/03</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>TO:</w:t></w:r>
      <w:r><w:t xml:space="preserve"> </w:t></w:r>
      <w:r><w:t>JVJ Plumbing Services</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t>Cell:</w:t></w:r><w:r><w:t xml:space="preserve"> </w:t></w:r><w:r><w:t>0814731483</w:t></w:r></w:p>
    <w:p><w:r><w:t>PROJECT:</w:t></w:r><w:r><w:t xml:space="preserve"> </w:t></w:r><w:r><w:t>Forum</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>QTY</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>DESCRIPTION</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>PRICE UNIT</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>TOTAL</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Call out</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>350</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>00</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Labour</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>1,300</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>00</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Toilet Pot seat cover</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>423</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>80</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Toilet Pot pen Corller</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>325</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>89</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>6</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Unblocking drain</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>350</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>00</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>2,100</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>00</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
    <w:p>
      <w:r><w:t>Sub-total</w:t></w:r>
      <w:r><w:t xml:space="preserve"> : N$ </w:t></w:r>
      <w:r><w:t>4,499.6</w:t></w:r>
      <w:r><w:t>9</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t>VAT:</w:t></w:r></w:p>
    <w:p>
      <w:r><w:t>Total</w:t></w:r>
      <w:r><w:t xml:space="preserve"> N$ </w:t></w:r>
      <w:r><w:t>4,499.6</w:t></w:r>
      <w:r><w:t>9</w:t></w:r>
    </w:p>
  </w:body>
</w:document>
XML;

        $contentTypes = <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
XML;
        $rels = <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
XML;

        $tmp = tempnam(sys_get_temp_dir(), 'lpo');
        $zip = new \ZipArchive();
        $zip->open($tmp, \ZipArchive::OVERWRITE);
        $zip->addFromString('[Content_Types].xml', $contentTypes);
        $zip->addFromString('_rels/.rels', $rels);
        $zip->addFromString('word/document.xml', $document);
        $zip->close();
        $binary = file_get_contents($tmp) ?: '';
        @unlink($tmp);

        return $binary;
    }
}
