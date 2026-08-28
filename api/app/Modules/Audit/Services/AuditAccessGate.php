<?php

namespace App\Modules\Audit\Services;

use App\Models\AuditEngagement;
use App\Models\AuditIndependenceDeclaration;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class AuditAccessGate
{
    public function assertCanFieldwork(AuditEngagement $engagement, User $user): void
    {
        if ($user->hasAnyRole(['System Admin', 'super-admin'])) {
            return;
        }

        $declaration = AuditIndependenceDeclaration::query()
            ->where('engagement_id', $engagement->id)
            ->where('user_id', $user->id)
            ->first();

        if (! $declaration || $declaration->status === 'pending' || $declaration->status === 'blocked') {
            throw ValidationException::withMessages([
                'independence' => 'Fieldwork access requires a cleared independence declaration (or formal recusal).',
            ]);
        }

        if ($declaration->status === 'recused') {
            throw ValidationException::withMessages([
                'independence' => 'You have recused from this engagement and cannot perform fieldwork.',
            ]);
        }
    }

    public function canViewConfidential(User $user): bool
    {
        return $user->can('audit.confidential.view')
            || $user->can('audit.admin')
            || $user->hasAnyRole(['System Admin', 'super-admin', 'Internal Auditor', 'Secretary General']);
    }

    public function redactIfNeeded(array $row, User $user, string $levelKey = 'confidentiality_level'): array
    {
        $level = $row[$levelKey] ?? 'standard';
        if (in_array($level, ['confidential', 'secret'], true) && ! $this->canViewConfidential($user)) {
            return [
                'id' => $row['id'] ?? null,
                'title' => '[Restricted]',
                'confidentiality_level' => $level,
                'redacted' => true,
            ];
        }

        return $row;
    }

    public function privacySafeNotificationBody(string $kind): string
    {
        return match ($kind) {
            'engagement_notified' => 'An audit engagement requires your attention. Sign in to view details.',
            'evidence_requested' => 'An evidence request has been issued. Sign in to respond.',
            'finding_issued' => 'An audit finding requires a management response. Sign in for details.',
            'corrective_due' => 'A corrective action status changed. Sign in for details.',
            'verification_required' => 'A corrective action is due for audit verification.',
            'plan_approval' => 'An annual audit plan requires approval.',
            default => 'An audit management update is available. Sign in for details.',
        };
    }
}
