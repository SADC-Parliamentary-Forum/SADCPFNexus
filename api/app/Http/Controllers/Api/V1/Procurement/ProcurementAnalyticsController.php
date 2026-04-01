<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Models\ProcurementRequest;
use App\Models\PurchaseOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProcurementAnalyticsController extends Controller
{
    private function gateAnalytics(Request $request): void
    {
        if (! $request->user()->hasAnyRole(['Procurement Officer', 'Finance Controller', 'System Admin', 'Secretary General'])) {
            abort(403);
        }
    }

    public function summary(Request $request): JsonResponse
    {
        $this->gateAnalytics($request);
        $tenantId = $request->user()->tenant_id;

        $totalRequests = ProcurementRequest::where('tenant_id', $tenantId)->count();

        $totalSpend = PurchaseOrder::where('tenant_id', $tenantId)
            ->whereNotIn('status', ['cancelled', 'draft'])
            ->sum('total_amount');

        $avgCycleTime = ProcurementRequest::where('tenant_id', $tenantId)
            ->where('status', 'awarded')
            ->whereNotNull('awarded_at')
            ->select(DB::raw('AVG(EXTRACT(EPOCH FROM (awarded_at - created_at)) / 86400) as avg_days'))
            ->value('avg_days');

        $activeContracts = Contract::where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->count();

        return response()->json([
            'data' => [
                'total_requests'       => $totalRequests,
                'total_spend'          => round((float) $totalSpend, 2),
                'avg_cycle_time_days'  => $avgCycleTime ? round((float) $avgCycleTime, 1) : 0,
                'active_contracts'     => $activeContracts,
            ],
        ]);
    }

    public function spendByCategory(Request $request): JsonResponse
    {
        $this->gateAnalytics($request);
        $tenantId = $request->user()->tenant_id;

        $results = ProcurementRequest::where('procurement_requests.tenant_id', $tenantId)
            ->where('procurement_requests.status', 'awarded')
            ->join('purchase_orders', 'purchase_orders.procurement_request_id', '=', 'procurement_requests.id')
            ->whereNotIn('purchase_orders.status', ['cancelled'])
            ->select('procurement_requests.category', DB::raw('SUM(purchase_orders.total_amount) as total'))
            ->groupBy('procurement_requests.category')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => ['category' => $row->category, 'total' => (float) $row->total]);

        return response()->json(['data' => $results]);
    }

    public function vendorPerformance(Request $request): JsonResponse
    {
        $this->gateAnalytics($request);
        $tenantId = $request->user()->tenant_id;

        $results = PurchaseOrder::where('purchase_orders.tenant_id', $tenantId)
            ->join('vendors', 'vendors.id', '=', 'purchase_orders.vendor_id')
            ->whereNotIn('purchase_orders.status', ['cancelled', 'draft'])
            ->select(
                'vendors.id',
                'vendors.name',
                DB::raw('COUNT(purchase_orders.id) as po_count'),
                DB::raw('SUM(purchase_orders.total_amount) as total_value')
            )
            ->groupBy('vendors.id', 'vendors.name')
            ->orderByDesc('total_value')
            ->limit(10)
            ->get()
            ->map(fn ($row) => [
                'vendor_id'   => $row->id,
                'vendor_name' => $row->name,
                'po_count'    => $row->po_count,
                'total_value' => (float) $row->total_value,
            ]);

        return response()->json(['data' => $results]);
    }

    public function flags(Request $request): JsonResponse
    {
        $this->gateAnalytics($request);
        $tenantId = $request->user()->tenant_id;
        $flags    = [];

        // Flag 1: Vendor awarded >3 times in last 12 months
        $repeatedVendors = ProcurementRequest::where('tenant_id', $tenantId)
            ->where('status', 'awarded')
            ->whereNotNull('awarded_at')
            ->where('awarded_at', '>=', now()->subYear())
            ->join('procurement_quotes', 'procurement_quotes.id', '=', 'procurement_requests.awarded_quote_id')
            ->select('procurement_quotes.vendor_id', DB::raw('COUNT(*) as award_count'))
            ->groupBy('procurement_quotes.vendor_id')
            ->having('award_count', '>', 3)
            ->get();

        foreach ($repeatedVendors as $rv) {
            $flags[] = [
                'type'       => 'repeated_award',
                'severity'   => 'high',
                'message'    => "Vendor ID {$rv->vendor_id} awarded {$rv->award_count} times in the last 12 months.",
                'vendor_id'  => $rv->vendor_id,
            ];
        }

        // Flag 2: Requests awarded without approved vendors
        $unapprovedVendorAwards = ProcurementRequest::where('procurement_requests.tenant_id', $tenantId)
            ->where('procurement_requests.status', 'awarded')
            ->join('procurement_quotes', 'procurement_quotes.id', '=', 'procurement_requests.awarded_quote_id')
            ->join('vendors', 'vendors.id', '=', 'procurement_quotes.vendor_id')
            ->where('vendors.is_approved', false)
            ->select('procurement_requests.id', 'procurement_requests.title', 'vendors.name as vendor_name')
            ->get();

        foreach ($unapprovedVendorAwards as $r) {
            $flags[] = [
                'type'       => 'unapproved_vendor',
                'severity'   => 'critical',
                'message'    => "Request \"{$r->title}\" awarded to unapproved vendor \"{$r->vendor_name}\".",
                'request_id' => $r->id,
            ];
        }

        return response()->json(['data' => $flags]);
    }
}
