<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Portfolio;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class PortfoliosController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', Portfolio::class);

        return Portfolio::where('tenant_id', $request->user()->tenant_id)
            ->withCount('users')
            ->orderBy('name')
            ->get();
    }

    public function store(Request $request)
    {
        $this->authorize('create', Portfolio::class);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'color' => 'nullable|string|max:7',
        ]);

        $portfolio = Portfolio::create(array_merge($validated, [
            'tenant_id' => $request->user()->tenant_id
        ]));

        return response()->json($portfolio, Response::HTTP_CREATED);
    }

    public function show(Portfolio $portfolio)
    {
        $this->authorize('view', $portfolio);
        return $portfolio->load('users');
    }

    public function update(Request $request, Portfolio $portfolio)
    {
        $this->authorize('update', $portfolio);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'color' => 'nullable|string|max:7',
        ]);

        $portfolio->update($validated);

        return response()->json($portfolio);
    }

    public function destroy(Portfolio $portfolio)
    {
        $this->authorize('delete', $portfolio);
        $portfolio->delete();

        return response()->noContent();
    }
}
