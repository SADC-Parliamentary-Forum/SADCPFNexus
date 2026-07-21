FROM php:8.4-fpm-alpine

RUN set -eux; \
    apk add --no-cache \
        curl \
        git \
        unzip \
        libpq \
        libzip \
        oniguruma; \
    apk add --no-cache --virtual .build-deps \
        $PHPIZE_DEPS \
        libpq-dev \
        libzip-dev \
        oniguruma-dev; \
    docker-php-ext-install pdo pdo_pgsql pgsql zip bcmath mbstring pcntl; \
    pecl install redis; \
    docker-php-ext-enable redis; \
    apk del .build-deps

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/api

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod 755 /usr/local/bin/entrypoint.sh

# Allow Docker env vars (FRONTEND_URL, APP_ENV, etc.) to reach PHP-FPM workers
COPY www.conf /usr/local/etc/php-fpm.d/zzz-clear-env.conf

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
