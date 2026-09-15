<?php

namespace App\Modules\Documents\Services;

use App\Models\PurchaseOrder;
use App\Models\SignatureEvent;
use App\Models\TenantSetting;
use App\Models\User;
use App\Support\FrontendUrl;
use Illuminate\Support\Facades\Storage;

final class PurchaseOrderDocumentContext
{
    /**
     * @return array<string, mixed>
     */
    public function build(PurchaseOrder $po, string $mode = 'real', ?string $verifyUrl = null, ?string $qrDataUri = null): array
    {
        $po->loadMissing([
            'vendor', 'items', 'procurementRequest.requester', 'project',
            'createdBy', 'approvalRequest.history.user', 'approvalRequest.workflow.steps',
        ]);

        $letterhead = TenantSetting::getLetterheadSettings((int) $po->tenant_id);
        $stamps = $this->signatureStamps($po);
        $requester = $po->procurementRequest?->requester ?? $po->createdBy;

        return [
            'mode' => $mode,
            'org' => [
                'name' => $letterhead['org_name'] ?? 'SADC Parliamentary Forum',
                'abbreviation' => $letterhead['org_abbreviation'] ?? 'SADC-PF',
                'address' => trim(implode("\n", array_filter([
                    $letterhead['org_address'] ?? null,
                    isset($letterhead['letterhead_phone']) ? 'Tel: '.$letterhead['letterhead_phone'] : null,
                    $letterhead['letterhead_website'] ?? null,
                ]))),
                'phone' => $letterhead['letterhead_phone'] ?? '',
                'email' => $letterhead['letterhead_email'] ?? '',
                'website' => $letterhead['letterhead_website'] ?? '',
                'tagline' => $letterhead['letterhead_tagline'] ?? '',
                'logo' => $this->logoDataUri($letterhead),
            ],
            'po' => [
                'reference' => $po->lpo_number ?: $po->reference_number,
                'issue_date' => optional($po->lpo_date)->format('Y/m/d') ?: now()->format('Y/m/d'),
                'currency' => $po->currency ?: 'NAD',
                'subtotal' => $this->money($po->subtotal ?? $po->total_amount, $po->currency),
                'vat' => $po->vat_identified ? $this->money($po->tax_amount, $po->currency) : 'Not identified — verify',
                'discount' => $this->money($po->discount_amount ?? 0, $po->currency),
                'other_charges' => $this->money(0, $po->currency),
                'total' => $this->money($po->total_amount, $po->currency),
                'amount_in_words' => $this->amountInWords((float) $po->total_amount, (string) $po->currency),
                'notes' => (string) $po->description,
                'terms' => (string) $po->payment_terms,
                'delivery_address' => (string) $po->delivery_address,
                'delivery_date' => optional($po->expected_delivery_date)?->format('Y/m/d') ?? '',
                'generated_at' => now()->toDateTimeString(),
                'page_number' => '',
            ],
            'supplier' => [
                'name' => $po->vendor?->name ?? '',
                'address' => $po->vendor?->address ?? '',
                'phone' => $po->vendor?->contact_phone ?? '',
                'email' => $po->vendor?->contact_email ?? '',
                'contact' => $po->vendor?->contact_name ?? '',
            ],
            'project' => [
                'name' => $po->project?->name ?? $po->procurementRequest?->programme?->title ?? '',
                'code' => $po->project?->code ?? '',
            ],
            'programme' => ['name' => $po->procurementRequest?->programme?->title ?? ''],
            'funding' => ['source' => $po->project?->funding_source ?? ''],
            'budget' => ['code' => $po->items->pluck('account_code')->filter()->unique()->implode(', ')],
            'cost_centre' => $po->project?->cost_centre ?? '',
            'requisition' => ['reference' => $po->procurementRequest?->reference_number ?? ''],
            'procurement' => ['reference' => $po->procurementRequest?->reference_number ?? ''],
            'requester' => [
                'name' => $requester?->name ?? '',
                'position' => $requester?->job_title ?? '',
                'signature' => $stamps[(int) ($requester?->id ?? 0)] ?? null,
                'signed_at' => optional($po->submitted_at)?->format('Y/m/d') ?? '',
            ],
            'items' => $po->items->values()->map(fn ($item, $i) => [
                'line_no' => $i + 1,
                'item_code' => (string) ($item->item_code ?? ''),
                'description' => (string) $item->description,
                'qty' => rtrim(rtrim(number_format((float) $item->quantity, 3, '.', ''), '0'), '.') ?: '0',
                'unit' => (string) $item->unit,
                'unit_price' => $this->money($item->unit_price, $po->currency),
                'discount' => '',
                'vat_percent' => '',
                'vat' => '',
                'line_total' => $this->money($item->total_price, $po->currency),
                'budget_code' => (string) ($item->account_code ?? ''),
            ])->all(),
            'approvals' => $this->approvals($po, $stamps, $requester),
            'verify_url' => $verifyUrl ?? FrontendUrl::to('/verify/po/preview'),
            'qr' => $qrDataUri,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function sample(): array
    {
        $po = new PurchaseOrder([
            'reference_number' => 'S 04015',
            'lpo_number' => 'S 04015',
            'lpo_date' => '2026-08-03',
            'currency' => 'NAD',
            'subtotal' => 4499.69,
            'tax_amount' => 0,
            'vat_identified' => false,
            'total_amount' => 4499.69,
            'payment_terms' => 'net_30',
            'delivery_address' => 'SADC Forum House, Windhoek',
            'description' => 'Sample preview — not a live allocation.',
        ]);
        $po->setRelation('vendor', new \App\Models\Vendor([
            'name' => 'JVJ Plumbing Services',
            'address' => 'Windhoek',
            'contact_phone' => '0814731483',
        ]));
        $po->setRelation('project', new \App\Models\ProcurementProject(['name' => 'Forum', 'code' => 'FORUM']));
        $po->setRelation('items', collect([
            new \App\Models\PurchaseOrderItem(['description' => 'Call out', 'quantity' => 1, 'unit_price' => 350, 'total_price' => 350, 'unit' => 'unit']),
            new \App\Models\PurchaseOrderItem(['description' => 'Labour', 'quantity' => 1, 'unit_price' => 1300, 'total_price' => 1300, 'unit' => 'unit']),
            new \App\Models\PurchaseOrderItem(['description' => 'Toilet Pot seat cover', 'quantity' => 1, 'unit_price' => 423.80, 'total_price' => 423.80, 'unit' => 'unit']),
            new \App\Models\PurchaseOrderItem(['description' => 'Toilet Pot pen Corller', 'quantity' => 1, 'unit_price' => 325.89, 'total_price' => 325.89, 'unit' => 'unit']),
            new \App\Models\PurchaseOrderItem(['description' => 'Unblocking drain', 'quantity' => 6, 'unit_price' => 350, 'total_price' => 2100, 'unit' => 'unit']),
        ]));
        $po->setRelation('procurementRequest', new \App\Models\ProcurementRequest(['reference_number' => 'PRQ-SAMPLE']));
        $po->tenant_id = 0;

        $ctx = $this->build($po, 'sample');
        $ctx['org']['name'] = 'SADC Parliamentary Forum';
        $ctx['approvals'] = [
            ['label' => 'REQUESTED BY', 'name' => 'Sample Requester', 'position' => 'ICT Officer', 'signed_at' => '2026/08/03', 'pending' => false, 'signature' => null],
            ['label' => 'AUTHORISED BY', 'name' => 'Pending Approval', 'position' => '', 'signed_at' => '', 'pending' => true, 'signature' => null],
        ];

        return $ctx;
    }

    /**
     * @param  array<string, mixed>  $context
     */
    public function resolve(array $context, string $binding): mixed
    {
        $parts = explode('.', $binding);
        $cursor = $context;
        foreach ($parts as $part) {
            if (is_array($cursor) && array_key_exists($part, $cursor)) {
                $cursor = $cursor[$part];
            } else {
                return '';
            }
        }

        return $cursor;
    }

    /**
     * @return array<int, string>
     */
    public function signatureStamps(PurchaseOrder $po): array
    {
        if (! $po->exists) {
            return [];
        }
        $events = SignatureEvent::query()
            ->where('signable_type', $po->getMorphClass())
            ->where('signable_id', $po->id)
            ->whereNotNull('signature_version_id')
            ->where(function ($q) {
                $q->whereNull('auth_level')->orWhere('auth_level', '!=', 'email_token');
            })
            ->with('signatureVersion')
            ->orderBy('signed_at')
            ->get();

        $stamps = [];
        foreach ($events as $event) {
            $version = $event->signatureVersion;
            if ($version === null || ! $version->file_path) {
                continue;
            }
            if (! Storage::disk('local')->exists($version->file_path)) {
                continue;
            }
            $bytes = Storage::disk('local')->get($version->file_path);
            $mime = Storage::disk('local')->mimeType($version->file_path) ?: 'image/png';
            $stamps[(int) $event->signer_user_id] = 'data:'.$mime.';base64,'.base64_encode($bytes);
        }

        return $stamps;
    }

    /**
     * @param  array<int, string>  $stamps
     * @return list<array<string, mixed>>
     */
    private function approvals(PurchaseOrder $po, array $stamps, ?User $requester): array
    {
        $slots = [[
            'label' => 'REQUESTED BY',
            'name' => $requester?->name ?? '',
            'position' => $requester?->job_title ?? '',
            'signed_at' => optional($po->submitted_at)?->format('Y/m/d') ?? '',
            'pending' => $po->submitted_at === null,
            'signature' => $stamps[(int) ($requester?->id ?? 0)] ?? null,
        ]];

        $request = $po->approvalRequest;
        $steps = $request?->workflow?->steps ?? collect();
        $history = $request?->history ?? collect();
        foreach ($steps as $step) {
            $hist = $history->first(fn ($h) => (int) $h->step_index === (int) $step->step_order && $h->action === 'approve');
            $user = $hist?->user;
            $slots[] = [
                'label' => strtoupper((string) ($step->step_name ?: 'AUTHORISED BY')),
                'name' => $user?->name ?? '',
                'position' => $user?->job_title ?? '',
                'signed_at' => optional($hist?->created_at)?->format('Y/m/d') ?? '',
                'pending' => $hist === null,
                'signature' => $user ? ($stamps[(int) $user->id] ?? null) : null,
            ];
        }
        if ($steps->isEmpty() && $history->isNotEmpty()) {
            foreach ($history->where('action', 'approve') as $hist) {
                $slots[] = [
                    'label' => strtoupper((string) ($hist->stage_type ?: 'AUTHORISED BY')),
                    'name' => $hist->user?->name ?? '',
                    'position' => $hist->user?->job_title ?? '',
                    'signed_at' => optional($hist->created_at)?->format('Y/m/d') ?? '',
                    'pending' => false,
                    'signature' => $stamps[(int) $hist->user_id] ?? null,
                ];
            }
        }

        return $slots;
    }

    /**
     * @param  array<string, mixed>  $letterhead
     */
    private function logoDataUri(array $letterhead): ?string
    {
        $candidates = [
            base_path('../web/public/sadcpf-logo.png'),
            base_path('../web/public/sadcpf-logo.jpg'),
            public_path('sadcpf-logo.png'),
        ];
        foreach ($candidates as $path) {
            if (is_string($path) && is_file($path)) {
                $mime = str_ends_with(strtolower($path), '.jpg') ? 'image/jpeg' : 'image/png';

                return 'data:'.$mime.';base64,'.base64_encode((string) file_get_contents($path));
            }
        }

        return null;
    }

    public function money(mixed $value, ?string $currency): string
    {
        $amount = number_format((float) $value, 2);
        $code = $currency ?: 'NAD';

        return $code === 'NAD' ? 'N$ '.$amount : $code.' '.$amount;
    }

    public function amountInWords(float $amount, string $currency): string
    {
        $major = (int) floor($amount + 0.00001);
        $cents = (int) round(($amount - $major) * 100);
        $unit = $currency === 'NAD' ? 'Namibia dollars' : $currency;

        return $this->intToWords($major).' '.$unit.' and '.str_pad((string) $cents, 2, '0', STR_PAD_LEFT).'/100';
    }

    private function intToWords(int $n): string
    {
        if ($n === 0) {
            return 'Zero';
        }
        $below = [
            '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
            'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
        ];
        $tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
        $words = '';
        if ($n >= 1_000_000) {
            $words .= $this->intToWords(intdiv($n, 1_000_000)).' million ';
            $n %= 1_000_000;
        }
        if ($n >= 1000) {
            $words .= $this->intToWords(intdiv($n, 1000)).' thousand ';
            $n %= 1000;
        }
        if ($n >= 100) {
            $words .= $below[intdiv($n, 100)].' hundred ';
            $n %= 100;
        }
        if ($n >= 20) {
            $words .= $tens[intdiv($n, 10)];
            $n %= 10;
            if ($n > 0) {
                $words .= '-'.$below[$n];
            }
        } elseif ($n > 0) {
            $words .= $below[$n];
        }

        return ucfirst(trim($words));
    }
}
