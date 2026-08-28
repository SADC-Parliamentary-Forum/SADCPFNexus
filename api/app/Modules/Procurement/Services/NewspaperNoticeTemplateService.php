<?php

namespace App\Modules\Procurement\Services;

use App\Models\Tender;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Newspaper-notice templates and human publication checklists.
 * Never awards a supplier. Live LLM drafting remains CR-8.
 */
class NewspaperNoticeTemplateService
{
    public function templates(): array
    {
        return [
            'auto_award' => false,
            'requires_human_publication' => true,
            'llm_live' => filled(config('procurement.notice_llm_url')),
            'templates' => [
                [
                    'key' => 'open_tender',
                    'label' => 'Open tender newspaper notice',
                    'body' => "PUBLIC NOTICE — OPEN TENDER\n{organisation} invites sealed bids for {title} ({reference}).\nClosing date: {deadline}\n{notice}\nThis notice does not award a supplier. A human must place the advertisement and file proof of publication.",
                ],
                [
                    'key' => 'rfq',
                    'label' => 'RFQ public notice',
                    'body' => "PUBLIC NOTICE — REQUEST FOR QUOTATION\n{organisation} invites quotations for {title} ({reference}).\nClosing date: {deadline}\n{notice}\nQuotations are evaluated by humans. This template never auto-awards.",
                ],
                [
                    'key' => 'restricted',
                    'label' => 'Restricted invitation notice',
                    'body' => "RESTRICTED INVITATION TO TENDER\n{organisation} invites eligible suppliers for {title} ({reference}).\nClosing date: {deadline}\n{notice}\nRestricted circulation still requires a recorded publication checklist.",
                ],
            ],
        ];
    }

    public function packFor(Tender $tender, User $user, ?string $templateKey = null): array
    {
        $this->assertTenant($tender, $user);
        $templates = $this->templates();
        $key = $templateKey ?: ($tender->newspaper_checklist['template_key'] ?? 'open_tender');
        $template = collect($templates['templates'])->firstWhere('key', $key) ?? $templates['templates'][0];

        $filled = strtr($template['body'], [
            '{organisation}' => 'SADC Parliamentary Forum',
            '{title}' => (string) $tender->title,
            '{reference}' => (string) $tender->reference_number,
            '{deadline}' => optional($tender->submission_deadline)?->toDateString() ?? 'not stated',
            '{notice}' => trim((string) $tender->notice),
        ]);

        $ticks = (array) ($tender->newspaper_checklist['ticks'] ?? []);

        return [
            'tender_id' => $tender->id,
            'reference_number' => $tender->reference_number,
            'title' => $tender->title,
            'template_key' => $template['key'],
            'filled_notice' => $filled,
            'llm_suggestion' => $tender->newspaper_checklist['llm_suggestion'] ?? null,
            'llm_live' => filled(config('procurement.notice_llm_url')),
            'auto_award' => false,
            'checklist' => $this->checklist($tender, $ticks),
        ];
    }

    /**
     * Optional HTTP LLM draft into llm_suggestion. Never awards. Human ticks remain required.
     */
    public function draftWithLlm(Tender $tender, User $user, ?string $templateKey = null): array
    {
        $pack = $this->packFor($tender, $user, $templateKey);
        $url = trim((string) config('procurement.notice_llm_url', ''));
        if ($url === '') {
            $pack['llm_live'] = false;
            $pack['llm_error'] = 'PROCUREMENT_NOTICE_LLM_URL is not configured.';

            return $pack;
        }

        try {
            $req = \Illuminate\Support\Facades\Http::timeout(20)->acceptJson();
            $token = (string) config('procurement.notice_llm_token', '');
            if ($token !== '') {
                $req = $req->withToken($token);
            }
            $response = $req->post($url, [
                'template_key' => $pack['template_key'],
                'filled_notice' => $pack['filled_notice'],
                'title' => $tender->title,
                'reference' => $tender->reference_number,
            ]);
            $suggestion = (string) ($response->json('text') ?? $response->json('suggestion') ?? '');
            if ($response->successful() && $suggestion !== '') {
                $checklist = (array) ($tender->newspaper_checklist ?? []);
                $checklist['llm_suggestion'] = $suggestion;
                $checklist['llm_drafted_at'] = now()->toIso8601String();
                $checklist['llm_drafted_by'] = $user->id;
                $tender->newspaper_checklist = $checklist;
                $tender->save();
                $pack['llm_suggestion'] = $suggestion;
                $pack['llm_live'] = true;
            } else {
                $pack['llm_error'] = 'LLM draft unavailable (HTTP '.$response->status().').';
            }
        } catch (\Throwable $e) {
            $pack['llm_error'] = $e->getMessage();
        }

        $pack['auto_award'] = false;

        return $pack;
    }

    public function saveTicks(Tender $tender, User $user, array $data): array
    {
        $this->assertTenant($tender, $user);
        $key = (string) ($data['template_key'] ?? 'open_tender');
        $allowed = collect($this->templates()['templates'])->pluck('key')->all();
        if (! in_array($key, $allowed, true)) {
            throw ValidationException::withMessages(['template_key' => 'Unknown newspaper notice template.']);
        }

        $incoming = (array) ($data['ticks'] ?? []);
        $ticks = [];
        foreach (['bilingual_notice_considered', 'newspaper_named', 'proof_of_publication_filed'] as $manual) {
            $ticks[$manual] = (bool) ($incoming[$manual] ?? false);
        }

        $tender->newspaper_checklist = [
            'template_key' => $key,
            'ticks' => $ticks,
            'updated_by' => $user->id,
            'updated_at' => now()->toIso8601String(),
        ];
        $tender->save();

        return [
            'template_key' => $key,
            'ticks' => $ticks,
            'auto_award' => false,
            'tender_status' => $tender->status,
            'checklist' => $this->checklist($tender, $ticks),
        ];
    }

    private function checklist(Tender $tender, array $ticks): array
    {
        $items = [
            ['key' => 'notice_text_present', 'label' => 'Notice text is present', 'detected' => filled($tender->notice), 'manual' => false],
            ['key' => 'deadline_stated', 'label' => 'Submission deadline is stated', 'detected' => (bool) $tender->submission_deadline, 'manual' => false],
            ['key' => 'published_at_recorded', 'label' => 'Publication timestamp recorded', 'detected' => (bool) $tender->published_at, 'manual' => false],
            ['key' => 'sealed_mode_disclosed', 'label' => 'Sealed-bid mode disclosed', 'detected' => (bool) $tender->sealed_mode, 'manual' => false],
            ['key' => 'bilingual_notice_considered', 'label' => 'Bilingual (EN/PT/FR) notice considered', 'detected' => (bool) ($ticks['bilingual_notice_considered'] ?? false), 'manual' => true],
            ['key' => 'newspaper_named', 'label' => 'Newspaper / gazette named', 'detected' => (bool) ($ticks['newspaper_named'] ?? false), 'manual' => true],
            ['key' => 'proof_of_publication_filed', 'label' => 'Proof of publication filed', 'detected' => (bool) ($ticks['proof_of_publication_filed'] ?? false), 'manual' => true],
        ];

        foreach ($items as &$item) {
            $item['complete'] = (bool) $item['detected'];
        }

        return $items;
    }

    private function assertTenant(Tender $tender, User $user): void
    {
        abort_unless((int) $tender->tenant_id === (int) $user->tenant_id, 404);
    }
}
