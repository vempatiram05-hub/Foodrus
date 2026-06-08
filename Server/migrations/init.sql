-- HiFoode Database Initialization
-- Safe to run on every startup: CREATE IF NOT EXISTS skips existing objects

-- ─────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────
-- Enum Types (skipped if already exist)
-- ─────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE role_name AS ENUM ('Admin', 'SuperAdmin', 'SubAdmin', 'StoreAdmin', 'Employee', 'Customer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE order_approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE product_approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────
-- 1. country
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.country (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  name        character varying NOT NULL,
  created_at  timestamp with time zone DEFAULT now(),
  updated_at  timestamp with time zone DEFAULT now(),
  CONSTRAINT country_pkey PRIMARY KEY (id)
);

-- ─────────────────────────────────────────
-- 2. state
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.state (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  name        character varying NOT NULL,
  country_id  uuid NOT NULL,
  created_at  timestamp with time zone DEFAULT now(),
  updated_at  timestamp with time zone DEFAULT now(),
  CONSTRAINT state_pkey PRIMARY KEY (id),
  CONSTRAINT state_country_fk FOREIGN KEY (country_id) REFERENCES public.country(id)
);

-- ─────────────────────────────────────────
-- 3. city
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.city (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  name        character varying NOT NULL,
  state_id    uuid NOT NULL,
  created_at  timestamp with time zone DEFAULT now(),
  updated_at  timestamp with time zone DEFAULT now(),
  CONSTRAINT city_pkey PRIMARY KEY (id),
  CONSTRAINT city_state_fk FOREIGN KEY (state_id) REFERENCES public.state(id)
);

-- ─────────────────────────────────────────
-- 4. regions
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.regions (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  name        character varying NOT NULL,
  code        character varying NOT NULL UNIQUE,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT regions_pkey PRIMARY KEY (id)
);

-- ─────────────────────────────────────────
-- 5. circles
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.circles (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  area        character varying NOT NULL,
  pincode     character varying NOT NULL,
  latitude    numeric,
  longitude   numeric,
  created_at  timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT circles_pkey PRIMARY KEY (id)
);

-- ─────────────────────────────────────────
-- 6. users  (self-referential FKs are valid in PostgreSQL)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_id        uuid,
  sub_admin_id    uuid,
  email           character varying NOT NULL UNIQUE
                    CHECK (email::text ~* '^[^@]+@[^@]+\.[^@]+$'::text),
  phone           character varying NOT NULL UNIQUE
                    CHECK (phone::text ~ '^\+[1-9][0-9]{7,14}$'::text),
  password        text NOT NULL,
  full_name       character varying NOT NULL,
  is_active       boolean DEFAULT true,
  permissions     jsonb DEFAULT '{}'::jsonb,
  created_at      timestamp without time zone DEFAULT now(),
  updated_at      timestamp without time zone DEFAULT now(),
  last_login_at   timestamp without time zone,
  images          jsonb NOT NULL DEFAULT '[]'::jsonb,
  superadmin_id   uuid,
  store_admin_id  uuid,
  store_id        uuid,
  role_name       role_name NOT NULL DEFAULT 'Customer'::role_name,
  account_status  character varying NOT NULL DEFAULT 'pending'::character varying,
  circle_id       uuid,
  token_version   integer NOT NULL DEFAULT 1,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT fk_admin                  FOREIGN KEY (admin_id)       REFERENCES public.users(id),
  CONSTRAINT fk_sub_admin              FOREIGN KEY (sub_admin_id)   REFERENCES public.users(id),
  CONSTRAINT users_superadmin_id_fkey  FOREIGN KEY (superadmin_id)  REFERENCES public.users(id),
  CONSTRAINT users_store_admin_id_fkey FOREIGN KEY (store_admin_id) REFERENCES public.users(id)
);

-- ─────────────────────────────────────────
-- 7. roles
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.roles (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  name        role_name NOT NULL UNIQUE,
  description text,
  created_at  timestamp without time zone DEFAULT now(),
  updated_at  timestamp without time zone DEFAULT now(),
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);

