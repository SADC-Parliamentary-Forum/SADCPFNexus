<?php

namespace App\Modules\Contracts\Services;

use App\Models\Contract;
use App\Models\Invoice;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Schema;

/**
 * Contract Pack (PRD §90) — a single indexed record enumerating the full
 * procurement-to-close-out trail for a contract, for donor/audit review.
 */
class ContractPackService
{
    /**
     * Build the structured index of everything attached to the contract.
     *
     * @return array<int, array{section: string, items: list<array<string,mixed>>}>
     */
    public function index(Contract $contract): array
    {
        $contract->loadMissing([
            'procurementRequest', 'programme', 'type', 'documentVersions', 'amendments',
            'deliverables', 'paymentSchedules', 'suspensions', 'terminations', 'extensions', 'renewals',
        ]);

        $invoices = Schema::hasColumn('invoices', 'contract_id')
            ? Invoice::where('tenant_id', $contract->tenant_id)->where('contract_id', $contract->id)->get()
            : collect();

        $doc = fn (string $kind) => $contract->documentVersions->firstWhere('kind', $kind);
        $approved = $doc('approved');
        $executed = $doc('executed');

        return [
            ['section' => 'Origin & procurement', 'items' => array_values(array_filter([
                $contract->procurementRequest ? ['label' => 'Procurement request', 'reference' => $contract->procurementRequest->reference_number] : null,
                $contract->programme ? ['label' => 'PIF / programme', 'reference' => $contract->programme->reference_number] : null,
                $contract->award_reference ? ['label' => 'Award reference', 'reference' => $contract->award_reference] : null,
                $contract->tor_reference ? ['label' => 'TOR / SOW', 'reference' => $contract->tor_reference] : null,
                $contract->origin_type ? ['label' => 'Origin', 'reference' => $contract->origin_type] : null,
            ]))],
            ['section' => 'Contract documents', 'items' => array_values(array_filter([
                $approved !== null ? ['label' => 'Approved (signature) version', 'reference' => 'v'.$approved->version, 'hash' => $approved->hash] : null,
                $executed !== null ? ['label' => 'Executed contract', 'reference' => 'v'.$executed->version, 'hash' => $executed->hash] : null,
                ['label' => 'Document versions on file', 'reference' => (string) $contract->documentVersions->count()],
            ]))],
            ['section' => 'Amendments, extensions & renewals', 'items' => array_merge(
                $contract->amendments->map(fn ($a) => ['label' => 'Amendment '.$a->reference_number, 'reference' => $a->status, 'revised_value' => $a->revised_value])->all(),
                $contract->extensions->map(fn ($e) => ['label' => 'Extension', 'reference' => $e->status, 'to' => optional($e->proposed_end_date)->toDateString()])->all(),
                $contract->renewals->map(fn ($r) => ['label' => 'Renewal #'.$r->renewal_number, 'reference' => $r->status])->all(),
            )],
            ['section' => 'Deliverables & acceptance', 'items' => $contract->deliverables->map(fn ($d) => [
                'label' => $d->name, 'reference' => $d->status, 'accepted_at' => optional($d->accepted_at)->toDateString(),
            ])->all()],
            ['section' => 'Payments & invoices', 'items' => array_merge(
                $contract->paymentSchedules->map(fn ($p) => ['label' => 'Milestone: '.$p->name, 'reference' => $p->status, 'amount' => $p->amount])->all(),
                $invoices->map(fn ($i) => ['label' => 'Invoice '.$i->reference_number, 'reference' => $i->status ?? 'n/a'])->all(),
            )],
            ['section' => 'Lifecycle', 'items' => array_merge(
                $contract->suspensions->map(fn ($s) => ['label' => 'Suspension', 'reference' => $s->status])->all(),
                $contract->terminations->map(fn ($t) => ['label' => 'Termination ('.$t->type.')', 'reference' => optional($t->effective_date)->toDateString()])->all(),
                [['label' => 'Close-out', 'reference' => $contract->closed_at ? 'Closed '.$contract->closed_at->toDateString() : 'Not closed']],
            )],
        ];
    }

    public function renderPdf(Contract $contract): \Barryvdh\DomPDF\PDF
    {
        $index = $this->index($contract);
        $html = "<h1>Contract Pack</h1><h2>{$contract->reference_number} — ".e((string) $contract->title).'</h2>';
        $html .= '<p>Counterparty: '.e((string) $contract->display_counterparty).' · Value: '.e((string) $contract->currency).' '.number_format((float) $contract->current_value, 2).' · Status: '.e((string) $contract->contract_status).'</p>';
        $html .= '<p style="font-size:10px;color:#666">Generated '.now()->toDayDateTimeString().' by SADC PF Nexus. This pack indexes the authoritative records for audit/donor review.</p>';

        foreach ($index as $block) {
            $html .= '<h3>'.e($block['section']).'</h3>';
            if ($block['items'] === []) {
                $html .= '<p style="color:#999;font-size:11px">None.</p>';

                continue;
            }
            $html .= '<table border="1" cellspacing="0" cellpadding="4" style="width:100%;border-collapse:collapse;font-size:11px"><tbody>';
            foreach ($block['items'] as $item) {
                $label = (string) ($item['label'] ?? '');
                unset($item['label']);
                $detail = collect($item)->filter(fn ($v) => $v !== null && $v !== '')
                    ->map(fn ($v, $k) => e($k).': '.e((string) $v))->implode(' · ');
                $html .= '<tr><td style="width:45%"><strong>'.e($label).'</strong></td><td>'.$detail.'</td></tr>';
            }
            $html .= '</tbody></table>';
        }

        return Pdf::loadHTML("<html><head><meta charset='utf-8'><style>body{font-family:DejaVu Sans,sans-serif}</style></head><body>{$html}</body></html>")
            ->setPaper('a4', 'portrait');
    }
}
