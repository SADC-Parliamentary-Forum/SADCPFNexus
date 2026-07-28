<?php

/**
 * Worktree-safe PHPUnit bootstrap.
 *
 * Shared/junctioned vendor may have Composer classmap/baseDir pointing at
 * another checkout. Strip local namespace classmaps and re-bind PSR-4 roots.
 * Also force APP_BASE_PATH so Laravel does not infer the junction target.
 */
$root = dirname(__DIR__);

$_ENV['APP_BASE_PATH'] = $root;
$_SERVER['APP_BASE_PATH'] = $root;
putenv('APP_BASE_PATH=' . $root);

$loader = require __DIR__ . '/../vendor/autoload.php';

$reflection = new ReflectionObject($loader);
foreach (['classMap', 'missingClasses'] as $propName) {
    if (!$reflection->hasProperty($propName)) {
        continue;
    }
    $prop = $reflection->getProperty($propName);
    $prop->setAccessible(true);
    $value = $prop->getValue($loader);
    if (!is_array($value)) {
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

$loader->setPsr4('App\\', [$root . DIRECTORY_SEPARATOR . 'app']);
$loader->setPsr4('Database\\Factories\\', [$root . DIRECTORY_SEPARATOR . 'database' . DIRECTORY_SEPARATOR . 'factories']);
$loader->setPsr4('Database\\Seeders\\', [$root . DIRECTORY_SEPARATOR . 'database' . DIRECTORY_SEPARATOR . 'seeders']);
$loader->setPsr4('Tests\\', [$root . DIRECTORY_SEPARATOR . 'tests']);

return $loader;