-- ─────────────────────────────────────────
-- 8. user_otps
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_otps (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  otp         character varying NOT NULL,
  expires_at  timestamp with time zone NOT NULL,
  created_at  timestamp with time zone DEFAULT now(),
  CONSTRAINT user_otps_pkey PRIMARY KEY (id),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- ─────────────────────────────────────────
-- 9. stores
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stores (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  name            character varying NOT NULL,
  type            character varying NOT NULL,
  region_id       uuid NOT NULL,
  address_line1   character varying NOT NULL,
  address_line2   character varying,
  city            character varying NOT NULL,
  state           character varying NOT NULL,
  postal_code     text NOT NULL,
  latitude        numeric,
  longitude       numeric,
  opening_time    time without time zone NOT NULL,
  closing_time    time without time zone NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamp with time zone NOT NULL DEFAULT now(),
  updated_at      timestamp with time zone NOT NULL DEFAULT now(),
  store_admin_id  uuid NOT NULL,
  CONSTRAINT stores_pkey PRIMARY KEY (id),
  CONSTRAINT fk_region FOREIGN KEY (region_id) REFERENCES public.regions(id),
  CONSTRAINT stores_store_admin_id_fkey FOREIGN KEY (store_admin_id) REFERENCES public.users(id)
);

-- Add store_id FK from users to stores (after stores table exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'users_store_id_fkey'
      AND table_name = 'users'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_store_id_fkey
      FOREIGN KEY (store_id) REFERENCES public.stores(id);
  END IF;
END;
$$;

-- ─────────────────────────────────────────
-- 10. addresses
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.addresses (
  id          uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL,
  label       character varying,
  line1       text NOT NULL,
  line2       text,
  postal_code character varying,
  country_id  character varying,
  state_id    character varying,
  city_id     character varying,
  latitude    numeric,
  longitude   numeric,
  is_default  boolean DEFAULT false,
  created_at  timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at  timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT addresses_pkey PRIMARY KEY (id)
);

-- ─────────────────────────────────────────
-- 11. sub_admin_regions
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sub_admin_regions (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  region_id   uuid NOT NULL,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sub_admin_regions_pkey PRIMARY KEY (id),
  CONSTRAINT sub_admin_regions_user_id_fkey   FOREIGN KEY (user_id)   REFERENCES public.users(id),
  CONSTRAINT sub_admin_regions_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id)
);

-- ─────────────────────────────────────────
-- 12. categories
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categories (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  images      jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  type        text NOT NULL DEFAULT 'all' CHECK (type IN ('all', 'food', 'grocery', 'bakery')),
  created_by  uuid NOT NULL,
  CONSTRAINT categories_pkey PRIMARY KEY (id),
  CONSTRAINT categories_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.users(id) ON DELETE RESTRICT
);

-- Unique index on name only (store_id no longer exists on this table).
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_unique
  ON public.categories (name);

-- ─────────────────────────────────────────
-- 13. subcategories
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subcategories (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  category_id  uuid NOT NULL,
  name         text NOT NULL,
  description  text,
  images       jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  updated_at   timestamp with time zone NOT NULL DEFAULT now(),
  created_by   uuid,
  CONSTRAINT subcategories_pkey PRIMARY KEY (id),
  CONSTRAINT subcategories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT subcategories_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT
);

-- ─────────────────────────────────────────
-- 14. variants
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.variants (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  name         character varying NOT NULL UNIQUE,
  description  text,
  created_at   timestamp with time zone DEFAULT now(),
  updated_at   timestamp with time zone DEFAULT now(),
  category_id  uuid,
  CONSTRAINT variants_pkey PRIMARY KEY (id)
);

-- ─────────────────────────────────────────
-- 15. templates
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.templates (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  is_global   boolean NOT NULL DEFAULT false,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  created_by  uuid NOT NULL,
  CONSTRAINT templates_pkey PRIMARY KEY (id),
  CONSTRAINT templates_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.users(id) ON DELETE RESTRICT
);

-- Template name must be unique globally
CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_name_unique
  ON public.templates (name);

-- ─────────────────────────────────────────
-- 17. brands
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.brands (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  category_id     uuid,
  subcategory_id  uuid,
  name            text NOT NULL,
  description     text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamp with time zone NOT NULL DEFAULT now(),
  updated_at      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT brands_pkey PRIMARY KEY (id)
);

-- ─────────────────────────────────────────
-- 18. products
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id         uuid NOT NULL,
  category_id      uuid,
  subcategory_id   uuid,
  brand_id         uuid,
  template_id      uuid,
  variant_id       uuid[],
  quantity         integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  name             character varying NOT NULL,
  description      text,
  sku              character varying UNIQUE,
  base_price       numeric NOT NULL CHECK (base_price >= 0::numeric),
  images           jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_veg           boolean,
  dietary_tags     text[],
  is_active        boolean NOT NULL DEFAULT true,
  approval_status  product_approval_status NOT NULL DEFAULT 'PENDING'::product_approval_status,
  approved_by      uuid,
  approved_at      timestamp with time zone,
  changed_by       uuid,
  change_type      character varying,
  created_at       timestamp with time zone NOT NULL DEFAULT now(),
  updated_at       timestamp with time zone NOT NULL DEFAULT now(),
  rejected_by      uuid,
  rejected_at      timestamp with time zone,
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_store_id_fkey    FOREIGN KEY (store_id)    REFERENCES public.stores(id),
  CONSTRAINT products_brand_id_fkey    FOREIGN KEY (brand_id)    REFERENCES public.brands(id),
  CONSTRAINT products_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id),
  CONSTRAINT products_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id),
  CONSTRAINT products_changed_by_fkey  FOREIGN KEY (changed_by)  REFERENCES public.users(id),
  CONSTRAINT products_rejected_by_fkey FOREIGN KEY (rejected_by) REFERENCES public.users(id)
);

