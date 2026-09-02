<?php

namespace App\Modules\AccessControl\Services;

use App\Models\User;

/**
 * Navigation / My Work manifest derived from effective permissions (PRD §10).
 * Feature-only users get leaf entries without parent module landing links.
 */
class NavigationManifestService
{
    public function __construct(
        private readonly PolicyDecisionPoint $pdp,
        private readonly PermissionRegistry $registry,
    ) {}

    public function forUser(User $user): array
    {
        $effective = $this->pdp->effectivePermissions($user);
        $has = fn (string ...$keys) => count(array_intersect($keys, $effective)) > 0;

        $items = [];

        if ($has('dashboard.view', 'leave.view', 'travel.view')) {
            $items[] = $this->item('Dashboard', '/dashboard', 'dashboard');
        }

        if ($has('my_work.view', 'approvals.inbox.view', 'procurement.evaluation.read.assigned')) {
            $children = [];
            if ($has('approvals.inbox.view', 'travel.approve', 'leave.approve', 'procurement.approve')) {
                $children[] = $this->item('Approvals Inbox', '/approvals/inbox', 'inbox');
            }
            if ($has('procurement.evaluation.read.assigned', 'procurement.evaluation.score.assigned')) {
                $children[] = $this->item('Procurement Evaluations', '/my-work/procurement-evaluations', 'fact_check', featureOnly: true);
            }
            if ($has('assignment.read.assigned')) {
                $children[] = $this->item('My Assignments', '/assignments/mine', 'task_alt');
            }
            $items[] = $this->item('My Work', '/my-work', 'work', children: $children, linkable: $has('my_work.view'));
        }

        // Leave — module landing only if module.view (or legacy leave.view)
        if ($has('leave.module.view', 'leave.view', 'leave.create')) {
            $children = [
                $this->item('My Leave', '/leave', 'event_available'),
            ];
            if ($has('leave.request.create.self', 'leave.create')) {
                $children[] = $this->item('Apply for Leave', '/leave/create', 'add_circle');
            }
            if ($has('leave.request.recommend.assigned', 'leave.approve')) {
                $children[] = $this->item('Recommend Inbox', '/leave?queue=recommend', 'thumb_up');
            }
            if ($has('leave.balance.certify.assigned', 'leave.admin')) {
                $children[] = $this->item('Certification Queue', '/leave/queues/certify', 'verified');
            }
            $items[] = $this->item('Leave', '/leave', 'event_available', children: $children, linkable: $has('leave.view'));
        }

        if ($has('travel.module.view', 'travel.view', 'travel.create', 'travel.request.create.self')) {
            $children = [];
            if ($has('travel.view')) {
                $children[] = $this->item('Travel', '/travel', 'dashboard');
                $children[] = $this->item('Register', '/travel/register', 'menu_book');
                $children[] = $this->item('Missions', '/travel/missions', 'groups');
            }
            if ($has('travel.create', 'travel.request.create.self')) {
                $children[] = $this->item('New request', '/travel/create', 'add_circle');
            }
            if ($has('travel.admin', 'travel.finance-review')) {
                $children[] = $this->item('Settings', '/travel/settings', 'settings');
            }
            $items[] = $this->item(
                'Travel',
                '/travel',
                'flight_takeoff',
                children: $children,
                linkable: $has('travel.view'),
            );
        }

        // Procurement — feature-only evaluators skip module landing
        $procModule = $has('procurement.module.view', 'procurement.view');
        $procEvalOnly = ! $procModule && $has('procurement.evaluation.read.assigned');
        if ($procModule) {
            $children = [
                $this->item('Procurement Dashboard', '/procurement', 'dashboard'),
            ];
            if ($has('procurement.request.create', 'procurement.create')) {
                $children[] = $this->item('New Request', '/procurement/create', 'add_circle');
            }
            if ($has('procurement.supplier.read', 'procurement.manage_vendors')) {
                $children[] = $this->item('Suppliers', '/procurement/vendors', 'store');
            }
            if ($has('procurement.evaluation.read.assigned')) {
                $children[] = $this->item('Evaluations', '/my-work/procurement-evaluations', 'fact_check');
            }
            $items[] = $this->item('Procurement', '/procurement', 'shopping_cart', children: $children);
        } elseif ($procEvalOnly) {
            // Already covered under My Work — do not expose Procurement parent.
        }

        if ($has('programme.module.view', 'pif.view', 'governance.view', 'programme.request.create', 'pif.create')) {
            $items[] = $this->item('Programmes / PIF', '/pif', 'assignment', linkable: $has('programme.module.view', 'pif.view', 'governance.view'));
        }

        if ($has('mande.module.view', 'mande.view')) {
            $items[] = $this->item('M&E', '/mande', 'monitoring');
        }

        if ($has('salary_advance.module.view', 'salary_advance.view', 'salary_advance.create', 'finance.view')) {
            $items[] = $this->item('Salary Advances', '/salary-advances', 'payments');
        }

        if ($has('admin.roles.view', 'roles.view', 'roles.manage', 'admin.access.simulate')) {
            $items[] = $this->item('Access Governance', '/admin/access', 'admin_panel_settings', children: [
                $this->item('Role Catalogue', '/admin/access/roles', 'badge'),
                $this->item('Access Simulator', '/admin/access/simulator', 'preview'),
                $this->item('Permission Explorer', '/admin/access/explorer', 'search'),
                $this->item('Access Requests', '/admin/access/requests', 'rule'),
                $this->item('Access Reviews', '/admin/access/reviews', 'fact_check'),
                $this->item('Governance Checklist', '/admin/access/governance', 'checklist'),
            ]);
        }

        return [
            'items' => array_values(array_filter($items)),
            'effective_permission_count' => count($effective),
        ];
    }

    private function item(
        string $label,
        string $href,
        string $icon,
        array $children = [],
        bool $linkable = true,
        bool $featureOnly = false,
    ): array {
        return [
            'label' => $label,
            'href' => $linkable ? $href : null,
            'icon' => $icon,
            'linkable' => $linkable,
            'feature_only' => $featureOnly,
            'children' => $children,
        ];
    }
}
