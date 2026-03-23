FROM php:8.4-fpm-alpine

RUN apk add --no-cache \
    postgresql-dev \
    libzip-dev \
    libpng-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    oniguruma-dev \
    curl \
    git \
    unzip \
    autoconf \
    g++ \
    make

RUN docker-php-ext-install pdo pdo_pgsql pgsql zip bcmath mbstring pcntl

RUN pecl install redis && docker-php-ext-enable redis

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/api

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod 755 /usr/local/bin/entrypoint.sh

RUN addgroup -g 1000 www && adduser -u 1000 -G www -s /bin/sh -D www
USER www

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