-- ─────────────────────────────────────────
-- 17. inventory
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory (
  id                uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id        uuid NOT NULL UNIQUE,
  current_stock     integer NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  stock_threshold   integer NOT NULL DEFAULT 0 CHECK (stock_threshold >= 0),
  is_out_of_stock   boolean NOT NULL DEFAULT false,
  restock_daily     boolean NOT NULL DEFAULT false,
  last_restocked_at timestamp with time zone,
  created_at        timestamp with time zone NOT NULL DEFAULT now(),
  updated_at        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT inventory_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

-- ─────────────────────────────────────────
-- 18. product_change_logs
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_change_logs (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id   uuid NOT NULL,
  changed_by   uuid NOT NULL,
  change_type  character varying NOT NULL
                 CHECK (change_type::text = ANY (ARRAY['PRICE_UPDATE'::character varying, 'STOCK_UPDATE'::character varying, 'DESCRIPTION_UPDATE'::character varying, 'OTHER'::character varying]::text[])),
  old_value    jsonb,
  new_value    jsonb,
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_change_logs_pkey PRIMARY KEY (id),
  CONSTRAINT product_change_logs_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT product_change_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id)
);

-- ─────────────────────────────────────────
-- 19. time_slots
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.time_slots (
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  name             character varying NOT NULL,
  code             character varying NOT NULL UNIQUE,
  start_time       time without time zone NOT NULL,
  end_time         time without time zone NOT NULL,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamp with time zone NOT NULL DEFAULT now(),
  updated_at       timestamp with time zone NOT NULL DEFAULT now(),
  normalized_name  text,
  normalized_code  text,
  CONSTRAINT time_slots_pkey PRIMARY KEY (id)
);

-- ─────────────────────────────────────────
-- 20. menus
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.menus (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id      uuid NOT NULL,
  product_id    uuid[] NOT NULL,
  date          date,
  weekday       integer,
  time_slot_id  uuid NOT NULL,
  status        character varying NOT NULL DEFAULT 'PENDING'::character varying,
  submitted_by  uuid NOT NULL,
  notes         text,
  created_at    timestamp with time zone NOT NULL DEFAULT now(),
  updated_at    timestamp with time zone NOT NULL DEFAULT now(),
  approved_by   uuid,
  approved_at   timestamp with time zone,
  rejected_by   uuid,
  rejected_at       timestamp with time zone,
  pending_products  uuid[],
  revision_count    integer NOT NULL DEFAULT 0,
  unavailable_items uuid[],
  CONSTRAINT menus_pkey PRIMARY KEY (id),
  CONSTRAINT menus_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id),
  CONSTRAINT menus_store_id_fkey     FOREIGN KEY (store_id)     REFERENCES public.stores(id),
  CONSTRAINT menus_time_slot_id_fkey FOREIGN KEY (time_slot_id) REFERENCES public.time_slots(id)
);


-- ─────────────────────────────────────────
-- 20. party
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.party (
  id                uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id          uuid NOT NULL,
  template_id       uuid NOT NULL,
  product_id        uuid[],
  status            character varying NOT NULL DEFAULT 'PENDING'::character varying,
  submitted_by      uuid NOT NULL,
  created_at        timestamp with time zone NOT NULL DEFAULT now(),
  updated_at        timestamp with time zone NOT NULL DEFAULT now(),
  approved_by       uuid,
  approved_at       timestamp with time zone,
  rejected_by       uuid,
  rejected_at       timestamp with time zone,
  revision_count    integer NOT NULL DEFAULT 0,
  unavailable_items uuid[],
  CONSTRAINT party_pkey PRIMARY KEY (id),
  CONSTRAINT party_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id),
  CONSTRAINT party_store_id_fkey     FOREIGN KEY (store_id)     REFERENCES public.stores(id),
  CONSTRAINT party_template_id_fkey  FOREIGN KEY (template_id)  REFERENCES public.templates(id)
);

