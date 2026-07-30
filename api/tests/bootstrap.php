<?php

/**
 * Worktree-safe PHPUnit bootstrap.
 *
 * Prefer this worktree's vendor; if incomplete, fall back to the main checkout
 * vendor while forcing APP_BASE_PATH + PSR-4 roots to this worktree.
 */
$root = dirname(__DIR__);
$mainVendorAutoload = 'D:\\DEV\\SADCPFNexus\\api\\vendor\\autoload.php';
$localVendorAutoload = $root.DIRECTORY_SEPARATOR.'vendor'.DIRECTORY_SEPARATOR.'autoload.php';

$_ENV['APP_BASE_PATH'] = $root;
$_SERVER['APP_BASE_PATH'] = $root;
putenv('APP_BASE_PATH='.$root);

$autoload = is_file($localVendorAutoload) && is_file($root.DIRECTORY_SEPARATOR.'vendor'.DIRECTORY_SEPARATOR.'laravel'.DIRECTORY_SEPARATOR.'framework'.DIRECTORY_SEPARATOR.'src'.DIRECTORY_SEPARATOR.'Illuminate'.DIRECTORY_SEPARATOR.'View'.DIRECTORY_SEPARATOR.'ViewServiceProvider.php')
    ? $localVendorAutoload
    : $mainVendorAutoload;

$loader = require $autoload;

$reflection = new ReflectionObject($loader);
foreach (['classMap', 'missingClasses'] as $propName) {
    if (! $reflection->hasProperty($propName)) {
        continue;
    }
    $prop = $reflection->getProperty($propName);
    $prop->setAccessible(true);
    $value = $prop->getValue($loader);
    if (! is_array($value)) {
        continue;
    }
    $filtered = [];
    foreach ($value as $class => $path) {
        if (
            str_starts_with((string) $class, 'App\\')
            || str_starts_with((string) $class, 'Database\\Factories\\')
            || str_starts_with((string) $class, 'Database\\Seeders\\')
            || str_starts_with((string) $class, 'Tests\\')
        ) {
            continue;
        }
        $filtered[$class] = $path;
    }
    $prop->setValue($loader, $filtered);
}

if (method_exists($loader, 'setClassMapAuthoritative')) {
    $loader->setClassMapAuthoritative(false);
}

$loader->setPsr4('App\\', [$root.DIRECTORY_SEPARATOR.'app']);
$loader->setPsr4('Database\\Factories\\', [$root.DIRECTORY_SEPARATOR.'database'.DIRECTORY_SEPARATOR.'factories']);
$loader->setPsr4('Database\\Seeders\\', [$root.DIRECTORY_SEPARATOR.'database'.DIRECTORY_SEPARATOR.'seeders']);
$loader->setPsr4('Tests\\', [$root.DIRECTORY_SEPARATOR.'tests']);

return $loader;
