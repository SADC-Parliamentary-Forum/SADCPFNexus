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
        // Hub landings must use assigned keys. effectivePermissions() reverse-aliases
        // travel.module.view (from travel.create) back to travel.view / travel.admin.
        $held = $user->getAllPermissions()->pluck('name')->all();
        $holds = $user->isSystemAdmin()
            ? fn (string ...$keys) => true
            : fn (string ...$keys) => count(array_intersect($keys, $held)) > 0;

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
            if ($has('leave.balance.certify.assigned') || $holds('leave.admin')) {
                $children[] = $this->item('Certification Queue', '/leave/queues/certify', 'verified');
            }
            $items[] = $this->item('Leave', '/leave', 'event_available', children: $children, linkable: $holds('leave.view', 'leave.admin'));
        }

        if ($has('travel.module.view', 'travel.view', 'travel.create', 'travel.request.create.self')) {
            $children = [];
            if ($holds('travel.view', 'travel.admin')) {
                $children[] = $this->item('Travel', '/travel', 'dashboard');
                $children[] = $this->item('Register', '/travel/register', 'menu_book');
                $children[] = $this->item('Missions', '/travel/missions', 'groups');
            }
            if ($has('travel.create', 'travel.request.create.self')) {
                $children[] = $this->item('New request', '/travel/create', 'add_circle');
            }
            if ($holds('travel.admin', 'travel.finance-review')) {
                $children[] = $this->item('Settings', '/travel/settings', 'settings');
            }
            $items[] = $this->item(
                'Travel',
                '/travel',
                'flight_takeoff',
                children: $children,
                linkable: $holds('travel.view', 'travel.admin'),
            );
        }

        // Procurement — organisation hub needs procurement.view.
        // procurement.create aliases to procurement.module.view; that must not
        // unlock the register / vendors landing the way a buyer role would.
        $procHub = $holds('procurement.view', 'procurement.admin');
        $procCreate = $has('procurement.create', 'procurement.request.create');
        $procEvalOnly = ! $procHub && ! $procCreate && $has('procurement.evaluation.read.assigned');
        if ($procHub || $procCreate) {
            $children = [];
            if ($procHub) {
                $children[] = $this->item('Procurement Dashboard', '/procurement', 'dashboard');
            }
            if ($procCreate || $procHub) {
                $children[] = $this->item('New Request', '/procurement/create', 'add_circle');
            }
            if ($holds('procurement.supplier.read', 'procurement.manage_vendors')) {
                $children[] = $this->item('Suppliers', '/procurement/vendors', 'store');
            }
            if ($has('procurement.evaluation.read.assigned')) {
                $children[] = $this->item('Evaluations', '/my-work/procurement-evaluations', 'fact_check');
            }
            $items[] = $this->item(
                'Procurement',
                '/procurement',
                'shopping_cart',
                children: $children,
                linkable: $procHub,
            );
        } elseif ($procEvalOnly) {
            // Already covered under My Work — do not expose Procurement parent.
        }

        // Contracts — register hub for anyone who can see the module.
        if ($holds('contract.view', 'contract.view_all', 'contract.audit_view')) {
            $children = [
                $this->item('Dashboard', '/contracts', 'dashboard'),
                $this->item('Contract Register', '/contracts/register', 'menu_book'),
            ];
            if ($holds('contract.create')) {
                $children[] = $this->item('New Contract', '/contracts/create', 'add_circle');
            }
            if ($holds('contract.report', 'contract.view_all', 'contract.audit_view')) {
                $children[] = $this->item('Reports', '/contracts/reports', 'assessment');
            }
            if ($holds('contract.manage_template', 'contract.manage_authority')) {
                $children[] = $this->item('Settings', '/contracts/settings', 'settings');
            }
            $items[] = $this->item('Contracts', '/contracts', 'description', children: $children, linkable: true);
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

        if ($has('supplier.portal')) {
            $items[] = $this->item('Supplier Portal', '/supplier', 'storefront', children: [
                $this->item('Overview', '/supplier', 'dashboard'),
                $this->item('RFQs', '/supplier/rfqs', 'request_quote'),
                $this->item('Purchase Orders', '/supplier/purchase-orders', 'receipt_long'),
                $this->item('Invoices', '/supplier/invoices', 'description'),
                $this->item('Profile', '/supplier/profile', 'badge'),
                $this->item('Help & Support', '/profile/support', 'help'),
            ]);
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

        if ($has('assets.scan', 'assets.view', 'assets.admin', 'assets.manage', 'assets.verify')) {
            $children = [];
            if ($has('assets.scan', 'assets.view', 'assets.verify', 'assets.admin', 'assets.manage')) {
                $children[] = $this->item('Scan Asset', '/assets/scan', 'qr_code_scanner');
            }
            if ($holds('assets.view', 'assets.admin', 'assets.manage')) {
                $children[] = $this->item('Dashboard', '/assets/dashboard', 'dashboard');
                $children[] = $this->item('Register', '/assets', 'inventory_2');
                $children[] = $this->item('Checkouts', '/assets/checkouts', 'logout');
                $children[] = $this->item('Lost / Stolen', '/assets/incidents', 'report');
                $children[] = $this->item('Imports', '/assets/import', 'upload_file');
                $children[] = $this->item('Settings', '/assets/settings', 'settings');
            }
            $items[] = $this->item(
                'Fixed Assets',
                $holds('assets.view', 'assets.admin', 'assets.manage') ? '/assets' : '/assets/scan',
                'inventory_2',
                children: $children,
                linkable: true,
            );
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