-- ─────────────────────────────────────────
-- 21. carts
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.carts (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  store_id    uuid NOT NULL,
  created_at  timestamp with time zone DEFAULT now(),
  updated_at  timestamp with time zone DEFAULT now(),
  CONSTRAINT carts_pkey PRIMARY KEY (id),
  CONSTRAINT carts_user_id_fkey  FOREIGN KEY (user_id)  REFERENCES public.users(id),
  CONSTRAINT carts_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id)
);

-- ─────────────────────────────────────────
-- 22. cart_items
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cart_items (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  cart_id     uuid NOT NULL,
  product_id  uuid NOT NULL,
  menus_id    uuid,
  quantity    integer NOT NULL CHECK (quantity > 0),
  unit_price  numeric NOT NULL,
  subtotal    numeric,
  created_at  timestamp with time zone DEFAULT now(),
  updated_at  timestamp with time zone DEFAULT now(),
  CONSTRAINT cart_items_pkey PRIMARY KEY (id),
  CONSTRAINT cart_items_cart_id_fkey  FOREIGN KEY (cart_id)  REFERENCES public.carts(id),
  CONSTRAINT cart_items_menus_id_fkey FOREIGN KEY (menus_id) REFERENCES public.menus(id)
);

-- ─────────────────────────────────────────
-- 23. orders
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
  id                    uuid NOT NULL DEFAULT uuid_generate_v4(),
  order_number          character varying NOT NULL UNIQUE,
  user_id               uuid NOT NULL,
  store_id              uuid NOT NULL,
  address_id            uuid NOT NULL,
  subtotal_amount       numeric NOT NULL,
  tax_amount            numeric DEFAULT 0,
  delivery_fee          numeric DEFAULT 0,
  discount_amount       numeric DEFAULT 0,
  total_amount          numeric NOT NULL,
  payment_status        character varying NOT NULL,
  order_status          character varying NOT NULL,
  scheduled_delivery_at timestamp with time zone,
  is_subscription_order boolean DEFAULT false,
  eta_minutes           integer,
  created_at            timestamp with time zone DEFAULT now(),
  updated_at            timestamp with time zone DEFAULT now(),
  circle_id             uuid,
  approval_status       order_approval_status NOT NULL DEFAULT 'PENDING'::order_approval_status,
  approved_by           uuid,
  approved_at           timestamp with time zone,
  rejected_by           uuid,
  rejected_at           timestamp with time zone,
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id),
  CONSTRAINT orders_rejected_by_fkey FOREIGN KEY (rejected_by) REFERENCES public.users(id),
  CONSTRAINT fk_orders_user    FOREIGN KEY (user_id)    REFERENCES public.users(id),
  CONSTRAINT fk_orders_store   FOREIGN KEY (store_id)   REFERENCES public.stores(id),
  CONSTRAINT fk_orders_address FOREIGN KEY (address_id) REFERENCES public.addresses(id)
);

-- ─────────────────────────────────────────
-- 24. order_items
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_items (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL,
  product_id    uuid,
  menus_id      uuid,
  quantity      integer NOT NULL,
  unit_price    numeric NOT NULL,
  total_price   numeric,
  is_food       boolean NOT NULL DEFAULT false,
  created_at    timestamp with time zone DEFAULT now(),
  product_name  text,
  store_id      uuid,
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT order_items_menus_id_fkey   FOREIGN KEY (menus_id)   REFERENCES public.menus(id),
  CONSTRAINT order_items_store_id_fkey   FOREIGN KEY (store_id)   REFERENCES public.stores(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────
-- 25. order_status_history
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL,
  from_status  character varying,
  to_status    character varying NOT NULL,
  changed_by   uuid,
  note         text,
  created_at   timestamp with time zone DEFAULT now(),
  CONSTRAINT order_status_history_pkey PRIMARY KEY (id),
  CONSTRAINT order_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id)
);

