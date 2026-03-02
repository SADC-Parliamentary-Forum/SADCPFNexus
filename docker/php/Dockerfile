FROM php:8.3-fpm-alpine

RUN apk add --no-cache \
    postgresql-dev \
    libzip-dev \
    libpng-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    oniguruma-dev \
    curl \
    git \
    unzip

RUN docker-php-ext-install pdo pdo_pgsql pgsql zip bcmath mbstring pcntl

RUN pecl install redis && docker-php-ext-enable redis

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/api

RUN addgroup -g 1000 www && adduser -u 1000 -G www -s /bin/sh -D www
USER www
