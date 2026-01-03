# Xneelo Shop - Lightweight Self-Hosted E-commerce Platform

A lightweight, self-hosted PHP/SQLite e-commerce platform designed for hosting customers to install and manage their own online stores.

## Running locally

The app can be run locally in Docker.

**Note**: To reset the website installation, delete `data/shop.db`.

### Set up user permissions for the Docker container

Make sure you have the correct GID and UID set up in your .env file (copy example.env to .env if you're setting it up for the first time)

```
id -g
id -u
```
Copy the correct values into .env

.env
```
GID=1000
UID=1000
```

### Run the app with Docker Compose

Then start Apache in Docker:

```
docker compose up --build
```

`--build` can be omitted if the app has been built already.

## Running PHPUnit tests

First make sure you have PHP and Composer installed locally.

Run the test suite using Composer:

```
composer test
```


## Features

### Customer Storefront
- **Homepage** with featured products and categories
- **Shop** page with category filtering, search, and sorting
- **Product detail** pages with image gallery, variants, and add-to-cart
- **Shopping cart** with quantity management and coupon codes
- **Checkout** with guest or registered checkout
- **Order confirmation** with receipt display
- **Customer accounts** - registration, login, password reset
- **Order history** and tracking

### Admin Panel (/site-admin/)
- **Dashboard** with sales statistics, recent orders, low stock alerts
- **Products** - CRUD operations, images, variants, inventory tracking
- **Categories** - hierarchical categories with parent/child relationships
- **Orders** - order management, status updates, tracking numbers
- **Customers** - customer management, order history
- **Invoices** - invoice generation, payment tracking, email sending
- **Pages** - custom pages (About, Contact, Policies)
- **Coupons** - percentage/fixed discounts, usage limits, date ranges
- **Settings** - comprehensive settings panel:
  - Store details (name, logo, contact)
  - Appearance (theme, colors)
  - Currency formatting
  - Tax configuration
  - Shipping settings
  - Payment gateways (PayFast, Stripe, PayPal, Yoco, EFT)
  - Email/SMTP configuration
  - Social media links
- **License** - license activation and subscription management
- **Profile** - admin profile and password management

### Payment Gateways
- **PayFast** (South Africa) - with sandbox mode
- **Stripe** - global card payments
- **PayPal** - checkout integration
- **Yoco** (South Africa) - card payments
- **EFT/Bank Transfer** - manual payment

### Theme System
Three built-in themes with customizable colors:
- **Modern** - clean, minimal design
- **Classic** - traditional e-commerce layout
- **Minimalist** - ultra-clean, content-focused

### License Management
- 60-day free trial
- Central license server validation
- Domain tracking
- Auto-expiry with graceful degradation

## Requirements

- PHP 7.4 or higher
- SQLite3 extension
- cURL extension (for payment gateways and license validation)
- GD or ImageMagick extension (for image processing)

## Installation

1. **Upload files** to your hosting account's document root (public_html)

2. **Create data directory** with write permissions:
   ```bash
   mkdir data
   chmod 755 data
   ```

3. **Create uploads directory** with write permissions:
   ```bash
   mkdir -p uploads/products uploads/logo
   chmod -R 755 uploads
   ```

4. **Navigate to your domain** - the setup wizard will guide you through:
   - Database creation
   - Store name and details
   - Admin account creation
   - Payment gateway configuration
   - Theme selection

5. **Start selling!** Access your admin panel at `yourdomain.com/site-admin/`

## Directory Structure

```
xneelo-shop/
├── assets/
│   ├── css/
│   │   ├── main.css          # Core styles
│   │   └── themes/           # Theme variations
│   └── js/
│       └── main.js           # Frontend JavaScript
├── config/
│   ├── config.php            # Application configuration
│   └── database.php          # Database connection & schema
├── data/
│   └── shop.db               # SQLite database
├── includes/
│   ├── auth.php              # Authentication helpers
│   ├── functions.php         # Helper functions
│   ├── storefront-header.php # Storefront header/navigation
│   └── storefront-footer.php # Storefront footer
├── install/
│   └── index.php             # Setup wizard
├── models/
│   ├── AdminUser.php
│   ├── Category.php
│   ├── Coupon.php
│   ├── CreditNote.php
│   ├── Customer.php
│   ├── Invoice.php
│   ├── License.php
│   ├── Model.php             # Base model class
│   ├── Order.php
│   ├── Page.php
│   ├── Product.php
│   └── Setting.php
├── site-admin/
│   ├── includes/
│   │   ├── header.php        # Admin header/sidebar
│   │   └── footer.php        # Admin footer
│   ├── categories.php
│   ├── coupons.php
│   ├── customers.php
│   ├── index.php             # Dashboard
│   ├── invoices.php
│   ├── license.php
│   ├── login.php
│   ├── logout.php
│   ├── orders.php
│   ├── pages.php
│   ├── products.php
│   ├── profile.php
│   └── settings.php
├── uploads/
│   ├── logo/
│   └── products/
├── account.php               # Customer account dashboard
├── cart.php                  # Shopping cart
├── checkout.php              # Checkout process
├── forgot-password.php
├── index.php                 # Homepage
├── login.php                 # Customer login
├── logout.php                # Customer logout
├── order-confirmation.php    # Order receipt
├── order-view.php            # Single order detail
├── orders.php                # Customer order history
├── page.php                  # Custom page display
├── payment-callback.php      # Payment gateway callbacks
├── payment.php               # Payment initialization
├── product.php               # Product detail page
├── register.php              # Customer registration
├── reset-password.php
└── shop.php                  # Shop/catalog page
```

## Configuration

### Payment Gateway Setup

#### PayFast (South Africa)
1. Create account at payfast.co.za
2. Get Merchant ID, Merchant Key, and Passphrase
3. Enter in Settings → Payment → PayFast
4. Enable sandbox mode for testing

#### Stripe
1. Create account at stripe.com
2. Get Publishable Key and Secret Key
3. Enter in Settings → Payment → Stripe

#### PayPal
1. Create developer account at developer.paypal.com
2. Create app and get Client ID and Secret
3. Enter in Settings → Payment → PayPal

#### Yoco (South Africa)
1. Create account at yoco.com
2. Get Public Key and Secret Key
3. Enter in Settings → Payment → Yoco

#### EFT/Bank Transfer
1. Enter bank account details
2. Optionally add payment instructions
3. Orders will show as pending until manually marked paid

### SMTP Email Configuration

For transactional emails (order confirmations, password resets):

1. Go to Settings → Email
2. Enter SMTP details:
   - Host (e.g., smtp.gmail.com)
   - Port (587 for TLS, 465 for SSL)
   - Username
   - Password
   - Encryption type
3. Set From Name and From Email

## License

Xneelo Shop includes a 60-day free trial. After the trial:
- Store continues to function
- "Powered by Xneelo Shop" badge appears
- No software updates
- No priority support

To activate a license:
1. Purchase at shop.xneelo.com
2. Enter license key in Admin → License
3. Badge is removed and updates enabled

## Security Features

- CSRF protection on all forms
- Password hashing with PASSWORD_DEFAULT (bcrypt)
- SQL injection prevention via PDO prepared statements
- XSS prevention with output escaping
- Session security (httponly cookies, strict mode)
- Email enumeration prevention
- Admin/customer authentication separation

## Support

- Documentation: shop.xneelo.com/docs
- Email: support@xneelo.com
- Issues: github.com/xneelo/shop/issues

## Changelog

### v1.0.0
- Initial release
- Full e-commerce functionality
- 3 theme variations
- 5 payment gateways
- Comprehensive admin panel
- License management system