-- ─────────────────────────────────────────
-- 26. delivery_partners
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_partners (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  vehicle_type  character varying
                  CHECK (vehicle_type::text = ANY (ARRAY['BIKE'::character varying, 'CAR'::character varying]::text[])),
  is_active     boolean DEFAULT true,
  created_at    timestamp with time zone DEFAULT now(),
  updated_at    timestamp with time zone DEFAULT now(),
  CONSTRAINT delivery_partners_pkey PRIMARY KEY (id),
  CONSTRAINT delivery_partners_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- ─────────────────────────────────────────
-- 27. order_delivery_assignments
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_delivery_assignments (
  id                   uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id             uuid NOT NULL,
  delivery_partner_id  uuid NOT NULL,
  assigned_at          timestamp with time zone DEFAULT now(),
  picked_at            timestamp with time zone,
  delivered_at         timestamp with time zone,
  created_at           timestamp with time zone DEFAULT now(),
  CONSTRAINT order_delivery_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT order_delivery_assignments_delivery_partner_id_fkey
    FOREIGN KEY (delivery_partner_id) REFERENCES public.delivery_partners(id)
);

-- ─────────────────────────────────────────
-- 28. delivery_locations
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_locations (
  id                   uuid NOT NULL DEFAULT gen_random_uuid(),
  delivery_partner_id  uuid NOT NULL,
  order_id             uuid,
  latitude             numeric NOT NULL,
  longitude            numeric NOT NULL,
  recorded_at          timestamp with time zone DEFAULT now(),
  CONSTRAINT delivery_locations_pkey PRIMARY KEY (id),
  CONSTRAINT delivery_locations_delivery_partner_id_fkey
    FOREIGN KEY (delivery_partner_id) REFERENCES public.delivery_partners(id)
);

-- ─────────────────────────────────────────
-- 29. delivery_zones
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id                uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id          uuid NOT NULL,
  max_radius_km     numeric NOT NULL,
  base_delivery_fee numeric NOT NULL,
  per_km_fee        numeric,
  created_at        timestamp with time zone DEFAULT now(),
  updated_at        timestamp with time zone DEFAULT now(),
  CONSTRAINT delivery_zones_pkey PRIMARY KEY (id),
  CONSTRAINT delivery_zones_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id)
);

-- ─────────────────────────────────────────
-- 30. subscription_plans
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id                    uuid NOT NULL DEFAULT gen_random_uuid(),
  name                  character varying NOT NULL,
  description           text,
  max_deliveries        integer NOT NULL,
  period_type           character varying NOT NULL
                          CHECK (period_type::text = ANY (ARRAY['WEEKLY'::character varying, 'MONTHLY'::character varying]::text[])),
  price                 numeric NOT NULL,
  max_radius_km         numeric,
  free_trial_deliveries integer DEFAULT 3,
  is_active             boolean DEFAULT true,
  created_at            timestamp with time zone DEFAULT now(),
  updated_at            timestamp with time zone DEFAULT now(),
  CONSTRAINT subscription_plans_pkey PRIMARY KEY (id)
);

-- ─────────────────────────────────────────
-- 31. user_subscriptions
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id                    uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL,
  subscription_plan_id  uuid NOT NULL,
  start_date            date NOT NULL,
  end_date              date NOT NULL,
  remaining_deliveries  integer NOT NULL,
  status                character varying DEFAULT 'ACTIVE'::character varying
                          CHECK (status::text = ANY (ARRAY['ACTIVE'::character varying, 'EXPIRED'::character varying, 'CANCELLED'::character varying]::text[])),
  is_trial              boolean DEFAULT false,
  created_at            timestamp with time zone DEFAULT now(),
  updated_at            timestamp with time zone DEFAULT now(),
  CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT user_subscriptions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_subscriptions_subscription_plan_id_fkey
    FOREIGN KEY (subscription_plan_id) REFERENCES public.subscription_plans(id)
);

-- ─────────────────────────────────────────
-- 32. subscription_deliveries
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_deliveries (
  id                    uuid NOT NULL DEFAULT gen_random_uuid(),
  user_subscription_id  uuid NOT NULL,
  order_id              uuid NOT NULL,
  is_trial_delivery     boolean DEFAULT false,
  created_at            timestamp with time zone DEFAULT now(),
  CONSTRAINT subscription_deliveries_pkey PRIMARY KEY (id),
  CONSTRAINT subscription_deliveries_user_subscription_id_fkey
    FOREIGN KEY (user_subscription_id) REFERENCES public.user_subscriptions(id)
);

