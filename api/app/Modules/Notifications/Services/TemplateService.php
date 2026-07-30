<?php

namespace App\Modules\Notifications\Services;

use App\Models\Notifications\NotificationTemplateVersion;
use App\Models\NotificationTemplate;
use App\Models\User;
use App\Services\NotificationService as LegacyNotificationService;

class TemplateService
{
    public function resolve(int $tenantId, string $templateKey, string $locale = 'en'): array
    {
        $version = NotificationTemplateVersion::query()
            ->where('tenant_id', $tenantId)
            ->where('template_key', $templateKey)
            ->where('locale', $locale)
            ->where('status', 'published')
            ->orderByDesc('version')
            ->first();

        if (! $version && $locale !== 'en') {
            $version = NotificationTemplateVersion::query()
                ->where('tenant_id', $tenantId)
                ->where('template_key', $templateKey)
                ->where('locale', 'en')
                ->where('status', 'published')
                ->orderByDesc('version')
                ->first();
        }

        if ($version) {
            return [
                'subject' => $version->subject,
                'body' => $version->body,
                'privacy_subject' => $version->privacy_subject,
                'template_version_id' => $version->id,
                'locale' => $version->locale,
            ];
        }

        $stored = NotificationTemplate::query()
            ->where('tenant_id', $tenantId)
            ->where('trigger_key', $templateKey)
            ->first();

        if ($stored) {
            return [
                'subject' => $stored->subject,
                'body' => $stored->body,
                'privacy_subject' => null,
                'template_version_id' => null,
                'locale' => $locale,
            ];
        }

        $defaults = $this->legacyDefaults($templateKey);

        return [
            'subject' => $defaults['subject'],
            'body' => $defaults['body'],
            'privacy_subject' => $this->privacySubjectFor($templateKey),
            'template_version_id' => null,
            'locale' => $locale,
        ];
    }

    public function render(array $template, array $vars, string $confidentiality = 'internal'): array
    {
        $subject = $this->replace($template['subject'], $vars);
        $body = $this->replace($template['body'], $vars);

        if (in_array($confidentiality, ['restricted', 'confidential', 'highly_confidential', 'security_sensitive'], true)) {
            $subject = $template['privacy_subject']
                ? $this->replace($template['privacy_subject'], $vars)
                : $this->privacySafeSubject($subject, $template['template_version_id'] ?? null, $vars);
        }

        return [
            'subject' => $subject,
            'body' => $body,
            'template_version_id' => $template['template_version_id'] ?? null,
            'locale' => $template['locale'] ?? 'en',
        ];
    }

    public function replace(string $text, array $vars): string
    {
        foreach ($vars as $key => $value) {
            $text = str_replace('{{'.$key.'}}', (string) ($value ?? ''), $text);
        }

        return $text;
    }

    public function privacySubjectFor(string $templateKey): string
    {
        return match (true) {
            str_starts_with($templateKey, 'workflow.') => 'Nexus workflow update — sign in to review',
            str_starts_with($templateKey, 'audit.') => 'Audit update — sign in to Nexus',
            str_starts_with($templateKey, 'user.') => 'Account security notice — SADC-PF Nexus',
            default => 'Nexus notification — sign in for details',
        };
    }

    private function privacySafeSubject(string $fallback, mixed $ignored, array $vars): string
    {
        unset($ignored, $vars, $fallback);

        return 'Nexus notification — sign in for details';
    }

    private function legacyDefaults(string $triggerKey): array
    {
        return app(LegacyNotificationService::class)->defaultTemplate($triggerKey);
    }

    public function ensurePublishedVersion(int $tenantId, string $templateKey, string $locale, string $subject, string $body, ?User $actor = null): NotificationTemplateVersion
    {
        $latest = NotificationTemplateVersion::query()
            ->where('tenant_id', $tenantId)
            ->where('template_key', $templateKey)
            ->where('locale', $locale)
            ->orderByDesc('version')
            ->first();

        $version = ($latest?->version ?? 0) + 1;

        return NotificationTemplateVersion::create([
            'tenant_id' => $tenantId,
            'template_key' => $templateKey,
            'version' => $version,
            'locale' => $locale,
            'status' => 'published',
            'subject' => $subject,
            'body' => $body,
            'privacy_subject' => $this->privacySubjectFor($templateKey),
            'published_by' => $actor?->id,
            'published_at' => now(),
            'approved_by' => $actor?->id,
            'approved_at' => now(),
        ]);
    }
}
