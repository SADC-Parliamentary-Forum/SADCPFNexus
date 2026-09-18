<?php

namespace App\Modules\Contracts\Services;

use App\Models\Contract;
use App\Models\ContractTemplateVersion;
use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;

/**
 * Renders contract templates by substituting {{merge.fields}} from a contract
 * context, and enforces that mandatory variables are present before a document
 * may be generated (PRD §27).
 */
class ContractTemplateService
{
    /**
     * Build the merge-field context for a contract.
     *
     * @return array<string, string>
     */
    public function context(Contract $contract): array
    {
        $contract->loadMissing(['vendor', 'counterparty', 'type', 'contractOwner']);

        $counterpartyName = $contract->display_counterparty
            ?? optional($contract->counterparty)->full_legal_name
            ?? '';
        $counterparty = $contract->counterparty;

        $flat = [
            'contract.number' => (string) $contract->reference_number,
            'contract.title' => (string) $contract->title,
            'contract.type' => (string) optional($contract->type)->name,
            'contract.start_date' => optional($contract->start_date)->toFormattedDateString() ?? '',
            'contract.end_date' => optional($contract->end_date)->toFormattedDateString() ?? '',
            'counterparty.full_name' => (string) $counterpartyName,
            'counterparty.email' => (string) (optional($counterparty)->email ?? optional($contract->vendor)->contact_email ?? ''),
            'counterparty.phone' => (string) (optional($counterparty)->phone ?? ''),
            'counterparty.address' => (string) (optional($counterparty)->address ?? optional($contract->vendor)->address ?? ''),
            'activity.title' => (string) $contract->title,
            'activity.location' => (string) Arr::get((array) $contract->scope, 'location', ''),
            'financial.rate' => $contract->rate !== null ? number_format((float) $contract->rate, 2) : '',
            'financial.units' => $contract->units !== null ? (string) (float) $contract->units : '',
            'financial.total' => number_format((float) $contract->current_value, 2),
            'financial.currency' => (string) $contract->currency,
            'signatory.full_name' => '',
            'signatory.title' => '',
        ];

        return $flat;
    }

    /**
     * Return the list of {{tokens}} referenced by a template body.
     *
     * @return list<string>
     */
    public function tokensIn(string $body): array
    {
        preg_match_all('/\{\{\s*([a-z0-9_.]+)\s*\}\}/i', $body, $m);

        return array_values(array_unique($m[1] ?? []));
    }

    /**
     * Render a template version against a contract, substituting merge fields.
     * Throws a validation error listing any mandatory tokens that resolved empty.
     */
    public function render(ContractTemplateVersion $version, Contract $contract): string
    {
        $context = $this->context($contract);
        $body = (string) $version->body;

        // Mandatory variables: those declared required in the version metadata,
        // otherwise every token the body references.
        $declared = collect($version->variables ?? []);
        $required = $declared->isNotEmpty()
            ? $declared->filter(fn ($v) => ($v['required'] ?? true) === true)->pluck('key')->all()
            : $this->tokensIn($body);

        $missing = [];
        foreach ($required as $token) {
            if (trim((string) ($context[$token] ?? '')) === '') {
                $missing[] = $token;
            }
        }

        if ($missing !== []) {
            throw ValidationException::withMessages([
                'template' => ['Missing mandatory contract fields: '.implode(', ', $missing)],
            ]);
        }

        return preg_replace_callback('/\{\{\s*([a-z0-9_.]+)\s*\}\}/i', function (array $match) use ($context): string {
            return $context[$match[1]] ?? $match[0];
        }, $body);
    }
}