-- ─────────────────────────────────────────
-- 33. payment_methods
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL,
  provider         character varying NOT NULL,
  token_reference  character varying NOT NULL,
  method_type      character varying NOT NULL,
  last4            character varying,
  is_default       boolean NOT NULL DEFAULT false,
  created_at       timestamp with time zone NOT NULL DEFAULT now(),
  updated_at       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payment_methods_pkey PRIMARY KEY (id),
  CONSTRAINT payment_methods_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- ─────────────────────────────────────────
-- 34. payments
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id                  uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL,
  provider_payment_id character varying,
  amount              numeric NOT NULL,
  currency            character varying NOT NULL DEFAULT 'INR'::character varying,
  status              character varying NOT NULL DEFAULT 'PENDING'::character varying,
  payment_method_id   uuid,
  raw_response        jsonb,
  created_at          timestamp with time zone NOT NULL DEFAULT now(),
  updated_at          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_payment_method_fkey
    FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────
-- 35. refunds
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.refunds (
  id                  uuid NOT NULL DEFAULT gen_random_uuid(),
  payment_id          uuid NOT NULL,
  provider_refund_id  character varying,
  amount              numeric NOT NULL,
  reason              character varying,
  status              character varying NOT NULL DEFAULT 'PENDING'::character varying
                        CHECK (status::text = ANY (ARRAY['PENDING'::character varying, 'SUCCESS'::character varying, 'FAILED'::character varying]::text[])),
  raw_response        jsonb,
  created_at          timestamp with time zone DEFAULT now(),
  updated_at          timestamp with time zone DEFAULT now(),
  CONSTRAINT refunds_pkey PRIMARY KEY (id),
  CONSTRAINT refunds_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id)
);

-- ─────────────────────────────────────────
-- 36. notification_channel
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_channel (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  name        character varying NOT NULL,
  provider    character varying NOT NULL,
  created_at  timestamp with time zone DEFAULT now(),
  updated_at  timestamp with time zone DEFAULT now(),
  CONSTRAINT notification_channel_pkey PRIMARY KEY (id),
  CONSTRAINT notification_channel_name_unique UNIQUE (name)
);

