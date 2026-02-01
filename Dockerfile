FROM php:8.5-apache

# Enable mod_rewrite for URL routing
RUN a2enmod rewrite

# Allow .htaccess overrides
RUN sed -i 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf

RUN apt-get update && apt-get install -y \
    libpng-dev \
    libjpeg-dev \
    libfreetype6-dev \
    libmagickwand-dev \
    imagemagick \
    && rm -rf /var/lib/apt/lists/*

RUN docker-php-ext-configure gd \
    --with-freetype \
    --with-jpeg \
    && docker-php-ext-install gd

RUN pecl install imagick \
    && docker-php-ext-enable imagick

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY ./ /var/www/html/

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader || true

# Note: smtpcreds.env can be placed in:
#   - One level above project (most secure)
#   - Project root (/var/www/html/smtpcreds.env)
#   - API folder (/var/www/html/api/smtpcreds.env)
# For Docker, you can mount it: -v /path/to/smtpcreds.env:/var/www/html/smtpcreds.env
