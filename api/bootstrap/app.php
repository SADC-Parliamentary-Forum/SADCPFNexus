<?php

use App\Support\CorsHelper;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Use custom AddCorsHeaders (with CorsHelper + config/cors.php) as the single CORS implementation.
        $middleware->prepend(\App\Http\Middleware\AddCorsHeaders::class);
        // Prepend CORS to api group so it runs before auth/throttle on every API request.
        $middleware->api(prepend: [\App\Http\Middleware\AddCorsHeaders::class], append: []);
        $middleware->alias([
            'rls' => \App\Http\Middleware\SetRlsContext::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (Throwable $e, Request $request) {
            if (!$request->is('api/*') && !$request->is('api')) {
                return null;
            }

            $status = 500;
            $payload = ['message' => $e->getMessage()];

            if ($e instanceof AuthenticationException) {
                $status = 401;
            }
            if ($e instanceof HttpExceptionInterface) {
                $status = $e->getStatusCode();
            }
            if ($e instanceof ValidationException) {
                $status = $e->status;
                $payload = ['message' => $e->getMessage(), 'errors' => $e->errors()];
            }

            if (config('app.debug')) {
                $payload['exception'] = get_class($e);
                $payload['file'] = $e->getFile();
                $payload['line'] = $e->getLine();
                $payload['trace'] = collect($e->getTrace())->map(fn ($frame) => [
                    'file' => $frame['file'] ?? null,
                    'line' => $frame['line'] ?? null,
                    'function' => $frame['function'] ?? null,
                ])->take(10)->values()->all();
            }

            $response = response()->json($payload, $status);
            foreach (CorsHelper::headersForRequest($request) as $name => $value) {
                $response->header($name, $value);
            }
            return $response;
        });
    })->create();