-- ─────────────────────────────────────────
-- 37. notifications
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL,
  template_code  character varying,
  payload        jsonb NOT NULL,
  status         character varying DEFAULT 'PENDING'::character varying
                   CHECK (status::text = ANY (ARRAY['PENDING'::character varying, 'SENT'::character varying, 'READ'::character varying, 'FAILED'::character varying]::text[])),
  error_message  text,
  created_at     timestamp with time zone DEFAULT now(),
  sent_at        timestamp with time zone,
  channel        uuid NOT NULL,
  updated_at     timestamp without time zone,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT fk_notifications_channel  FOREIGN KEY (channel)  REFERENCES public.notification_channel(id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- ─────────────────────────────────────────
-- 38. audit_logs
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id      uuid,
  entity_type  character varying NOT NULL,
  entity_id    uuid,
  action       character varying NOT NULL,
  metadata     jsonb NOT NULL,
  created_at   timestamp with time zone DEFAULT now(),
  updated_at   timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- ─────────────────────────────────────────
-- INDEXES
-- Safe to run on every startup: CREATE IF NOT EXISTS skips existing objects
-- ─────────────────────────────────────────

-- state
CREATE INDEX IF NOT EXISTS idx_state_country_id        ON public.state (country_id);

-- city
CREATE INDEX IF NOT EXISTS idx_city_state_id           ON public.city (state_id);

-- users
CREATE INDEX IF NOT EXISTS idx_users_email             ON public.users (email);
CREATE INDEX IF NOT EXISTS idx_users_phone             ON public.users (phone);
CREATE INDEX IF NOT EXISTS idx_users_role_name         ON public.users (role_name);
CREATE INDEX IF NOT EXISTS idx_users_is_active         ON public.users (is_active);
CREATE INDEX IF NOT EXISTS idx_users_account_status    ON public.users (account_status);
CREATE INDEX IF NOT EXISTS idx_users_admin_id          ON public.users (admin_id);
CREATE INDEX IF NOT EXISTS idx_users_sub_admin_id      ON public.users (sub_admin_id);
CREATE INDEX IF NOT EXISTS idx_users_superadmin_id     ON public.users (superadmin_id);
CREATE INDEX IF NOT EXISTS idx_users_store_admin_id    ON public.users (store_admin_id);
CREATE INDEX IF NOT EXISTS idx_users_store_id            ON public.users (store_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active_account_status ON public.users (is_active, account_status);
CREATE INDEX IF NOT EXISTS idx_users_circle_id         ON public.users (circle_id);

-- user_otps
CREATE INDEX IF NOT EXISTS idx_user_otps_user_id       ON public.user_otps (user_id);
CREATE INDEX IF NOT EXISTS idx_user_otps_expires_at    ON public.user_otps (expires_at);

-- stores
CREATE INDEX IF NOT EXISTS idx_stores_region_id        ON public.stores (region_id);
CREATE INDEX IF NOT EXISTS idx_stores_store_admin_id   ON public.stores (store_admin_id);
CREATE INDEX IF NOT EXISTS idx_stores_is_active        ON public.stores (is_active);

-- addresses
CREATE INDEX IF NOT EXISTS idx_addresses_user_id       ON public.addresses (user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user_default  ON public.addresses (user_id, is_default);

-- sub_admin_regions
CREATE INDEX IF NOT EXISTS idx_sub_admin_regions_user_id   ON public.sub_admin_regions (user_id);
CREATE INDEX IF NOT EXISTS idx_sub_admin_regions_region_id ON public.sub_admin_regions (region_id);

-- categories
CREATE INDEX IF NOT EXISTS idx_categories_is_active    ON public.categories (is_active);

-- subcategories
CREATE INDEX IF NOT EXISTS idx_subcategories_category_id  ON public.subcategories (category_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_is_active    ON public.subcategories (is_active);
CREATE INDEX IF NOT EXISTS idx_subcategories_created_by   ON public.subcategories (created_by);

-- variants
CREATE INDEX IF NOT EXISTS idx_variants_category_id    ON public.variants (category_id);

-- brands
CREATE INDEX IF NOT EXISTS idx_brands_category_id      ON public.brands (category_id);
CREATE INDEX IF NOT EXISTS idx_brands_subcategory_id   ON public.brands (subcategory_id);
CREATE INDEX IF NOT EXISTS idx_brands_is_active        ON public.brands (is_active);

-- products
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_products_name_trgm        ON public.products USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_store_id         ON public.products (store_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id      ON public.products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_subcategory_id   ON public.products (subcategory_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_id         ON public.products (brand_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active        ON public.products (is_active);
CREATE INDEX IF NOT EXISTS idx_products_approval_status  ON public.products (approval_status);
-- composite: browsing active/approved products by store
CREATE INDEX IF NOT EXISTS idx_products_store_active_approval
  ON public.products (store_id, is_active, approval_status);

-- inventory
CREATE INDEX IF NOT EXISTS idx_inventory_is_out_of_stock ON public.inventory (is_out_of_stock);
-- product_id already has UNIQUE constraint (auto-indexed)

-- product_change_logs
CREATE INDEX IF NOT EXISTS idx_pcl_product_id    ON public.product_change_logs (product_id);
CREATE INDEX IF NOT EXISTS idx_pcl_changed_by    ON public.product_change_logs (changed_by);
CREATE INDEX IF NOT EXISTS idx_pcl_created_at    ON public.product_change_logs (created_at DESC);

-- menus
CREATE INDEX IF NOT EXISTS idx_menus_store_id      ON public.menus (store_id);
CREATE INDEX IF NOT EXISTS idx_menus_time_slot_id  ON public.menus (time_slot_id);
CREATE INDEX IF NOT EXISTS idx_menus_status        ON public.menus (status);
CREATE INDEX IF NOT EXISTS idx_menus_date          ON public.menus (date);
CREATE INDEX IF NOT EXISTS idx_menus_weekday       ON public.menus (weekday);
-- composite: main lookup for "what's on the menu today at this store?"
CREATE INDEX IF NOT EXISTS idx_menus_store_date_slot
  ON public.menus (store_id, date, time_slot_id);

-- carts
CREATE INDEX IF NOT EXISTS idx_carts_user_id   ON public.carts (user_id);
CREATE INDEX IF NOT EXISTS idx_carts_store_id  ON public.carts (store_id);
-- composite: enforce/lookup one cart per user per store
CREATE INDEX IF NOT EXISTS idx_carts_user_store ON public.carts (user_id, store_id);

-- cart_items
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id     ON public.cart_items (cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id  ON public.cart_items (product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_menus_id    ON public.cart_items (menus_id);

-- orders
CREATE INDEX IF NOT EXISTS idx_orders_order_number     ON public.orders (order_number);
CREATE INDEX IF NOT EXISTS idx_orders_user_id          ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_store_id         ON public.orders (store_id);
CREATE INDEX IF NOT EXISTS idx_orders_address_id       ON public.orders (address_id);
CREATE INDEX IF NOT EXISTS idx_orders_circle_id        ON public.orders (circle_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_status     ON public.orders (order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status   ON public.orders (payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_approval_status  ON public.orders (approval_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at       ON public.orders (created_at DESC);
-- composite: customer order history
CREATE INDEX IF NOT EXISTS idx_orders_user_status_created
  ON public.orders (user_id, order_status, created_at DESC);

-- order_items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id    ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id  ON public.order_items (product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menus_id    ON public.order_items (menus_id);
CREATE INDEX IF NOT EXISTS idx_order_items_store_id    ON public.order_items (store_id);

-- order_status_history
CREATE INDEX IF NOT EXISTS idx_osh_order_id    ON public.order_status_history (order_id);
CREATE INDEX IF NOT EXISTS idx_osh_changed_by  ON public.order_status_history (changed_by);
CREATE INDEX IF NOT EXISTS idx_osh_created_at  ON public.order_status_history (created_at DESC);

-- delivery_partners
CREATE INDEX IF NOT EXISTS idx_delivery_partners_user_id   ON public.delivery_partners (user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_is_active ON public.delivery_partners (is_active);

-- order_delivery_assignments
CREATE INDEX IF NOT EXISTS idx_oda_order_id            ON public.order_delivery_assignments (order_id);
CREATE INDEX IF NOT EXISTS idx_oda_delivery_partner_id ON public.order_delivery_assignments (delivery_partner_id);

-- delivery_locations
CREATE INDEX IF NOT EXISTS idx_dl_delivery_partner_id ON public.delivery_locations (delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_dl_order_id            ON public.delivery_locations (order_id);
CREATE INDEX IF NOT EXISTS idx_dl_recorded_at         ON public.delivery_locations (recorded_at DESC);
-- composite: latest location for a delivery partner on a given order
CREATE INDEX IF NOT EXISTS idx_dl_partner_order_recorded
  ON public.delivery_locations (delivery_partner_id, order_id, recorded_at DESC);

-- delivery_zones
CREATE INDEX IF NOT EXISTS idx_delivery_zones_store_id ON public.delivery_zones (store_id);

-- user_subscriptions
CREATE INDEX IF NOT EXISTS idx_user_subs_user_id       ON public.user_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_subs_plan_id       ON public.user_subscriptions (subscription_plan_id);
CREATE INDEX IF NOT EXISTS idx_user_subs_status        ON public.user_subscriptions (status);
-- composite: active subscription lookup for a user
CREATE INDEX IF NOT EXISTS idx_user_subs_user_status
  ON public.user_subscriptions (user_id, status);

-- subscription_deliveries
CREATE INDEX IF NOT EXISTS idx_sub_deliveries_user_sub_id ON public.subscription_deliveries (user_subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_deliveries_order_id    ON public.subscription_deliveries (order_id);

-- payment_methods
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON public.payment_methods (user_id);

-- payments
CREATE INDEX IF NOT EXISTS idx_payments_order_id          ON public.payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_method_id ON public.payments (payment_method_id);
CREATE INDEX IF NOT EXISTS idx_payments_status            ON public.payments (status);

-- refunds
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON public.refunds (payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status     ON public.refunds (status);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status     ON public.notifications (status);
CREATE INDEX IF NOT EXISTS idx_notifications_channel    ON public.notifications (channel);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);
-- composite: pending notifications per user
CREATE INDEX IF NOT EXISTS idx_notifications_user_status
  ON public.notifications (user_id, status);

-- audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id      ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type  ON public.audit_logs (entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id    ON public.audit_logs (entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at   ON public.audit_logs (created_at DESC);
-- composite: look up all audit events for a specific entity
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type_id
  ON public.audit_logs (entity_type, entity_id);

-- ─────────────────────────────────────────
-- Seed Notification Channels
-- ─────────────────────────────────────────
INSERT INTO public.notification_channel (name, provider)
VALUES 
  ('MAILGUN', 'Mailgun'),
  ('CLICKSEND', 'ClickSend'),
  ('TWILIO', 'Twilio'),
  ('IN_APP', 'InApp')
ON CONFLICT (name) DO NOTHING;

