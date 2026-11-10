<?php

namespace App\Console\Commands;

use App\Models\Asset;
use App\Models\AssetAssignmentHistory;
use App\Models\AuditLog;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Assets\Services\AssetLabelService;
use App\Modules\Assets\Services\AssetTimelineService;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class InferAssetAssigneesCommand extends Command
{
    protected $signature = 'assets:infer-assignees
        {--tenant= : Tenant id (defaults to the only tenant)}
        {--apply : Assign the matched assets; without it the command only reports}';

    protected $description = 'Assign unassigned assets to the staff member named by a code in the asset name or location (dry run unless --apply)';

    /**
     * Codes and names used in the register, mapped to the staff member they stand for
     * (confirmed by the Forum on 10 Nov 2026). Upper-case codes match case-sensitively.
     *
     * @var array<string, string>
     */
    public const ALIASES = [
        'SG-BS' => 'Boemo Sekgoma',
        'Eros Weg' => 'Boemo Sekgoma',
        'USM' => 'Unaro Mungendje',
        'Sam B' => 'Samuel Bokosi',
        'TMM' => 'Toivo Mwaala',
        'ALM' => 'Agnes Lilungwe',
        'PRK' => 'Paulina Kanguatjivi',
        'PK-Reception' => 'Paulina Kanguatjivi',
        'RW' => 'Ronald Windwaai',
        'R. Windwaai' => 'Ronald Windwaai',
        'Pedro' => 'Pedro Lusakalalu',
        'S. Kurasha' => 'Sheuneni Kurasha',
        'L Boois' => 'Lorenda Boois',
        'S. Kauvee' => 'Samueline Kauvee',
        'C. Musonda' => 'Clare Musonda',
        'YNM' => 'Yapoka Mungandi',
    ];

    private const NOT_ASSIGNABLE = ['disposed', 'retired', 'pending_disposal', 'lost', 'stolen', 'written_off'];

    public function handle(AssetTimelineService $timeline, AssetLabelService $labels): int
    {
        $tenantId = $this->tenantId();
        if ($tenantId === null) {
            return self::FAILURE;
        }

        $users = User::query()->where('tenant_id', $tenantId)->where('is_active', true)->get(['id', 'name']);
        $people = [];
        foreach (array_unique(array_values(self::ALIASES)) as $person) {
            $people[$person] = self::findUser($person, $users);
        }

        $assets = Asset::query()
            ->where('tenant_id', $tenantId)
            ->whereNotIn('status', self::NOT_ASSIGNABLE)
            ->with(['location', 'assignedUser:id,name'])
            ->orderBy('id')
            ->get();

        $assign = $conflicts = $unsure = $noAccount = $unmatched = [];
        foreach ($assets as $asset) {
            $found = self::match(self::haystacks($asset));
            $persons = array_values(array_unique(array_column($found, 'person')));

            if ($asset->assigned_to) {
                $user = count($persons) === 1 ? $people[$persons[0]] : null;
                if ($user && (int) $user->id !== (int) $asset->assigned_to) {
                    $conflicts[] = [$asset, $persons[0]];
                }

                continue;
            }
            if ($persons === []) {
                $unmatched[] = $asset;
            } elseif (count($persons) > 1) {
                $unsure[] = [$asset, $persons];
            } elseif (! $people[$persons[0]]) {
                $noAccount[] = [$asset, $persons[0]];
            } else {
                $assign[] = [$asset, $people[$persons[0]], $found[0]];
            }
        }

        $verb = $this->option('apply') ? 'assign' : 'would assign';
        $this->info("Tenant {$tenantId}: {$assets->count()} live asset(s); ".count($assign).' to assign, '.count($unmatched).' with no recognised code, '.count($unsure).' naming more than one person, '.count($noAccount).' naming someone without an account, '.count($conflicts).' already assigned to someone else.');

        $this->section('Matched', $assign, fn ($r) => "{$verb} {$this->describe($r[0])} -> {$r[1]->name} (user {$r[1]->id}; \"{$r[2]['code']}\" in {$r[2]['field']})");
        $this->section('Unsure: more than one person named (not assigned)', $unsure, fn ($r) => $this->describe($r[0]).' -> '.implode(' / ', $r[1]));
        $this->section('Person has no active Nexus account (not assigned)', $noAccount, fn ($r) => $this->describe($r[0])." -> {$r[1]}");
        $this->section('Already assigned to someone else (left as is)', $conflicts, fn ($r) => $this->describe($r[0])." is assigned to {$r[0]->assignedUser?->name}; code suggests {$r[1]}");
        $this->section('No recognised code (please identify)', $unmatched, fn ($a) => $this->describe($a));

        if (! $this->option('apply')) {
            $this->warn('Dry run: nothing written. Re-run with --apply to assign the matched assets.');

            return self::SUCCESS;
        }

        DB::transaction(function () use ($assign, $tenantId, $timeline, $labels) {
            foreach ($assign as [$asset, $user, $hit]) {
                $asset->assigned_to = $user->id;
                if ($asset->status === 'available') {
                    $asset->status = 'assigned';
                }
                $asset->save();
                AssetAssignmentHistory::create([
                    'tenant_id' => $asset->tenant_id,
                    'asset_id' => $asset->id,
                    'assigned_to' => $user->id,
                    'department' => $asset->department,
                    'assignment_type' => 'custody',
                    'assigned_at' => now(),
                    'notes' => "Identified from \"{$hit['code']}\" in the asset {$hit['field']}",
                ]);
                $timeline->record($asset, 'ASSIGNEE_BACKFILLED', "Assigned to {$user->name} from \"{$hit['code']}\" in the asset {$hit['field']}");
                $labels->markReprintRequired($asset, 'ASSIGNEE_CHANGED');
            }
            AuditLog::record('assets.assignees_backfilled', [
                'tenant_id' => $tenantId,
                'new_values' => ['tenant_id' => $tenantId, 'count' => count($assign)],
                'tags' => 'assets',
            ]);
        });
        $this->info('Assigned '.count($assign).' asset(s).');

        return self::SUCCESS;
    }

    /**
     * @return array<string, string> field => text
     */
    public static function haystacks(Asset $asset): array
    {
        return array_filter([
            'name' => trim((string) $asset->name),
            'location' => trim((string) ($asset->location?->name ?? '')),
            'legacy location' => trim((string) $asset->legacy_location),
            'description' => trim((string) $asset->legacy_description),
        ], fn ($text) => $text !== '');
    }

    /**
     * Every alias found in the given texts.
     *
     * @param  array<string, string>  $haystacks
     * @return list<array{code: string, person: string, field: string}>
     */
    public static function match(array $haystacks): array
    {
        $found = [];
        foreach ($haystacks as $field => $text) {
            foreach (self::ALIASES as $code => $person) {
                if (preg_match(self::pattern($code), $text)) {
                    $found[] = ['code' => $code, 'person' => $person, 'field' => $field];
                }
            }
        }

        return $found;
    }

    /**
     * The active user with this exact name, or else the only one sharing the surname and first initial
     * (so "Samueline Kauvee" finds "Samueleni Kauvee"); null when there is no single clear match.
     */
    public static function findUser(string $person, Collection $users): ?User
    {
        $target = self::normalize($person);
        $exact = $users->filter(fn ($u) => self::normalize((string) $u->name) === $target);
        if ($exact->count() === 1) {
            return $exact->first();
        }
        if ($exact->count() > 1) {
            return null;
        }
        $parts = explode(' ', $target);
        $close = $users->filter(function ($u) use ($parts) {
            $theirs = explode(' ', self::normalize((string) $u->name));

            return end($theirs) === end($parts) && ($theirs[0][0] ?? '') === ($parts[0][0] ?? '');
        });

        return $close->count() === 1 ? $close->first() : null;
    }

    private static function pattern(string $code): string
    {
        $parts = preg_split('/[\s.\-]+/', $code, -1, PREG_SPLIT_NO_EMPTY) ?: [$code];
        $body = implode('[\s.\-]*', array_map(fn ($p) => preg_quote($p, '/'), $parts));
        $caseSensitive = preg_match('/^[A-Z][A-Z\-]+$/', $code) === 1;

        return '/(?<![A-Za-z0-9])'.$body.'(?![A-Za-z0-9])/'.($caseSensitive ? '' : 'i');
    }

    private static function normalize(string $name): string
    {
        $name = preg_replace('/\b(mr|mrs|ms|dr|prof|hon)\b\.?/i', '', $name) ?? $name;

        return trim(preg_replace('/\s+/', ' ', strtolower(str_replace('.', ' ', $name))) ?? '');
    }

    private function describe(Asset $asset): string
    {
        $tag = strtoupper(trim((string) ($asset->tag_number ?: $asset->asset_code)));
        $location = $asset->location?->name ?: $asset->legacy_location;

        return "{$tag} | {$asset->name}".($location ? " | {$location}" : '');
    }

    private function section(string $title, array $rows, callable $line): void
    {
        if ($rows === []) {
            return;
        }
        $this->line('');
        $this->line("== {$title} (".count($rows).')');
        foreach ($rows as $row) {
            $this->line('  '.$line($row));
        }
    }

    private function tenantId(): ?int
    {
        $raw = trim((string) $this->option('tenant'));
        if ($raw === '') {
            $ids = Tenant::query()->pluck('id');
            if ($ids->count() !== 1) {
                $this->error('Several tenants exist; provide --tenant=<id>.');

                return null;
            }

            return (int) $ids->first();
        }
        if (! preg_match('/^[1-9][0-9]*$/', $raw) || ! Tenant::query()->whereKey((int) $raw)->exists()) {
            $this->error("Tenant {$raw} was not found.");

            return null;
        }

        return (int) $raw;
    }
}
