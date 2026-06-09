-- HiFoode Database Initialization for MySQL
-- Safe to run on every startup: CREATE TABLE IF NOT EXISTS skips existing tables

SET FOREIGN_KEY_CHECKS = 0;

-- 1. country
CREATE TABLE IF NOT EXISTS country (
  id          VARCHAR(36) NOT NULL DEFAULT (UUID()),
  name        VARCHAR(255) NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- 2. state
CREATE TABLE IF NOT EXISTS state (
  id          VARCHAR(36) NOT NULL DEFAULT (UUID()),
  name        VARCHAR(255) NOT NULL,
  country_id  VARCHAR(36) NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (country_id) REFERENCES country(id),
  KEY idx_state_country_id (country_id)
);

-- 3. city
CREATE TABLE IF NOT EXISTS city (
  id          VARCHAR(36) NOT NULL DEFAULT (UUID()),
  name        VARCHAR(255) NOT NULL,
  state_id    VARCHAR(36) NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (state_id) REFERENCES state(id),
  KEY idx_city_state_id (state_id)
);

-- 4. regions
CREATE TABLE IF NOT EXISTS regions (
  id          VARCHAR(36) NOT NULL DEFAULT (UUID()),
  name        VARCHAR(255) NOT NULL,
  code        VARCHAR(255) NOT NULL UNIQUE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- 5. circles
CREATE TABLE IF NOT EXISTS circles (
  id          VARCHAR(36) NOT NULL DEFAULT (UUID()),
  area        VARCHAR(255) NOT NULL,
  pincode     VARCHAR(255) NOT NULL,
  latitude    DECIMAL(10,8),
  longitude   DECIMAL(11,8),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- 6. users
CREATE TABLE IF NOT EXISTS users (
  id              VARCHAR(36) NOT NULL DEFAULT (UUID()),
  admin_id        VARCHAR(36),
  sub_admin_id    VARCHAR(36),
  email           VARCHAR(255) NOT NULL UNIQUE,
  phone           VARCHAR(255) NOT NULL UNIQUE,
  password        TEXT NOT NULL,
  full_name       VARCHAR(255) NOT NULL,
  is_active       TINYINT(1) DEFAULT 1,
  permissions     JSON DEFAULT (JSON_OBJECT()),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at   DATETIME,
  images          JSON DEFAULT (JSON_ARRAY()),
  superadmin_id   VARCHAR(36),
  store_admin_id  VARCHAR(36),
  store_id        VARCHAR(36),
  role_name       ENUM('Admin', 'SuperAdmin', 'SubAdmin', 'StoreAdmin', 'Employee', 'Customer') NOT NULL DEFAULT 'Customer',
  account_status  VARCHAR(255) NOT NULL DEFAULT 'pending',
  circle_id       VARCHAR(36),
  token_version   INT NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  FOREIGN KEY (admin_id) REFERENCES users(id),
  FOREIGN KEY (sub_admin_id) REFERENCES users(id),
  FOREIGN KEY (superadmin_id) REFERENCES users(id),
  FOREIGN KEY (store_admin_id) REFERENCES users(id),
  FOREIGN KEY (store_id) REFERENCES stores(id),
  KEY idx_users_email (email),
  KEY idx_users_phone (phone),
  KEY idx_users_role_name (role_name),
  KEY idx_users_is_active (is_active),
  KEY idx_users_account_status (account_status),
  KEY idx_users_admin_id (admin_id),
  KEY idx_users_sub_admin_id (sub_admin_id),
  KEY idx_users_superadmin_id (superadmin_id),
  KEY idx_users_store_admin_id (store_admin_id),
  KEY idx_users_store_id (store_id),
  KEY idx_users_is_active_account_status (is_active, account_status),
  KEY idx_users_circle_id (circle_id)
);

-- 7. roles
CREATE TABLE IF NOT EXISTS roles (
  id          VARCHAR(36) NOT NULL DEFAULT (UUID()),
  name        ENUM('Admin', 'SuperAdmin', 'SubAdmin', 'StoreAdmin', 'Employee', 'Customer') NOT NULL UNIQUE,
  description TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- 8. user_otps
CREATE TABLE IF NOT EXISTS user_otps (
  id          VARCHAR(36) NOT NULL DEFAULT (UUID()),
  user_id     VARCHAR(36) NOT NULL,
  otp         VARCHAR(255) NOT NULL,
  expires_at  DATETIME NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  KEY idx_user_otps_user_id (user_id),
  KEY idx_user_otps_expires_at (expires_at)
);

-- 9. stores
CREATE TABLE IF NOT EXISTS stores (
  id              VARCHAR(36) NOT NULL DEFAULT (UUID()),
  name            VARCHAR(255) NOT NULL,
  type            VARCHAR(255) NOT NULL,
  region_id       VARCHAR(36) NOT NULL,
  address_line1   VARCHAR(255) NOT NULL,
  address_line2   VARCHAR(255),
  city            VARCHAR(255) NOT NULL,
  state           VARCHAR(255) NOT NULL,
  postal_code     TEXT NOT NULL,
  latitude        DECIMAL(10,8),
  longitude       DECIMAL(11,8),
  opening_time    TIME NOT NULL,
  closing_time    TIME NOT NULL,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  store_admin_id  VARCHAR(36) NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (region_id) REFERENCES regions(id),
  FOREIGN KEY (store_admin_id) REFERENCES users(id),
  KEY idx_stores_region_id (region_id),
  KEY idx_stores_store_admin_id (store_admin_id),
  KEY idx_stores_is_active (is_active)
);

-- 10. addresses
CREATE TABLE IF NOT EXISTS addresses (
  id          VARCHAR(36) NOT NULL DEFAULT (UUID()),
  user_id     VARCHAR(36) NOT NULL,
  label       VARCHAR(255),
  line1       TEXT NOT NULL,
  line2       TEXT,
  postal_code VARCHAR(255),
  country_id  VARCHAR(255),
  state_id    VARCHAR(255),
  city_id     VARCHAR(255),
  latitude    DECIMAL(10,8),
  longitude   DECIMAL(11,8),
  is_default  TINYINT(1) DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_addresses_user_id (user_id),
  KEY idx_addresses_user_default (user_id, is_default)
);

-- 11. sub_admin_regions
CREATE TABLE IF NOT EXISTS sub_admin_regions (
  id          VARCHAR(36) NOT NULL DEFAULT (UUID()),
  user_id     VARCHAR(36) NOT NULL,
  region_id   VARCHAR(36) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (region_id) REFERENCES regions(id),
  KEY idx_sub_admin_regions_user_id (user_id),
  KEY idx_sub_admin_regions_region_id (region_id)
);

-- 12. categories
CREATE TABLE IF NOT EXISTS categories (
  id          VARCHAR(36) NOT NULL DEFAULT (UUID()),
  name        VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  images      JSON DEFAULT (JSON_ARRAY()),
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  type        ENUM('all', 'food', 'grocery', 'bakery') NOT NULL DEFAULT 'all',
  created_by  VARCHAR(36) NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  KEY idx_categories_is_active (is_active)
);

-- 13. subcategories
CREATE TABLE IF NOT EXISTS subcategories (
  id           VARCHAR(36) NOT NULL DEFAULT (UUID()),
  category_id  VARCHAR(36) NOT NULL,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  images       JSON DEFAULT (JSON_ARRAY()),
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by   VARCHAR(36),
  PRIMARY KEY (id),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  KEY idx_subcategories_category_id (category_id),
  KEY idx_subcategories_is_active (is_active),
  KEY idx_subcategories_created_by (created_by)
);

-- 14. variants
CREATE TABLE IF NOT EXISTS variants (
  id           VARCHAR(36) NOT NULL DEFAULT (UUID()),
  name         VARCHAR(255) NOT NULL UNIQUE,
  description  TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  category_id  VARCHAR(36),
  PRIMARY KEY (id),
  KEY idx_variants_category_id (category_id)
);

-- 15. templates
CREATE TABLE IF NOT EXISTS templates (
  id          VARCHAR(36) NOT NULL DEFAULT (UUID()),
  name        VARCHAR(255) NOT NULL UNIQUE,
  is_global   TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by  VARCHAR(36) NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

-- 17. brands
CREATE TABLE IF NOT EXISTS brands (
  id              VARCHAR(36) NOT NULL DEFAULT (UUID()),
  category_id     VARCHAR(36),
  subcategory_id  VARCHAR(36),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_brands_category_id (category_id),
  KEY idx_brands_subcategory_id (subcategory_id),
  KEY idx_brands_is_active (is_active)
);

-- 18. products
CREATE TABLE IF NOT EXISTS products (
  id               VARCHAR(36) NOT NULL DEFAULT (UUID()),
  store_id         VARCHAR(36) NOT NULL,
  category_id      VARCHAR(36),
  subcategory_id   VARCHAR(36),
  brand_id         VARCHAR(36),
  template_id      VARCHAR(36),
  variant_id       JSON,
  quantity         INT NOT NULL DEFAULT 0,
  name             VARCHAR(255) NOT NULL,
  description      TEXT,
  sku              VARCHAR(255) UNIQUE,
  base_price       DECIMAL(10,4) NOT NULL,
  images           JSON DEFAULT (JSON_ARRAY()),
  is_veg           TINYINT(1),
  dietary_tags     JSON,
  is_active        TINYINT(1) NOT NULL DEFAULT 1,
  approval_status  ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  approved_by      VARCHAR(36),
  approved_at      DATETIME,
  changed_by       VARCHAR(36),
  change_type      VARCHAR(255),
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  rejected_by      VARCHAR(36),
  rejected_at      DATETIME,
  PRIMARY KEY (id),
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (brand_id) REFERENCES brands(id),
  FOREIGN KEY (template_id) REFERENCES templates(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (changed_by) REFERENCES users(id),
  FOREIGN KEY (rejected_by) REFERENCES users(id),
  KEY idx_products_store_id (store_id),
  KEY idx_products_category_id (category_id),
  KEY idx_products_subcategory_id (subcategory_id),
  KEY idx_products_brand_id (brand_id),
  KEY idx_products_is_active (is_active),
  KEY idx_products_approval_status (approval_status),
  KEY idx_products_store_active_approval (store_id, is_active, approval_status)
);

-- 19. inventory
CREATE TABLE IF NOT EXISTS inventory (
  id                VARCHAR(36) NOT NULL DEFAULT (UUID()),
  product_id        VARCHAR(36) NOT NULL UNIQUE,
  current_stock     INT NOT NULL DEFAULT 0,
  stock_threshold   INT NOT NULL DEFAULT 0,
  is_out_of_stock   TINYINT(1) NOT NULL DEFAULT 0,
  restock_daily     TINYINT(1) NOT NULL DEFAULT 0,
  last_restocked_at DATETIME,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  KEY idx_inventory_is_out_of_stock (is_out_of_stock)
);

-- 20. product_change_logs
CREATE TABLE IF NOT EXISTS product_change_logs (
  id           VARCHAR(36) NOT NULL DEFAULT (UUID()),
  product_id   VARCHAR(36) NOT NULL,
  changed_by   VARCHAR(36) NOT NULL,
  change_type  VARCHAR(255) NOT NULL,
  old_value    JSON,
  new_value    JSON,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (changed_by) REFERENCES users(id),
  KEY idx_pcl_product_id (product_id),
  KEY idx_pcl_changed_by (changed_by),
  KEY idx_pcl_created_at (created_at DESC)
);

-- 21. time_slots
CREATE TABLE IF NOT EXISTS time_slots (
  id               VARCHAR(36) NOT NULL DEFAULT (UUID()),
  name             VARCHAR(255) NOT NULL,
  code             VARCHAR(255) NOT NULL UNIQUE,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  is_active        TINYINT(1) NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  normalized_name  TEXT,
  normalized_code  TEXT,
  PRIMARY KEY (id)
);

-- 22. menus
CREATE TABLE IF NOT EXISTS menus (
  id            VARCHAR(36) NOT NULL DEFAULT (UUID()),
  store_id      VARCHAR(36) NOT NULL,
  product_id    JSON NOT NULL,
  date          DATE,
  weekday       INT,
  time_slot_id  VARCHAR(36) NOT NULL,
  status        VARCHAR(255) NOT NULL DEFAULT 'PENDING',
  submitted_by  VARCHAR(36) NOT NULL,
  notes         TEXT,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  approved_by   VARCHAR(36),
  approved_at   DATETIME,
  rejected_by   VARCHAR(36),
  rejected_at   DATETIME,
  pending_products JSON,
  revision_count INT NOT NULL DEFAULT 0,
  unavailable_items JSON,
  PRIMARY KEY (id),
  FOREIGN KEY (submitted_by) REFERENCES users(id),
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (time_slot_id) REFERENCES time_slots(id),
  KEY idx_menus_store_id (store_id),
  KEY idx_menus_time_slot_id (time_slot_id),
  KEY idx_menus_status (status),
  KEY idx_menus_date (date),
  KEY idx_menus_weekday (weekday),
  KEY idx_menus_store_date_slot (store_id, date, time_slot_id)
);

-- 23. party
CREATE TABLE IF NOT EXISTS party (
  id                VARCHAR(36) NOT NULL DEFAULT (UUID()),
  store_id          VARCHAR(36) NOT NULL,
  template_id       VARCHAR(36) NOT NULL,
  product_id        JSON,
  status            VARCHAR(255) NOT NULL DEFAULT 'PENDING',
  submitted_by      VARCHAR(36) NOT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  approved_by       VARCHAR(36),
  approved_at       DATETIME,
  rejected_by       VARCHAR(36),
  rejected_at       DATETIME,
  revision_count    INT NOT NULL DEFAULT 0,
  unavailable_items JSON,
  PRIMARY KEY (id),
  FOREIGN KEY (submitted_by) REFERENCES users(id),
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (template_id) REFERENCES templates(id)
);

-- 24. carts
CREATE TABLE IF NOT EXISTS carts (
  id          VARCHAR(36) NOT NULL DEFAULT (UUID()),
  user_id     VARCHAR(36) NOT NULL,
  store_id    VARCHAR(36) NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (store_id) REFERENCES stores(id),
  KEY idx_carts_user_id (user_id),
  KEY idx_carts_store_id (store_id),
  KEY idx_carts_user_store (user_id, store_id)
);

-- 25. cart_items
CREATE TABLE IF NOT EXISTS cart_items (
  id          VARCHAR(36) NOT NULL DEFAULT (UUID()),
  cart_id     VARCHAR(36) NOT NULL,
  product_id  VARCHAR(36) NOT NULL,
  menus_id    VARCHAR(36),
  quantity    INT NOT NULL,
  unit_price  DECIMAL(10,4) NOT NULL,
  subtotal    DECIMAL(10,4),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (cart_id) REFERENCES carts(id),
  FOREIGN KEY (menus_id) REFERENCES menus(id),
  KEY idx_cart_items_cart_id (cart_id),
  KEY idx_cart_items_product_id (product_id),
  KEY idx_cart_items_menus_id (menus_id)
);

-- 26. orders
CREATE TABLE IF NOT EXISTS orders (
  id                    VARCHAR(36) NOT NULL DEFAULT (UUID()),
  order_number          VARCHAR(255) NOT NULL UNIQUE,
  user_id               VARCHAR(36) NOT NULL,
  store_id              VARCHAR(36) NOT NULL,
  address_id            VARCHAR(36) NOT NULL,
  subtotal_amount       DECIMAL(10,4) NOT NULL,
  tax_amount            DECIMAL(10,4) DEFAULT 0,
  delivery_fee          DECIMAL(10,4) DEFAULT 0,
  discount_amount       DECIMAL(10,4) DEFAULT 0,
  total_amount          DECIMAL(10,4) NOT NULL,
  payment_status        VARCHAR(255) NOT NULL,
  order_status          VARCHAR(255) NOT NULL,
  scheduled_delivery_at DATETIME,
  is_subscription_order TINYINT(1) DEFAULT 0,
  eta_minutes           INT,
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  circle_id             VARCHAR(36),
  approval_status       ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  approved_by           VARCHAR(36),
  approved_at           DATETIME,
  rejected_by           VARCHAR(36),
  rejected_at           DATETIME,
  PRIMARY KEY (id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (rejected_by) REFERENCES users(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (address_id) REFERENCES addresses(id),
  KEY idx_orders_order_number (order_number),
  KEY idx_orders_user_id (user_id),
  KEY idx_orders_store_id (store_id),
  KEY idx_orders_address_id (address_id),
  KEY idx_orders_circle_id (circle_id),
  KEY idx_orders_order_status (order_status),
  KEY idx_orders_payment_status (payment_status),
  KEY idx_orders_approval_status (approval_status),
  KEY idx_orders_created_at (created_at DESC),
  KEY idx_orders_user_status_created (user_id, order_status, created_at DESC)
);

-- 27. order_items
CREATE TABLE IF NOT EXISTS order_items (
  id            VARCHAR(36) NOT NULL DEFAULT (UUID()),
  order_id      VARCHAR(36) NOT NULL,
  product_id    VARCHAR(36),
  menus_id      VARCHAR(36),
  quantity      INT NOT NULL,
  unit_price    DECIMAL(10,4) NOT NULL,
  total_price   DECIMAL(10,4),
  is_food       TINYINT(1) NOT NULL DEFAULT 0,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  product_name  TEXT,
  store_id      VARCHAR(36),
  PRIMARY KEY (id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (menus_id) REFERENCES menus(id),
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL,
  KEY idx_order_items_order_id (order_id),
  KEY idx_order_items_product_id (product_id),
  KEY idx_order_items_menus_id (menus_id),
  KEY idx_order_items_store_id (store_id)
);

-- 28. order_status_history
CREATE TABLE IF NOT EXISTS order_status_history (
  id           VARCHAR(36) NOT NULL DEFAULT (UUID()),
  order_id     VARCHAR(36) NOT NULL,
  from_status  VARCHAR(255),
  to_status    VARCHAR(255) NOT NULL,
  changed_by   VARCHAR(36),
  note         TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (changed_by) REFERENCES users(id),
  KEY idx_osh_order_id (order_id),
  KEY idx_osh_changed_by (changed_by),
  KEY idx_osh_created_at (created_at DESC)
);

-- 29. delivery_partners
CREATE TABLE IF NOT EXISTS delivery_partners (
  id            VARCHAR(36) NOT NULL DEFAULT (UUID()),
  user_id       VARCHAR(36) NOT NULL,
  vehicle_type  ENUM('BIKE', 'CAR'),
  is_active     TINYINT(1) DEFAULT 1,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  KEY idx_delivery_partners_user_id (user_id),
  KEY idx_delivery_partners_is_active (is_active)
);

-- 30. order_delivery_assignments
CREATE TABLE IF NOT EXISTS order_delivery_assignments (
  id                   VARCHAR(36) NOT NULL DEFAULT (UUID()),
  order_id             VARCHAR(36) NOT NULL,
  delivery_partner_id  VARCHAR(36) NOT NULL,
  assigned_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  picked_at            DATETIME,
  delivered_at         DATETIME,
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (delivery_partner_id) REFERENCES delivery_partners(id),
  KEY idx_oda_order_id (order_id),
  KEY idx_oda_delivery_partner_id (delivery_partner_id)
);

-- 31. delivery_locations
CREATE TABLE IF NOT EXISTS delivery_locations (
  id                   VARCHAR(36) NOT NULL DEFAULT (UUID()),
  delivery_partner_id  VARCHAR(36) NOT NULL,
  order_id             VARCHAR(36),
  latitude             DECIMAL(10,8) NOT NULL,
  longitude            DECIMAL(11,8) NOT NULL,
  recorded_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (delivery_partner_id) REFERENCES delivery_partners(id),
  KEY idx_dl_delivery_partner_id (delivery_partner_id),
  KEY idx_dl_order_id (order_id),
  KEY idx_dl_recorded_at (recorded_at DESC),
  KEY idx_dl_partner_order_recorded (delivery_partner_id, order_id, recorded_at DESC)
);

-- 32. delivery_zones
CREATE TABLE IF NOT EXISTS delivery_zones (
  id                VARCHAR(36) NOT NULL DEFAULT (UUID()),
  store_id          VARCHAR(36) NOT NULL,
  max_radius_km     DECIMAL(10,4) NOT NULL,
  base_delivery_fee DECIMAL(10,4) NOT NULL,
  per_km_fee        DECIMAL(10,4),
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (store_id) REFERENCES stores(id),
  KEY idx_delivery_zones_store_id (store_id)
);

-- 33. subscription_plans
CREATE TABLE IF NOT EXISTS subscription_plans (
  id                    VARCHAR(36) NOT NULL DEFAULT (UUID()),
  name                  VARCHAR(255) NOT NULL,
  description           TEXT,
  max_deliveries        INT NOT NULL,
  period_type           ENUM('WEEKLY', 'MONTHLY') NOT NULL,
  price                 DECIMAL(10,4) NOT NULL,
  max_radius_km         DECIMAL(10,4),
  free_trial_deliveries INT DEFAULT 3,
  is_active             TINYINT(1) DEFAULT 1,
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- 34. user_subscriptions
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id                    VARCHAR(36) NOT NULL DEFAULT (UUID()),
  user_id               VARCHAR(36) NOT NULL,
  subscription_plan_id  VARCHAR(36) NOT NULL,
  start_date            DATE NOT NULL,
  end_date              DATE NOT NULL,
  remaining_deliveries  INT NOT NULL,
  status                ENUM('ACTIVE', 'EXPIRED', 'CANCELLED') DEFAULT 'ACTIVE',
  is_trial              TINYINT(1) DEFAULT 0,
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (subscription_plan_id) REFERENCES subscription_plans(id),
  KEY idx_user_subs_user_id (user_id),
  KEY idx_user_subs_plan_id (subscription_plan_id),
  KEY idx_user_subs_status (status),
  KEY idx_user_subs_user_status (user_id, status)
);

-- 35. subscription_deliveries
CREATE TABLE IF NOT EXISTS subscription_deliveries (
  id                    VARCHAR(36) NOT NULL DEFAULT (UUID()),
  user_subscription_id  VARCHAR(36) NOT NULL,
  order_id              VARCHAR(36) NOT NULL,
  is_trial_delivery     TINYINT(1) DEFAULT 0,
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (user_subscription_id) REFERENCES user_subscriptions(id),
  KEY idx_sub_deliveries_user_sub_id (user_subscription_id),
  KEY idx_sub_deliveries_order_id (order_id)
);

-- 36. payment_methods
CREATE TABLE IF NOT EXISTS payment_methods (
  id               VARCHAR(36) NOT NULL DEFAULT (UUID()),
  user_id          VARCHAR(36) NOT NULL,
  provider         VARCHAR(255) NOT NULL,
  token_reference  VARCHAR(255) NOT NULL,
  method_type      VARCHAR(255) NOT NULL,
  last4            VARCHAR(255),
  is_default       TINYINT(1) NOT NULL DEFAULT 0,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  KEY idx_payment_methods_user_id (user_id)
);

-- 37. payments
CREATE TABLE IF NOT EXISTS payments (
  id                  VARCHAR(36) NOT NULL DEFAULT (UUID()),
  order_id            VARCHAR(36) NOT NULL,
  provider_payment_id VARCHAR(255),
  amount              DECIMAL(10,4) NOT NULL,
  currency            VARCHAR(255) NOT NULL DEFAULT 'INR',
  status              VARCHAR(255) NOT NULL DEFAULT 'PENDING',
  payment_method_id   VARCHAR(36),
  raw_response        JSON,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL,
  KEY idx_payments_order_id (order_id),
  KEY idx_payments_payment_method_id (payment_method_id),
  KEY idx_payments_status (status)
);

-- 38. refunds
CREATE TABLE IF NOT EXISTS refunds (
  id                  VARCHAR(36) NOT NULL DEFAULT (UUID()),
  payment_id          VARCHAR(36) NOT NULL,
  provider_refund_id  VARCHAR(255),
  amount              DECIMAL(10,4) NOT NULL,
  reason              VARCHAR(255),
  status              ENUM('PENDING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'PENDING',
  raw_response        JSON,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (payment_id) REFERENCES payments(id),
  KEY idx_refunds_payment_id (payment_id),
  KEY idx_refunds_status (status)
);

-- 39. notification_channel
CREATE TABLE IF NOT EXISTS notification_channel (
  id          VARCHAR(36) NOT NULL DEFAULT (UUID()),
  name        VARCHAR(255) NOT NULL UNIQUE,
  provider    VARCHAR(255) NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- 40. notifications
CREATE TABLE IF NOT EXISTS notifications (
  id             VARCHAR(36) NOT NULL DEFAULT (UUID()),
  user_id        VARCHAR(36) NOT NULL,
  template_code  VARCHAR(255),
  payload        JSON NOT NULL,
  status         ENUM('PENDING', 'SENT', 'READ', 'FAILED') DEFAULT 'PENDING',
  error_message  TEXT,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  sent_at        DATETIME,
  channel        VARCHAR(36) NOT NULL,
  updated_at     DATETIME,
  PRIMARY KEY (id),
  FOREIGN KEY (channel) REFERENCES notification_channel(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  KEY idx_notifications_user_id (user_id),
  KEY idx_notifications_status (status),
  KEY idx_notifications_channel (channel),
  KEY idx_notifications_created_at (created_at DESC),
  KEY idx_notifications_user_status (user_id, status)
);

-- 41. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id           VARCHAR(36) NOT NULL DEFAULT (UUID()),
  user_id      VARCHAR(36),
  entity_type  VARCHAR(255) NOT NULL,
  entity_id    VARCHAR(36),
  action       VARCHAR(255) NOT NULL,
  metadata     JSON NOT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  KEY idx_audit_logs_user_id (user_id),
  KEY idx_audit_logs_entity_type (entity_type),
  KEY idx_audit_logs_entity_id (entity_id),
  KEY idx_audit_logs_created_at (created_at DESC),
  KEY idx_audit_logs_entity_type_id (entity_type, entity_id)
);

-- Seed Notification Channels
INSERT IGNORE INTO notification_channel (id, name, provider)
VALUES 
  (UUID(), 'MAILGUN', 'Mailgun'),
  (UUID(), 'CLICKSEND', 'ClickSend'),
  (UUID(), 'TWILIO', 'Twilio'),
  (UUID(), 'IN_APP', 'InApp');

SET FOREIGN_KEY_CHECKS = 1;
