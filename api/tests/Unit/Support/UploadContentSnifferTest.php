<?php

namespace Tests\Unit\Support;

use App\Support\UploadContentSniffer;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class UploadContentSnifferTest extends TestCase
{
    public function test_allows_plain_text_upload(): void
    {
        $file = UploadedFile::fake()->createWithContent('note.txt', 'hello world');
        $mime = UploadContentSniffer::assertAllowed($file, ['text/plain']);

        $this->assertSame('text/plain', $mime);
    }

    public function test_rejects_disallowed_mime(): void
    {
        $file = UploadedFile::fake()->createWithContent('payload.bin', "\x00\x01\x02\x03");

        $this->expectException(ValidationException::class);
        UploadContentSniffer::assertAllowed($file, ['application/pdf']);
    }
}
