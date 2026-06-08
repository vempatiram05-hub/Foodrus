import { Pool } from "pg";
import dotenv from "dotenv";
import { notifyPostgrestReload, getSessionConnectionString } from "../src/config/sessionConnection";
import { DBconnection } from "../src/config/DBConnect";

dotenv.config();

/**
 * Check whether a column exists directly in Postgres (bypasses PostgREST).
 * This avoids false-positive 42703 errors that occur when PostgREST's schema
 * cache hasn't fully loaded yet on startup.
 */
async function columnExists(pool: Pool, table: string, column: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1
       FROM pg_attribute a
       JOIN pg_class   c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = $1
        AND a.attname = $2
        AND a.attnum  > 0
        AND NOT a.attisdropped`,
    [table, column]
  );
  return rows.length > 0;
}

async function applyColumnMigration(sql: string): Promise<void> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await pool.query(sql);
  } finally {
    await pool.end();
  }
  // NOTIFY is intentionally omitted here — a single unconditional NOTIFY
  // is sent at the end of runMigrations() regardless of whether any column
  // was added or dropped, ensuring exactly one reload signal per startup.
}

export async function runMigrations(): Promise<void> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // ── 1. token_version on users ────────────────────────────────────────────
    try {
      const exists = await columnExists(pool, "users", "token_version");
      if (!exists) {
        console.log("⚙️  Applying migration: token_version column on users");
        await applyColumnMigration(
          "ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;"
        );
        console.log("✅ token_version migration applied");
      } else {
        console.log("✅ token_version column already exists in users table");
      }
    } catch (err) {
      console.error("Migration check error (token_version):", err);
    }

    // ── 2. revision_count on menus ───────────────────────────────────────────
    try {
      const exists = await columnExists(pool, "menus", "revision_count");
      if (!exists) {
        console.log("⚙️  Applying migration: revision_count column on menus");
        await applyColumnMigration(
          "ALTER TABLE public.menus ADD COLUMN IF NOT EXISTS revision_count integer NOT NULL DEFAULT 0;"
        );
        console.log("✅ revision_count migration applied and schema cache notified");
      } else {
        console.log("✅ revision_count column already exists in menus table");
      }
    } catch (err) {
      console.error("Migration check error (revision_count):", err);
    }

    // ── 3. Drop claimed_by / claimed_at from menus (claim lock removed) ──────
    try {
      const claimedByExists = await columnExists(pool, "menus", "claimed_by");
      const claimedAtExists = await columnExists(pool, "menus", "claimed_at");
      if (claimedByExists || claimedAtExists) {
        console.log("⚙️  Applying migration: dropping claimed_by/claimed_at columns from menus");
        await applyColumnMigration(
          `ALTER TABLE public.menus
             DROP COLUMN IF EXISTS claimed_by,
             DROP COLUMN IF EXISTS claimed_at;`
        );
        console.log("✅ claimed_by/claimed_at columns dropped from menus table");
      } else {
        console.log("✅ claimed_by/claimed_at columns already absent from menus table");
      }
    } catch (err) {
      console.error("Migration check error (drop claimed_by/claimed_at):", err);
    }

    // ── 4. pending_products on menus ─────────────────────────────────────────
    try {
      const exists = await columnExists(pool, "menus", "pending_products");
      if (!exists) {
        console.log("⚙️  Applying migration: pending_products column on menus");
        await applyColumnMigration(
          "ALTER TABLE public.menus ADD COLUMN IF NOT EXISTS pending_products uuid[];"
        );
        console.log("✅ pending_products migration applied and schema cache notified");
      } else {
        console.log("✅ pending_products column already exists in menus table");
      }
    } catch (err) {
      console.error("Migration check error (pending_products):", err);
    }

    // ── 5. unavailable_items on menus ─────────────────────────────────────────
    try {
      const exists = await columnExists(pool, "menus", "unavailable_items");
      if (!exists) {
        console.log("⚙️  Applying migration: unavailable_items column on menus");
        await applyColumnMigration(
          "ALTER TABLE public.menus ADD COLUMN IF NOT EXISTS unavailable_items uuid[];"
        );
        console.log("✅ unavailable_items migration applied and schema cache notified");
      } else {
        console.log("✅ unavailable_items column already exists in menus table");
      }
    } catch (err) {
      console.error("Migration check error (unavailable_items):", err);
    }

    // ── 6. Backfill Categories permissions for existing non-Customer users ────
    try {
      const { rows: missingRows } = await pool.query(
        `SELECT COUNT(*) AS cnt
           FROM public.users
          WHERE role_name::text != 'Customer'
            AND (permissions IS NULL OR NOT (permissions ? 'Categories'))`
      );
      const missingCount = parseInt(missingRows[0].cnt, 10);
      if (missingCount > 0) {
        console.log(
          `⚙️  Applying migration: backfilling Categories permissions for ${missingCount} user(s)`
        );
        await applyColumnMigration(`
          UPDATE public.users
          SET permissions = COALESCE(permissions, '{}'::jsonb) || jsonb_build_object(
            'Categories',
            CASE role_name::text
              WHEN 'Admin'      THEN '{"view":{"allowed":true},"showInMenu":{"allowed":true}}'::jsonb
              WHEN 'SuperAdmin' THEN '{"view":{"allowed":true},"showInMenu":{"allowed":true}}'::jsonb
              WHEN 'SubAdmin'   THEN '{"view":{"allowed":true},"create":{"allowed":true},"edit":{"allowed":true},"delete":{"allowed":true},"showInMenu":{"allowed":true}}'::jsonb
              WHEN 'StoreAdmin' THEN '{"view":{"allowed":true},"showInMenu":{"allowed":true}}'::jsonb
              WHEN 'Employee'   THEN '{"view":{"allowed":true},"showInMenu":{"allowed":true}}'::jsonb
              ELSE '{}'::jsonb
            END
          )
          WHERE role_name::text != 'Customer'
            AND (permissions IS NULL OR NOT (permissions ? 'Categories'));
        `);
        console.log("✅ Categories permissions backfill applied");
      } else {
        console.log("✅ All existing users already have Categories permissions");
      }
    } catch (err) {
      console.error("Migration check error (Categories permissions backfill):", err);
    }
    // ── 7. Tighten Categories/Analytics/Reports permissions for existing users ──
    try {
      const { rows: checkRows } = await pool.query(`
        SELECT COUNT(*) AS cnt FROM public.users
        WHERE role_name::text IN ('SuperAdmin','StoreAdmin','Employee')
          AND (
            (role_name::text = 'SuperAdmin' AND permissions ? 'Categories')
            OR (role_name::text = 'StoreAdmin' AND (
                  (permissions->'Categories'->>'create') = 'true'
                  OR (permissions->'Categories'->>'edit')   = 'true'
                  OR (permissions->'Categories'->>'delete') = 'true'
               ))
            OR (role_name::text = 'Employee' AND (
                  permissions ? 'Analytics'
                  OR permissions ? 'Reports'
                  OR (permissions->'Categories'->>'create') = 'true'
                  OR (permissions->'Categories'->>'edit')   = 'true'
               ))
          )
      `);
      const needsUpdate = parseInt(checkRows[0].cnt, 10);
      if (needsUpdate > 0) {
        console.log(
          `⚙️  Applying migration: tightening Categories/Analytics/Reports for ${needsUpdate} user(s)`
        );
        await applyColumnMigration(`
          -- SuperAdmin: remove Categories entirely
          UPDATE public.users
          SET permissions = permissions - 'Categories'
          WHERE role_name::text = 'SuperAdmin'
            AND permissions ? 'Categories';

          -- StoreAdmin: downgrade Categories to view+showInMenu only
          UPDATE public.users
          SET permissions = jsonb_set(
            permissions,
            '{Categories}',
            '{"view":{"allowed":true},"showInMenu":{"allowed":true}}'::jsonb
          )
          WHERE role_name::text = 'StoreAdmin'
            AND permissions ? 'Categories';

          -- Employee: Categories to view+showInMenu only; remove Analytics and Reports
          UPDATE public.users
          SET permissions = (
            (permissions - 'Analytics' - 'Reports') ||
            jsonb_build_object(
              'Categories',
              '{"view":{"allowed":true},"showInMenu":{"allowed":true}}'::jsonb
            )
          )
          WHERE role_name::text = 'Employee';
        `);
        console.log("✅ Categories/Analytics/Reports permissions tightened");
      } else {
        console.log("✅ Categories/Analytics/Reports permissions already correct for all users");
      }
    } catch (err) {
      console.error("Migration check error (tighten permissions):", err);
    }
    // ── 8. type column on categories ─────────────────────────────────────────
    try {
      const exists = await columnExists(pool, "categories", "type");
      if (!exists) {
        console.log("⚙️  Applying migration: type column on categories");
        await applyColumnMigration(
          `ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'food' CHECK (type IN ('food','grocery','bakery'));`
        );
        console.log("✅ categories.type migration applied");
      } else {
        console.log("✅ categories.type column already exists");
      }
    } catch (err) {
      console.error("Migration check error (categories.type):", err);
    }
    // ── 8b. Upgrade categories.type — replace 'all' with 'bakery' as first-class type ──
    try {
      await pool.query(`UPDATE public.categories SET type = 'food' WHERE type = 'all'`);
      await pool.query(`
        DO $$
        DECLARE v_con text;
        BEGIN
          SELECT con.conname INTO v_con
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          WHERE rel.relname = 'categories'
            AND rel.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
            AND con.contype = 'c'
            AND con.conname LIKE '%type%'
            AND con.conname NOT LIKE '%bakery%'
          LIMIT 1;
          IF v_con IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS %I', v_con);
          END IF;
        END $$
      `);
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            WHERE rel.relname = 'categories'
              AND rel.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
              AND con.contype = 'c'
              AND pg_get_constraintdef(con.oid) LIKE '%bakery%'
          ) THEN
            ALTER TABLE public.categories
              ADD CONSTRAINT categories_type_bakery_check
              CHECK (type IN ('food', 'grocery', 'bakery'));
          END IF;
        END $$
      `);
      await pool.query(`ALTER TABLE public.categories ALTER COLUMN type SET DEFAULT 'food'`);
      console.log("✅ categories.type upgraded: bakery added as first-class type");
    } catch (err) {
      console.error("Migration check error (categories.type bakery upgrade):", err);
    }

       // ── 9. Drop store_id from categories ────────────────────────────────────
    try {
     const exists = await columnExists(pool, "categories", "store_id");
      if (exists) {
        console.log("⚙️  Applying migration: dropping store_id column from categories");
        // 1. Drop partial unique indexes that referenced store_id
        await applyColumnMigration("DROP INDEX IF EXISTS public.idx_categories_name_global;");
        await applyColumnMigration("DROP INDEX IF EXISTS public.idx_categories_name_per_store;");
        
        // 2. Drop the composite unique constraint that included store_id
        await applyColumnMigration(`
          DO $$
          BEGIN
            IF EXISTS (
              SELECT 1 FROM pg_constraint
              WHERE conname = 'categories_name_store_unique'
                AND conrelid = 'public.categories'::regclass
            ) THEN
              ALTER TABLE public.categories DROP CONSTRAINT categories_name_store_unique;
            END IF;
          END $$;
        `);
        // 3. Drop the store_id column itself
        await applyColumnMigration("ALTER TABLE public.categories DROP COLUMN IF EXISTS store_id;");
        console.log("✅ categories.store_id column dropped");
      } else {
        console.log("✅ categories.store_id column already dropped");
      }
    } catch (err) {
      console.error("Migration check error (categories.store_id nullable):", err);
    }

        // ── 10. Resolve duplicate category names and ensure unique index ──────────
    // The old UNIQUE(name, store_id) constraint treats NULL != NULL, so two
    // global categories with the same name would both pass. Replace it with
    // two partial unique indexes that handle NULLs correctly.
    try {
      console.log("⚙️  Applying migration: ensuring unique name index on categories");
      // Resolve any duplicate category names that existed across different stores.

      await applyColumnMigration(`
      DO $$
        DECLARE
          rec RECORD;
          counter INT;
        BEGIN
          FOR rec IN
            SELECT name
            FROM public.categories
            GROUP BY name
            HAVING COUNT(*) > 1
          LOOP
            counter := 2;
            UPDATE public.categories
            SET name = rec.name || ' (' || counter || ')',
                updated_at = now()
            WHERE id IN (
              SELECT id
              FROM public.categories
              WHERE name = rec.name
              ORDER BY created_at ASC
              OFFSET 1
              LIMIT 1
            );
            counter := counter + 1;
 -- Handle groups larger than 2 by looping until no duplicates remain.
            WHILE EXISTS (
              SELECT 1 FROM public.categories
              WHERE name = rec.name
              GROUP BY name
              HAVING COUNT(*) > 1
            ) LOOP
              UPDATE public.categories
              SET name = rec.name || ' (' || counter || ')',
                  updated_at = now()
              WHERE id IN (
                SELECT id
                FROM public.categories
                WHERE name = rec.name
                ORDER BY created_at ASC
                OFFSET 1
                LIMIT 1
              );
              counter := counter + 1;
            END LOOP;
          END LOOP;
        END $$;
      `);
     
      // Create the new simple unique index on name
      await applyColumnMigration(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_unique
          ON public.categories (name);
      `);
      console.log("✅ categories unique name index ensured");
    } catch (err) {
      console.error("Migration check error (categories unique index):", err);
    }

    // ── 11. Make brands.category_id and brands.subcategory_id nullable ────────
    try {
      const { rows: catRows } = await pool.query(
        `SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = 'brands'
            AND column_name  = 'category_id'
            AND is_nullable  = 'NO'`
      );
      if (catRows.length > 0) {
        console.log("⚙️  Applying migration: dropping NOT NULL from brands.category_id");
        await applyColumnMigration(
          `ALTER TABLE public.brands ALTER COLUMN category_id DROP NOT NULL;`
        );
        console.log("✅ brands.category_id is now nullable");
      } else {
        console.log("✅ brands.category_id already nullable");
      }

      const { rows: subRows } = await pool.query(
        `SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = 'brands'
            AND column_name  = 'subcategory_id'
            AND is_nullable  = 'NO'`
      );
      if (subRows.length > 0) {
        console.log("⚙️  Applying migration: dropping NOT NULL from brands.subcategory_id");
        await applyColumnMigration(
          `ALTER TABLE public.brands ALTER COLUMN subcategory_id DROP NOT NULL;`
        );
        console.log("✅ brands.subcategory_id is now nullable");
      } else {
        console.log("✅ brands.subcategory_id already nullable");
      }
    } catch (err) {
      console.error("Migration check error (brands nullable columns):", err);
    }

    // ── 12. Backfill Subcategories permissions for existing users ─────────────
    try {
      const { rows: subMissingRows } = await pool.query(
        `SELECT COUNT(*) AS cnt
           FROM public.users
          WHERE role_name::text NOT IN ('Customer','SuperAdmin')
            AND (permissions IS NULL OR NOT (permissions ? 'Subcategories'))`
      );
      const subMissingCount = parseInt(subMissingRows[0].cnt, 10);
      if (subMissingCount > 0) {
        console.log(
          `⚙️  Applying migration: backfilling Subcategories permissions for ${subMissingCount} user(s)`
        );
        await applyColumnMigration(`
          UPDATE public.users
          SET permissions = COALESCE(permissions, '{}'::jsonb) || jsonb_build_object(
            'Subcategories',
            CASE role_name::text
              WHEN 'Admin'      THEN '{"view":{"allowed":true},"showInMenu":{"allowed":true}}'::jsonb
              WHEN 'SubAdmin'   THEN '{"view":{"allowed":true},"create":{"allowed":true},"edit":{"allowed":true},"delete":{"allowed":true},"showInMenu":{"allowed":true}}'::jsonb
              WHEN 'StoreAdmin' THEN '{"view":{"allowed":true},"showInMenu":{"allowed":true}}'::jsonb
              WHEN 'Employee'   THEN '{"view":{"allowed":true},"showInMenu":{"allowed":true}}'::jsonb
              ELSE '{}'::jsonb
            END
          )
          WHERE role_name::text NOT IN ('Customer','SuperAdmin')
            AND (permissions IS NULL OR NOT (permissions ? 'Subcategories'));
        `);
        console.log("✅ Subcategories permissions backfill applied");
      } else {
        console.log("✅ All existing users already have Subcategories permissions");
      }
    } catch (err) {
      console.error("Migration check error (Subcategories permissions backfill):", err);
    }

    // ── 13. Backfill Brands permissions for existing users ────────────────────
    try {
      const { rows: brandMissingRows } = await pool.query(
        `SELECT COUNT(*) AS cnt
           FROM public.users
          WHERE role_name::text NOT IN ('Customer','SuperAdmin')
            AND (permissions IS NULL OR NOT (permissions ? 'Brands'))`
      );
      const brandMissingCount = parseInt(brandMissingRows[0].cnt, 10);
      if (brandMissingCount > 0) {
        console.log(
          `⚙️  Applying migration: backfilling Brands permissions for ${brandMissingCount} user(s)`
        );
        await applyColumnMigration(`
          UPDATE public.users
          SET permissions = COALESCE(permissions, '{}'::jsonb) || jsonb_build_object(
            'Brands',
            CASE role_name::text
              WHEN 'Admin'      THEN '{"view":{"allowed":true},"showInMenu":{"allowed":true}}'::jsonb
              WHEN 'SubAdmin'   THEN '{"view":{"allowed":true},"create":{"allowed":true},"edit":{"allowed":true},"delete":{"allowed":true},"showInMenu":{"allowed":true}}'::jsonb
              WHEN 'StoreAdmin' THEN '{"view":{"allowed":true},"create":{"allowed":true},"edit":{"allowed":true},"showInMenu":{"allowed":true}}'::jsonb
              WHEN 'Employee'   THEN '{"view":{"allowed":true},"showInMenu":{"allowed":true}}'::jsonb
              ELSE '{}'::jsonb
            END
          )
          WHERE role_name::text NOT IN ('Customer','SuperAdmin')
            AND (permissions IS NULL OR NOT (permissions ? 'Brands'));
        `);
        console.log("✅ Brands permissions backfill applied");
      } else {
        console.log("✅ All existing users already have Brands permissions");
      }
    } catch (err) {
      console.error("Migration check error (Brands permissions backfill):", err);
    }

    // ── 14. Backfill Store permissions for existing Employee users ────────────
    try {
      const { rows: storeMissingRows } = await pool.query(
        `SELECT COUNT(*) AS cnt
           FROM public.users
          WHERE role_name::text = 'Employee'
            AND (permissions IS NULL OR NOT (permissions ? 'Store'))`
      );
      const storeMissingCount = parseInt(storeMissingRows[0].cnt, 10);
      if (storeMissingCount > 0) {
        console.log(
          `⚙️  Applying migration: backfilling Store permissions for ${storeMissingCount} Employee user(s)`
        );
        await applyColumnMigration(`
          UPDATE public.users
          SET permissions = COALESCE(permissions, '{}'::jsonb) || '{"Store":{"view":{"allowed":true},"showInMenu":{"allowed":true}}}'::jsonb
          WHERE role_name::text = 'Employee'
            AND (permissions IS NULL OR NOT (permissions ? 'Store'));
        `);
        console.log("✅ Store permissions backfill applied for Employees");
      } else {
        console.log("✅ All existing Employee users already have Store permissions");
      }
    } catch (err) {
      console.error("Migration check error (Store permissions backfill):", err);
    }

    // ── 15. store_id on users (Employee direct store assignment) ────────────
    try {
      const exists = await columnExists(pool, "users", "store_id");
      if (!exists) {
        console.log("⚙️  Applying migration: store_id column on users");
        await applyColumnMigration(`
          ALTER TABLE public.users
            ADD COLUMN IF NOT EXISTS store_id uuid;
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
          CREATE INDEX IF NOT EXISTS idx_users_store_id ON public.users (store_id);
        `);
        console.log("✅ users.store_id migration applied");
      } else {
        console.log("✅ users.store_id column already exists");
      }
    } catch (err) {
      console.error("Migration check error (users.store_id):", err);
    }

    // ── 16a. Add created_by column on categories (nullable first) ────────────
    try {
      const exists = await columnExists(pool, "categories", "created_by");
      if (!exists) {
        console.log("⚙️  Applying migration: created_by column on categories");
        await applyColumnMigration(`
          ALTER TABLE public.categories
            ADD COLUMN IF NOT EXISTS created_by UUID;
          CREATE INDEX IF NOT EXISTS idx_categories_created_by
            ON public.categories (created_by);
        `);
        console.log("✅ categories.created_by column added");
      } else {
        console.log("✅ categories.created_by column already exists");
      }
    } catch (err) {
      console.error("Migration check error (categories.created_by add column):", err);
    }

    // ── 16b. Drop any incorrectly-targeted FK on categories.created_by ───────────
    // The correct FK (→ public.users ON DELETE RESTRICT) is added by
    // backfillCategoriesCreatedBy() AFTER all rows have valid values.
    // Here we only clean up FKs that point to the wrong table (e.g. auth.users
    // from a previous failed attempt) or use the wrong delete action.
    try {
      const { rows: badFkRows } = await pool.query(`
        SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class rel   ON rel.oid = con.conrelid
          JOIN pg_class tgt   ON tgt.oid = con.confrelid
          JOIN pg_namespace n ON n.oid   = tgt.relnamespace
         WHERE rel.relname      = 'categories'
           AND rel.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
           AND con.contype      = 'f'
           AND con.conname      = 'categories_created_by_fkey'
           AND NOT (n.nspname = 'public' AND tgt.relname = 'users' AND con.confdeltype = 'r')
      `);
      if (badFkRows.length > 0) {
        await applyColumnMigration(
          `ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_created_by_fkey`
        );
        console.log("✅ categories.created_by incorrect FK dropped — backfill will add correct one");
      } else {
        console.log("✅ categories.created_by FK is correct or absent — no cleanup needed");
      }
    } catch (err) {
      console.error("Migration check error (categories.created_by FK cleanup):", err);
    }

    // ── 17. payments.payment_method_id: nullable + FK ON DELETE SET NULL ──────
    // Allows users to delete a saved payment method even if it was used in a
    // past order. The column must be nullable BEFORE the FK can cascade SET NULL.
    // Step A: drop NOT NULL; Step B: drop+re-add FK with ON DELETE SET NULL.
    try {
      // Step A: make payment_method_id nullable if it still has NOT NULL
      const { rows: nullableCheck } = await pool.query(`
        SELECT is_nullable
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name   = 'payments'
           AND column_name  = 'payment_method_id'
      `);
      if (nullableCheck[0]?.is_nullable === 'NO') {
        console.log("⚙️  Applying migration 17a: payments.payment_method_id → nullable");
        await applyColumnMigration(`
          ALTER TABLE public.payments
            ALTER COLUMN payment_method_id DROP NOT NULL;
        `);
        console.log("✅ payments.payment_method_id is now nullable");
      } else {
        console.log("✅ payments.payment_method_id already nullable");
      }

      // Step B: ensure FK is ON DELETE SET NULL
      const { rows: fkCheck } = await pool.query(`
        SELECT con.confdeltype
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
         WHERE rel.relname  = 'payments'
           AND rel.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
           AND con.conname  = 'payments_payment_method_fkey'
           AND con.contype  = 'f'
      `);
      // confdeltype: 'a' = NO ACTION (default), 'n' = SET NULL
      if (fkCheck.length === 0 || fkCheck[0].confdeltype !== 'n') {
        console.log("⚙️  Applying migration 17b: payments FK → ON DELETE SET NULL");
        await applyColumnMigration(`
          ALTER TABLE public.payments
            DROP CONSTRAINT IF EXISTS payments_payment_method_fkey;
          ALTER TABLE public.payments
            ADD CONSTRAINT payments_payment_method_fkey
            FOREIGN KEY (payment_method_id)
            REFERENCES public.payment_methods(id)
            ON DELETE SET NULL;
        `);
        console.log("✅ payments.payment_method_id FK updated to ON DELETE SET NULL");
      } else {
        console.log("✅ payments.payment_method_id FK already ON DELETE SET NULL");
      }
    } catch (err) {
      console.error("Migration check error (payments nullable + FK ON DELETE SET NULL):", err);
    }

    // ── 16c. Enforce NOT NULL on categories.created_by once all rows are filled ─
    // The actual backfill is done by backfillCategoriesCreatedBy() which is called
    // AFTER runMigrations() + bootMasterAdmin() in index.ts, at which point:
    //   • PostgREST schema cache knows about the created_by column (NOTIFY already sent)
    //   • The Admin user definitely exists in public.users (bootMasterAdmin ran)
    // This step only applies the NOT NULL constraint if no null rows remain.
    try {
      // Apply NOT NULL constraint only when no rows remain NULL
      const { rows: nullableCheck } = await pool.query(`
        SELECT is_nullable
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name   = 'categories'
           AND column_name  = 'created_by'
      `);
      if (nullableCheck[0]?.is_nullable === "YES") {
        const { rows: nullRows } = await pool.query(
          `SELECT COUNT(*) AS cnt FROM public.categories WHERE created_by IS NULL`
        );
        if (parseInt(nullRows[0].cnt, 10) === 0) {
          await applyColumnMigration(
            `ALTER TABLE public.categories ALTER COLUMN created_by SET NOT NULL`
          );
          console.log("✅ categories.created_by set to NOT NULL");
        } else {
          console.log("⚠️  categories.created_by has NULL rows — NOT NULL constraint deferred until backfill completes");
        }
      } else {
        console.log("✅ categories.created_by is already NOT NULL");
      }
    } catch (err) {
      console.error("Migration check error (categories.created_by backfill/NOT NULL):", err);
    }

    // ── 18. Backfill product_name on historical order_items ───────────────────
    // Rows created before task #323 have product_id or menus_id set but no
    // product_name.  Recover names from the FK-linked tables so older orders
    // display correctly rather than falling back to the "Item" placeholder.
    try {
      // ── 18a. Rows linked via product_id ────────────────────────────────────
      const { rows: productNullRows } = await pool.query(`
        SELECT COUNT(*) AS cnt
          FROM public.order_items
         WHERE product_name IS NULL
           AND product_id IS NOT NULL
      `);
      const productNullCount = parseInt(productNullRows[0].cnt, 10);
      if (productNullCount > 0) {
        console.log(
          `⚙️  Applying migration 18a: backfilling product_name for ${productNullCount} order_item(s) with product_id`
        );
        const { rowCount: updated18a } = await pool.query(`
          UPDATE public.order_items oi
             SET product_name = p.name
            FROM public.products p
           WHERE oi.product_id = p.id
             AND oi.product_name IS NULL
             AND oi.product_id IS NOT NULL
        `);
        console.log(`✅ order_items product_name backfilled via product_id: ${updated18a ?? 0} row(s) updated`);
      } else {
        console.log("✅ No order_items with product_id need product_name backfill");
      }

      // ── 18b. Rows linked via menus_id ──────────────────────────────────────
      // menus.product_id is uuid[], so we unnest to join each product and then
      // string_agg the names in array order (matching the logic in order.controller.ts).
      const { rows: menuNullRows } = await pool.query(`
        SELECT COUNT(*) AS cnt
          FROM public.order_items
         WHERE product_name IS NULL
           AND menus_id IS NOT NULL
      `);
      const menuNullCount = parseInt(menuNullRows[0].cnt, 10);
      if (menuNullCount > 0) {
        console.log(
          `⚙️  Applying migration 18b: backfilling product_name for ${menuNullCount} order_item(s) with menus_id`
        );
        const { rowCount: updated18b } = await pool.query(`
          UPDATE public.order_items oi
             SET product_name = sub.names
            FROM (
              SELECT oi2.id AS item_id,
                     string_agg(p.name, ', ' ORDER BY pos.ord) AS names
                FROM public.order_items oi2
                JOIN public.menus m ON m.id = oi2.menus_id
                JOIN LATERAL unnest(m.product_id) WITH ORDINALITY AS pos(pid, ord) ON TRUE
                JOIN public.products p ON p.id = pos.pid
               WHERE oi2.product_name IS NULL
                 AND oi2.menus_id IS NOT NULL
               GROUP BY oi2.id
            ) sub
           WHERE oi.id = sub.item_id
             AND sub.names IS NOT NULL
        `);
        console.log(`✅ order_items product_name backfilled via menus_id: ${updated18b ?? 0} row(s) updated`);
      } else {
        console.log("✅ No order_items with menus_id need product_name backfill");
      }
    } catch (err) {
      console.error("Migration check error (order_items product_name backfill):", err);
    }

    // ── 19. Backfill legacy lowercase order_status values ─────────────────────
    // Orders created before the status system was standardised to uppercase may
    // still carry old lowercase values.  Map them to their canonical equivalents:
    //   "confirmed" | "placed"  → PENDING
    //   "failed"                → CANCELLED
    //   "delivering"            → OUT_FOR_DELIVERY
    //   "completed"             → DELIVERED
    try {
      const { rows: legacyRows } = await pool.query(`
        SELECT COUNT(*) AS cnt
          FROM public.orders
         WHERE order_status IN ('confirmed', 'placed', 'failed', 'delivering', 'completed')
      `);
      const legacyCount = parseInt(legacyRows[0].cnt, 10);
      if (legacyCount > 0) {
        console.log(
          `⚙️  Applying migration 19: backfilling legacy order_status for ${legacyCount} order(s)`
        );
        const { rowCount: updated19 } = await pool.query(`
          UPDATE public.orders
             SET order_status = CASE order_status
               WHEN 'confirmed'  THEN 'PENDING'
               WHEN 'placed'     THEN 'PENDING'
               WHEN 'failed'     THEN 'CANCELLED'
               WHEN 'delivering' THEN 'OUT_FOR_DELIVERY'
               WHEN 'completed'  THEN 'DELIVERED'
             END
           WHERE order_status IN ('confirmed', 'placed', 'failed', 'delivering', 'completed')
        `);
        console.log(`✅ Legacy order_status backfill applied: ${updated19 ?? 0} row(s) updated`);
      } else {
        console.log("✅ No legacy order_status values found — backfill not needed");
      }
    } catch (err) {
      console.error("Migration check error (order_status backfill):", err);
    }

    // ── 20. notification_channel dedup + UNIQUE constraint ────────────────────
    try {
      const { rows: dupRows } = await pool.query(`
        SELECT name FROM public.notification_channel
        GROUP BY name HAVING COUNT(*) > 1
      `);
      if (dupRows.length > 0) {
        console.log(`⚙️  Deduplicating notification_channel: ${dupRows.map((r: any) => r.name).join(", ")}`);
        await pool.query(`
          DELETE FROM public.notification_channel
          WHERE id NOT IN (
            SELECT DISTINCT ON (name) id
            FROM public.notification_channel
            ORDER BY name, created_at ASC, id ASC
          )
        `);
        console.log("✅ notification_channel dedup complete");
      } else {
        console.log("✅ notification_channel has no duplicates");
      }

      const { rows: constraintRows } = await pool.query(`
        SELECT 1 FROM pg_constraint con
        JOIN pg_class cls ON cls.oid = con.conrelid
        JOIN pg_namespace ns ON ns.oid = cls.relnamespace
        WHERE ns.nspname = 'public'
          AND cls.relname = 'notification_channel'
          AND con.conname = 'notification_channel_name_unique'
      `);
      if (constraintRows.length === 0) {
        await pool.query(`
          ALTER TABLE public.notification_channel
            ADD CONSTRAINT notification_channel_name_unique UNIQUE (name)
        `);
        console.log("✅ notification_channel.name UNIQUE constraint added");
      } else {
        console.log("✅ notification_channel.name UNIQUE constraint already exists");
      }

      const { data: existingInApp } = await pool.query(
        `SELECT id FROM public.notification_channel WHERE name = 'IN_APP' LIMIT 1`
      ).then((r: any) => ({ data: r.rows[0] ?? null }));
      if (!existingInApp) {
        await pool.query(
          `INSERT INTO public.notification_channel (name, provider) VALUES ('IN_APP', 'InApp') ON CONFLICT (name) DO NOTHING`
        );
        console.log("✅ IN_APP notification channel inserted");
      } else {
        console.log("✅ IN_APP notification channel already exists");
      }
    } catch (err) {
      console.error("Migration check error (notification_channel dedup):", err);
    }

    // ── 21. notifications.status CHECK constraint — add READ ─────────────────
    try {
      const { rows: checkRows } = await pool.query(`
        SELECT pg_get_constraintdef(con.oid) AS def
        FROM pg_constraint con
        JOIN pg_class cls ON cls.oid = con.conrelid
        JOIN pg_namespace ns ON ns.oid = cls.relnamespace
        WHERE ns.nspname = 'public'
          AND cls.relname = 'notifications'
          AND con.contype = 'c'
          AND con.conname = 'notifications_status_check'
      `);
      const alreadyHasRead = checkRows.length > 0 && checkRows[0].def?.includes("READ");
      if (!alreadyHasRead) {
        await pool.query(`
          ALTER TABLE public.notifications
            DROP CONSTRAINT IF EXISTS notifications_status_check
        `);
        await pool.query(`
          ALTER TABLE public.notifications
            ADD CONSTRAINT notifications_status_check
            CHECK (status::text = ANY (ARRAY['PENDING','SENT','READ','FAILED']::text[]))
        `);
        console.log("✅ notifications.status CHECK constraint updated to include READ");
      } else {
        console.log("✅ notifications.status CHECK already includes READ");
      }
    } catch (err) {
      console.error("Migration check error (notifications.status READ):", err);
    }

    // ── 22. store_id on order_items ───────────────────────────────────────────
    // Persists the store each item belongs to directly on the row so that
    // getByOrderId filtering and invoice generation avoid per-item DB lookups.
    try {
      const storeIdExists = await columnExists(pool, "order_items", "store_id");
      if (!storeIdExists) {
        console.log("⚙️  Applying migration 22: store_id column on order_items");
        await applyColumnMigration(`
          ALTER TABLE public.order_items
            ADD COLUMN IF NOT EXISTS store_id uuid
            REFERENCES public.stores(id) ON DELETE SET NULL;
          CREATE INDEX IF NOT EXISTS idx_order_items_store_id
            ON public.order_items (store_id);
        `);
        console.log("✅ order_items.store_id column and index added");
      } else {
        console.log("✅ order_items.store_id column already exists");
      }
    } catch (err) {
      console.error("Migration check error (order_items.store_id add column):", err);
    }

    // ── 22b. Backfill store_id on existing order_items rows ───────────────────
    try {
      const { rows: nullViaProduct } = await pool.query(`
        SELECT COUNT(*) AS cnt
          FROM public.order_items
         WHERE store_id IS NULL
           AND product_id IS NOT NULL
      `);
      const nullViaMenu = await pool.query(`
        SELECT COUNT(*) AS cnt
          FROM public.order_items
         WHERE store_id IS NULL
           AND menus_id IS NOT NULL
      `);
      const productNullCount = parseInt(nullViaProduct[0].cnt, 10);
      const menuNullCount = parseInt(nullViaMenu.rows[0].cnt, 10);

      if (productNullCount > 0) {
        console.log(`⚙️  Applying migration 22b: backfilling store_id for ${productNullCount} order_item(s) via product_id`);
        const { rowCount: updated22a } = await pool.query(`
          UPDATE public.order_items oi
             SET store_id = p.store_id
            FROM public.products p
           WHERE oi.product_id = p.id
             AND oi.store_id IS NULL
             AND oi.product_id IS NOT NULL
        `);
        console.log(`✅ order_items.store_id backfilled via product_id: ${updated22a ?? 0} row(s) updated`);
      } else {
        console.log("✅ No order_items with product_id need store_id backfill");
      }

      if (menuNullCount > 0) {
        console.log(`⚙️  Applying migration 22b: backfilling store_id for ${menuNullCount} order_item(s) via menus_id`);
        const { rowCount: updated22b } = await pool.query(`
          UPDATE public.order_items oi
             SET store_id = m.store_id
            FROM public.menus m
           WHERE oi.menus_id = m.id
             AND oi.store_id IS NULL
             AND oi.menus_id IS NOT NULL
        `);
        console.log(`✅ order_items.store_id backfilled via menus_id: ${updated22b ?? 0} row(s) updated`);
      } else {
        console.log("✅ No order_items with menus_id need store_id backfill");
      }
    } catch (err) {
      console.error("Migration check error (order_items.store_id backfill):", err);
    }

    // ── 22. notifications.status READ — handled in Section 21 above ──────────

    // ── 24. Add templates.is_global column ──────────────────────────────────────
    try {
      const { rows: isGlobalRows } = await pool.query(`
        SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = 'templates'
            AND column_name  = 'is_global'
      `);
      if (isGlobalRows.length === 0) {
        console.log("⚙️  Applying migration: adding templates.is_global column");
        await applyColumnMigration(
          `ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;`
        );
        console.log("✅ templates.is_global column added");
      } else {
        console.log("✅ templates.is_global already exists");
      }
    } catch (err) {
      console.error("Migration check error (templates.is_global):", err);
    }

    // ── 23. Make party.template_id nullable (Allow custom parties from scratch) ──
    try {
      const { rows } = await pool.query(
        `SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = 'party'
            AND column_name  = 'template_id'
            AND is_nullable  = 'NO'`
      );
      if (rows.length > 0) {
        console.log("⚙️  Applying migration: dropping NOT NULL from party.template_id");
        await applyColumnMigration(
          `ALTER TABLE public.party ALTER COLUMN template_id DROP NOT NULL;`
        );
        console.log("✅ party.template_id is now nullable");
      } else {
        console.log("✅ party.template_id already nullable");
      }
    } catch (err) {
      console.error("Migration check error (party.template_id nullable):", err);
    }

  } catch (err) {
    console.error("Migration check error (main block):", err);
  }

  // ── Supabase-specific column additions ────────────────────────────────────
  // These columns exist in the local helium schema (added above) but may
  // not yet be present in the live Supabase database because Supabase postgres
  // ports are blocked from Replit and DDL cannot be issued via PostgREST.
  // Strategy:
  //   1. If SUPABASE_ACCESS_TOKEN is set, attempt the Supabase Management API.
  //   2. Otherwise, print clear SQL for the operator to run in the SQL editor.
  await (async () => {
    const supabaseUrl = process.env.SUPABASE_URL ?? "";
    const accessToken = process.env.SUPABASE_ACCESS_TOKEN ?? "";
    const projectRef = supabaseUrl.replace("https://", "").replace(".supabase.co", "").split(".")[0];

    const columnSQL = [
      "ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS created_by UUID;",
      "CREATE INDEX IF NOT EXISTS idx_categories_created_by ON public.categories (created_by);",
      "ALTER TABLE public.subcategories ADD COLUMN IF NOT EXISTS created_by UUID;",
      "CREATE INDEX IF NOT EXISTS idx_subcategories_created_by ON public.subcategories (created_by);",
      "ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS store_id UUID;",
      "CREATE INDEX IF NOT EXISTS idx_brands_store_id ON public.brands (store_id);",
      "ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;",
      "CREATE INDEX IF NOT EXISTS idx_order_items_store_id ON public.order_items (store_id);",
      // Backfill store_id from linked products for existing rows
      "UPDATE public.order_items oi SET store_id = p.store_id FROM public.products p WHERE oi.product_id = p.id AND oi.store_id IS NULL AND oi.product_id IS NOT NULL;",
      // Backfill store_id from linked menus for existing rows
      "UPDATE public.order_items oi SET store_id = m.store_id FROM public.menus m WHERE oi.menus_id = m.id AND oi.store_id IS NULL AND oi.menus_id IS NOT NULL;",
      "ALTER TABLE public.party ALTER COLUMN template_id DROP NOT NULL;",
      "ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;",
      // Drop UNIQUE constraint on products.name to allow duplicate product names
      "ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_name_key;",
    ].join("\n");

    if (accessToken && projectRef) {
      try {
        const resp = await fetch(
          `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: columnSQL }),
          }
        );
        if (resp.ok) {
          console.log("✅ Supabase: categories.created_by, brands.store_id, and order_items.store_id columns ensured via Management API");
          return;
        }
        const body = await resp.text();
        console.warn(`[migration] Supabase Management API returned ${resp.status}: ${body.substring(0, 200)}`);
      } catch (e: any) {
        console.warn("[migration] Supabase Management API request failed:", e.message);
      }
    }

    // Probe Supabase via PostgREST to check which columns are actually missing
    const [catProbe, brandProbe, orderItemsProbe, templateProbe] = await Promise.all([
      (DBconnection.from("categories") as any).select("created_by").limit(1),
      (DBconnection.from("brands") as any).select("store_id").limit(1),
      (DBconnection.from("templates") as any).select("is_global").limit(1),
      (DBconnection.from("order_items") as any).select("store_id").limit(1),
    ]);
    const catColMissing = catProbe.error && catProbe.error.message.includes("created_by");
    const brandColMissing = brandProbe.error && brandProbe.error.message.includes("store_id");
    const templateColMissing = templateProbe.error && templateProbe.error.message.includes("is_global");
    const orderItemsColMissing = orderItemsProbe.error && orderItemsProbe.error.message.includes("store_id");

    if (!catColMissing && !brandColMissing && !orderItemsColMissing && !templateColMissing) {
      console.log("✅ Supabase: categories.created_by,order_items.store_id, templates.is_global and brands.store_id columns confirmed");
      return;
    }

    // Only list the SQL that is actually still missing
    const missingSQL: string[] = [];
    if (catColMissing) {
      missingSQL.push(
        "  ALTER TABLE public.categories",
        "    ADD COLUMN IF NOT EXISTS created_by UUID;",
        "  CREATE INDEX IF NOT EXISTS idx_categories_created_by",
        "    ON public.categories (created_by);",
        "  ",
      );
    }
    if (brandColMissing) {
      missingSQL.push(
        "  ALTER TABLE public.brands",
        "    ADD COLUMN IF NOT EXISTS store_id UUID;",
        "  CREATE INDEX IF NOT EXISTS idx_brands_store_id",
        "    ON public.brands (store_id);",
        "  ",
      );
    }
    if (orderItemsColMissing) {
      missingSQL.push(
        "  ALTER TABLE public.order_items",
        "    ADD COLUMN IF NOT EXISTS store_id UUID",
        "    REFERENCES public.stores(id) ON DELETE SET NULL;",
        "  CREATE INDEX IF NOT EXISTS idx_order_items_store_id",
        "    ON public.order_items (store_id);",
        "  -- Backfill from products",
        "  UPDATE public.order_items oi SET store_id = p.store_id",
        "    FROM public.products p",
        "    WHERE oi.product_id = p.id AND oi.store_id IS NULL;",
        "  -- Backfill from menus",
        "  UPDATE public.order_items oi SET store_id = m.store_id",
        "    FROM public.menus m",
        "    WHERE oi.menus_id = m.id AND oi.store_id IS NULL;",
        "  ",
      );
    }
    if (templateColMissing) {
      missingSQL.push(
        "  ALTER TABLE public.templates",
        "    ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;",
        "  ",
      );
    }

    // Always include the constraint drop (safe with IF EXISTS)
    missingSQL.push(
      "  -- Drop UNIQUE constraint on products.name to allow duplicate product names",
      "  ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_name_key;",
      "  ",
    );

    console.warn(
      "\n" +
      "╔══════════════════════════════════════════════════════════════════════╗\n" +
      "║  ACTION NEEDED — Run this SQL in your Supabase SQL editor           ║\n" +
      "║  (Dashboard → SQL Editor → New query → paste → Run)                 ║\n" +
      "╠══════════════════════════════════════════════════════════════════════╣\n" +
      "║                                                                      ║\n" +
      missingSQL.map(l => `║  ${l.padEnd(68)}║`).join("\n") + "\n" +
      "║  The app works without these columns (graceful fallback active)      ║\n" +
      "║  but SubAdmin category scoping and brand-store association           ║\n" +
      "║  will be fully restored once they are added.                         ║\n" +
      "╚══════════════════════════════════════════════════════════════════════╝\n"
    );
  })();

  // ── indexes on users.role_name and (is_active, account_status) ──────────────
  // The GET /api/users/stats endpoint runs parallel COUNT queries filtered by
  // role_name, is_active, and account_status. These indexes make those counts
  // near-instant even with millions of rows. Both are fully idempotent.
  try {
    await applyColumnMigration(`
      CREATE INDEX IF NOT EXISTS idx_users_role_name
        ON public.users (role_name);
      CREATE INDEX IF NOT EXISTS idx_users_is_active_account_status
        ON public.users (is_active, account_status);
    `);
    console.log("✅ users role_name and (is_active, account_status) indexes ensured");
  } catch (err) {
    console.error("Migration check error (users stats indexes):", err);
  }

  // Migration 008: Add created_by to subcategories (idempotent via IF NOT EXISTS)
  try {
    await applyColumnMigration(`
      ALTER TABLE public.subcategories
        ADD COLUMN IF NOT EXISTS created_by UUID;
      CREATE INDEX IF NOT EXISTS idx_subcategories_created_by
        ON public.subcategories (created_by);
    `);
    console.log('subcategories.created_by column ensured');
  } catch (err) {
    console.error('Migration check error (subcategories.created_by):', err);
  }

  // Migration 008b: Add FK on subcategories.created_by → users(id) ON DELETE RESTRICT
  try {
    await applyColumnMigration(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
           WHERE rel.relname  = 'subcategories'
             AND rel.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
             AND con.contype  = 'f'
             AND con.conname  = 'subcategories_created_by_fkey'
        ) THEN
          ALTER TABLE public.subcategories
            ADD CONSTRAINT subcategories_created_by_fkey
            FOREIGN KEY (created_by)
            REFERENCES public.users(id)
            ON DELETE RESTRICT;
        END IF;
      END$$;
    `);
    console.log('subcategories.created_by FK ensured');
  } catch (err) {
    console.error('Migration check error (subcategories.created_by FK):', err);
  }

  // ── 21. Cleanup Store Types ──────────────────────────────────────────────
  try {
    console.log("⚙️  Applying migration: cleaning up store types (Party -> Food)");
    await pool.query(`UPDATE public.stores SET type = 'Food' WHERE type = 'Party'`);
    await pool.query(`UPDATE public.stores SET type = 'Food' WHERE type NOT IN ('Food', 'Bakery', 'Grocery')`);
    console.log("✅ Store types cleaned up");
  } catch (err) {
    console.error("Migration error (cleanup store types):", err);
  }

  // ── Drop UNIQUE constraint from products.name to allow duplicates ──────────
  try {
    // Find all UNIQUE constraints on products table that involve the name column
    const { rows: constraintRows } = await pool.query(`
      SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class cls ON cls.oid = con.conrelid
        JOIN pg_namespace ns ON ns.oid = cls.relnamespace
        JOIN pg_attribute att ON att.attrelid = cls.oid
       WHERE ns.nspname = 'public'
         AND cls.relname = 'products'
         AND con.contype = 'u'
         AND con.conkey @> ARRAY[att.attnum]
         AND att.attname = 'name'
    `);
    
    if (constraintRows.length > 0) {
      for (const constraint of constraintRows) {
        await pool.query(
          `ALTER TABLE public.products DROP CONSTRAINT IF EXISTS "${constraint.conname}"`
        );
      }
      console.log(`✅ UNIQUE constraint(s) on products.name dropped — duplicate product names now allowed`);
    } else {
      console.log("✅ No UNIQUE constraint on products.name found");
    }
  } catch (err) {
    console.error("Migration check error (products.name UNIQUE constraint):", err);
  }

  // ── Final schema cache refresh ─────────────────────────────────────────────
  // Send ONE unconditional NOTIFY after all migration checks complete. This
  // ensures PostgREST always has the current schema on every backend startup,
  // even when Supabase-hosted PostgREST restarts independently of our backend.
  // One NOTIFY per restart is fast (< 1 s) and avoids the blackout caused by
  // multiple NOTIFYs from the old initDB.ts approach.
  await notifyPostgrestReload(
    (msg) => console.log(`[migration] ${msg}`),
    (msg) => console.warn(`[migration] ${msg}`)
  );
  console.log("[migration] schema cache refreshed");
  await pool.end();
}

/**
 * Backfill categories.created_by for any rows that still have NULL, enforce
 * NOT NULL, and add FOREIGN KEY (created_by) REFERENCES public.users(id)
 * ON DELETE RESTRICT.
 *
 * Architecture note
 * ─────────────────
 * This project uses two separate database connections at runtime:
 *
 *   • pool (DATABASE_URL)  → local/dev PostgreSQL used for schema migrations.
 *     This database holds the table structures but NOT the live application rows.
 *     It does NOT have Supabase-specific roles (service_role, authenticator, etc.)
 *     and its public.users table is empty (application data lives in Supabase).
 *
 *   • DBconnection (SUPABASE_URL + service_role key) → Supabase PostgREST.
 *     This is where real application data (users, categories, …) is stored and
 *     read by the API.  DDL cannot be issued via PostgREST.
 *
 * Consequence for FK enforcement
 * ──────────────────────────────
 * A FOREIGN KEY on the pool database's categories table referencing its empty
 * public.users would always fail.  The FK is therefore enforced where it matters:
 * in init.sql (the canonical schema for new deployments) and at the application
 * layer (category.controller.ts sets created_by = req.user.id on every INSERT).
 *
 * This function's job is to:
 *   1. Backfill any NULL created_by rows using the Admin ID obtained from
 *      bootMasterAdmin() (which reads from the real Supabase via DBconnection).
 *   2. Apply NOT NULL on the local/dev schema copy so new category inserts
 *      (which route through the local pool if any) are always validated.
 *   3. Add REFERENCES public.users(id) ON DELETE RESTRICT on the local schema
 *      copy (idempotent) if users rows are visible — skipped with a warning if
 *      the local users table is empty (split-DB dev environment).
 *
 * @param adminId - Admin user ID from bootMasterAdmin().  Required; the server
 *                  shuts down before calling this function if adminId is null.
 */
export async function backfillCategoriesCreatedBy(adminId: string): Promise<void> {
  const rawUrl = process.env.DATABASE_URL!;
  const resolved = getSessionConnectionString(rawUrl);
  const connStr = resolved?.url ?? rawUrl;

  const sessionPool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  try {
    // ── Step 1: Backfill NULL rows using the Admin ID from Supabase ───────────
    const { rows: nullCheck } = await sessionPool.query(
      `SELECT COUNT(*) AS cnt FROM public.categories WHERE created_by IS NULL`
    );
    const nullCount = parseInt(nullCheck[0].cnt, 10);

    if (nullCount === 0) {
      console.log("✅ categories.created_by already fully populated — nothing to backfill");
    } else {
      const { rowCount } = await sessionPool.query(
        `UPDATE public.categories SET created_by = $1 WHERE created_by IS NULL`,
        [adminId]
      );
      console.log(`✅ categories.created_by backfilled ${rowCount ?? 0} row(s) → user ${adminId}`);
    }

    // ── Step 2: Verify no NULLs remain ───────────────────────────────────────
    const { rows: afterCheck } = await sessionPool.query(
      `SELECT COUNT(*) AS cnt FROM public.categories WHERE created_by IS NULL`
    );
    if (parseInt(afterCheck[0].cnt, 10) !== 0) {
      throw new Error(
        "NULL rows remain in categories.created_by after backfill — " +
        "NOT NULL constraint cannot be applied"
      );
    }

    // ── Step 3: Apply NOT NULL ────────────────────────────────────────────────
    const { rows: nullable } = await sessionPool.query(`
      SELECT is_nullable FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name   = 'categories'
         AND column_name  = 'created_by'
    `);
    if (nullable[0]?.is_nullable === "YES") {
      await sessionPool.query(
        `ALTER TABLE public.categories ALTER COLUMN created_by SET NOT NULL`
      );
      console.log("✅ categories.created_by set to NOT NULL");
    } else {
      console.log("✅ categories.created_by is already NOT NULL");
    }

    // ── Step 4: Add FK → public.users ON DELETE RESTRICT (idempotent) ─────────
    // Check whether this FK already exists with the correct target + delete action.
    const { rows: fkRows } = await sessionPool.query(`
      SELECT 1
        FROM pg_constraint con
        JOIN pg_class rel   ON rel.oid = con.conrelid
        JOIN pg_class tgt   ON tgt.oid = con.confrelid
        JOIN pg_namespace n ON n.oid   = tgt.relnamespace
       WHERE rel.relname      = 'categories'
         AND rel.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
         AND con.contype      = 'f'
         AND con.conname      = 'categories_created_by_fkey'
         AND n.nspname        = 'public'
         AND tgt.relname      = 'users'
         AND con.confdeltype  = 'r'
    `);

    if (fkRows.length > 0) {
      console.log("✅ categories.created_by FK already correct (public.users ON DELETE RESTRICT)");
    } else {
      // Only add the FK if the local public.users table is non-empty (i.e. we are
      // connected to the real Supabase database, not the local dev schema copy).
      const { rows: userCount } = await sessionPool.query(
        `SELECT COUNT(*) AS cnt FROM public.users`
      );
      if (parseInt(userCount[0].cnt, 10) === 0) {
        console.warn(
          "⚠️  categories.created_by FK skipped: public.users is empty on this connection. " +
          "FK is enforced in init.sql (for new deployments) and at the application layer."
        );
      } else {
        await sessionPool.query(`
          ALTER TABLE public.categories
            ADD CONSTRAINT categories_created_by_fkey
            FOREIGN KEY (created_by)
            REFERENCES public.users(id)
            ON DELETE RESTRICT
        `);
        console.log("✅ categories.created_by FK → public.users ON DELETE RESTRICT added");
      }
    }

  } catch (err) {
    await sessionPool.end().catch(() => { });
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`backfillCategoriesCreatedBy failed: ${message}`);
  } finally {
    await sessionPool.end().catch(() => { });
  }
}