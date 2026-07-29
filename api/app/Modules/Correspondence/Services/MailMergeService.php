<?php

namespace App\Modules\Correspondence\Services;

use App\Models\CorrespondenceLetterTemplate;
use Illuminate\Validation\ValidationException;

class MailMergeService
{
    public function merge(string $template, array $fields): string
    {
        return preg_replace_callback('/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/', function ($m) use ($fields) {
            $key = $m[1];
            if (! array_key_exists($key, $fields)) {
                return $m[0];
            }

            return (string) $fields[$key];
        }, $template) ?? $template;
    }

    public function preview(CorrespondenceLetterTemplate $template, array $fields): array
    {
        $subject = $this->merge($template->subject_template, $fields);
        $body = $this->merge($template->body_template, $fields);

        if (str_contains($subject, '{{') || str_contains($body, '{{')) {
            throw ValidationException::withMessages([
                'fields' => 'One or more template placeholders are missing values.',
            ]);
        }

        return [
            'template_id' => $template->id,
            'subject' => $subject,
            'body' => $body,
            'title' => $subject,
        ];
    }
}
