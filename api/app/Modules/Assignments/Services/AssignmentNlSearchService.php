<?php

namespace App\Modules\Assignments\Services;

class AssignmentNlSearchService
{
    public function suggest(string $q): array
    {
        $text = mb_strtolower(trim($q));
        $filters = [];

        if (str_contains($text, 'overdue') || str_contains($text, 'late')) {
            $filters['overdue'] = true;
        }
        if (preg_match('/\b(mine|my work|assigned to me)\b/', $text)) {
            $filters['scope'] = 'mine';
        } elseif (preg_match('/\b(team|department)\b/', $text)) {
            $filters['scope'] = 'team';
        }
        foreach (['critical', 'high', 'medium', 'low'] as $priority) {
            if (str_contains($text, $priority)) {
                $filters['priority'] = $priority;
                break;
            }
        }
        foreach (['blocked', 'active', 'completed', 'draft', 'issued'] as $status) {
            if (str_contains($text, $status)) {
                $filters['status'] = $status;
                break;
            }
        }
        if (str_contains($text, 'unassigned')) {
            $filters['unassigned'] = true;
        }

        $hrefs = [];
        if (! empty($filters['overdue'])) {
            $hrefs[] = ['label' => 'Overdue queue', 'href' => '/assignments/overdue'];
        }
        if (($filters['scope'] ?? '') === 'mine') {
            $hrefs[] = ['label' => 'My assignments', 'href' => '/assignments/mine'];
        } elseif (($filters['scope'] ?? '') === 'team') {
            $hrefs[] = ['label' => 'Team assignments', 'href' => '/assignments/team'];
        }
        if (($filters['status'] ?? '') === 'blocked') {
            $hrefs[] = ['label' => 'Blocked queue', 'href' => '/assignments/blocked'];
        }
        if (($filters['status'] ?? '') === 'completed') {
            $hrefs[] = ['label' => 'Completed', 'href' => '/assignments/completed'];
        }
        if (! empty($filters['unassigned'])) {
            $hrefs[] = ['label' => 'Unassigned queue', 'href' => '/assignments/unassigned'];
        }
        if ($hrefs === []) {
            $hrefs[] = ['label' => 'Assignment register', 'href' => '/assignments/register'];
        }

        return [
            'q' => $q,
            'filter_suggest_only' => true,
            'suggested_filters' => $filters,
            'apply_hrefs' => $hrefs,
            'note' => 'Suggestions only. Apply filters yourself; this does not create, rank, or complete assignments.',
        ];
    }
}
