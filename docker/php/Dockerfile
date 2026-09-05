FROM php:8.4-fpm-alpine

# PHP 8.4 moved ext-imap from core to PECL — install via pecl, not docker-php-ext-install.
RUN set -eux; \
    apk add --no-cache \
        curl \
        git \
        unzip \
        libpq \
        libzip \
        oniguruma \
        c-client \
        krb5-libs \
        freetype \
        libjpeg-turbo \
        libpng \
        libwebp; \
    apk add --no-cache --virtual .build-deps \
        $PHPIZE_DEPS \
        libpq-dev \
        libzip-dev \
        oniguruma-dev \
        imap-dev \
        krb5-dev \
        openssl-dev \
        freetype-dev \
        libjpeg-turbo-dev \
        libpng-dev \
        libwebp-dev; \
    docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp; \
    docker-php-ext-install pdo pdo_pgsql pgsql zip bcmath mbstring pcntl gd; \
    pecl install redis; \
    printf '\n' | pecl install imap; \
    docker-php-ext-enable redis imap; \
    apk del .build-deps

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/api

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod 755 /usr/local/bin/entrypoint.sh

# Allow Docker env vars (FRONTEND_URL, APP_ENV, etc.) to reach PHP-FPM workers
COPY www.conf /usr/local/etc/php-fpm.d/zzz-clear-env.conf

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
