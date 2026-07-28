<?php

return [
    'allowed_email_domains' => array_values(array_filter(array_map(
        static fn (string $domain): string => strtolower(trim($domain)),
        explode(',', (string) env('NEXUS_ALLOWED_EMAIL_DOMAINS', 'sadcpf.org'))
    ))),
];
