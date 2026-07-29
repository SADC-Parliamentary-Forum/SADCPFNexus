<?php

namespace App\Modules\Finance\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

class GenericHttpPayrollAdapter extends NullPayrollVendorAdapter
{
    public function driver(): string
    {
        return 'generic_http';
    }

    public function importPayslips(array $payload): array
    {
        $url = config('payroll_vendor.http_url');
        if (! empty($payload['lines']) && empty($payload['remote'])) {
            return parent::importPayslips($payload);
        }

        if (! $url) {
            // Staging path: accept structured JSON upload without remote call.
            return parent::importPayslips($payload);
        }

        $headers = [];
        $key = config('payroll_vendor.api_key');
        if ($key) {
            $headers['Authorization'] = 'Bearer '.$key;
        }

        $response = Http::timeout((int) config('payroll_vendor.http_timeout', 20))
            ->withHeaders($headers)
            ->acceptJson()
            ->get($url, array_filter([
                'period' => $payload['period'] ?? null,
            ]));

        if (! $response->successful()) {
            throw ValidationException::withMessages([
                'remote' => 'Payroll vendor HTTP request failed with status '.$response->status(),
            ]);
        }

        $body = $response->json();
        $lines = is_array($body['lines'] ?? null) ? $body['lines'] : (is_array($body) ? $body : []);

        return parent::importPayslips(['lines' => $lines]);
    }
}
