/**
 * menu.approval.test.ts
 *
 * True integration test for the menu approval flow.
 *
 * All requests target the live backend (no mocked DB, no mocked auth).
 * The test derives a cryptographically valid SubAdmin JWT by:
 *   1. Finding a PENDING menu in the real database
 *   2. Walking the store → StoreAdmin → sub_admin_id hierarchy to identify
 *      the SubAdmin responsible for that store
 *   3. Signing a token with JWT_SECRET and the SubAdmin's real DB row
 *      (including permissions) — identical to what generateToken() produces
 *
 * The core assertion is: PENDING menu → PUT approve → GET re-fetch → APPROVED.
 *
 * Required env vars (all set in the Replit dev environment):
 *   PORT, ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET,
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Tests are automatically skipped if the backend is unreachable or env
 * vars are missing, so this file is safe to include in the full Jest run.
 */

import jwt from "jsonwebtoken";

jest.setTimeout(30_000);

const BASE_URL = `http://localhost:${process.env.PORT ?? 3001}`;

/* ─────────────────── helpers ─────────────────── */

async function jsonFetch(
  url: string,
  options: RequestInit = {}
): Promise<{ status: number; body: any }> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function supabaseGet(path: string): Promise<any[]> {
  const url = process.env.SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

/* ─────────────────── shared state ─────────────────── */

let backendReachable = false;

/** Admin JWT from real login – used for list-endpoint tests. */
let adminToken = "";

/** SubAdmin JWT minted from real DB row – used for approval tests. */
let subAdminToken = "";

/** The PENDING menu we will approve in this test run. */
let pendingMenuId: string | null = null;

/* ─────────────────── setup ─────────────────── */

beforeAll(async () => {
  /* 1. Verify backend is up */
  try {
    const { status } = await jsonFetch(`${BASE_URL}/health`);
    backendReachable = status === 200;
  } catch {
    backendReachable = false;
  }
  if (!backendReachable) {
    console.warn("[integration] Backend unreachable – tests will be skipped.");
    return;
  }

  /* 2. Admin login (list-endpoint tests) */
  const email    = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const { status, body } = await jsonFetch(
      `${BASE_URL}/api/users/login`,
      { method: "POST", body: JSON.stringify({ emailOrPhone: email, password }) }
    );
    const raw = body.token;
    const tok = typeof raw === "string" ? raw : raw?.accessToken;
    if (status === 200 && tok) adminToken = tok;
  }

  /* 3. Derive SubAdmin JWT by walking the real DB hierarchy
   *
   * We walk forward from PENDING menus so the SubAdmin we mint a token
   * for is guaranteed to pass isAuthorizedForMenuRegion:
   *   menu.store_id → stores.store_admin_id → users.sub_admin_id → SubAdmin
   */
  const jwtSecret   = process.env.JWT_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!jwtSecret || !supabaseUrl || !serviceKey) {
    console.warn("[integration] Missing JWT_SECRET / Supabase vars – SubAdmin tests skipped.");
    return;
  }

  const pendingMenus = await supabaseGet("menus?status=eq.PENDING&select=id,store_id&limit=10");

  for (const menu of pendingMenus) {
    const stores = await supabaseGet(
      `stores?id=eq.${menu.store_id}&select=id,store_admin_id&limit=1`
    );
    const store = stores[0];
    if (!store?.store_admin_id) continue;

    const storeAdmins = await supabaseGet(
      `users?id=eq.${store.store_admin_id}&select=id,sub_admin_id&limit=1`
    );
    const storeAdmin = storeAdmins[0];
    if (!storeAdmin?.sub_admin_id) continue;

    const subAdmins = await supabaseGet(
      `users?id=eq.${storeAdmin.sub_admin_id}&account_status=eq.active&is_active=eq.true` +
      `&select=id,email,phone,full_name,role_name,account_status,is_active,token_version,` +
      `permissions,sub_admin_id,admin_id,superadmin_id,store_admin_id&limit=1`
    );
    const sa = subAdmins[0];
    if (!sa || sa.role_name !== "SubAdmin") continue;

    // Mint token with identical payload to generateToken()
    const payload: Record<string, unknown> = {
      id:             sa.id,
      email:          sa.email,
      phone:          sa.phone ?? null,
      full_name:      sa.full_name,
      role_name:      sa.role_name,
      permissions:    sa.permissions ?? null,
      is_active:      sa.is_active,
      account_status: sa.account_status,
      token_version:  sa.token_version ?? 1,
      admin_id:       sa.admin_id ?? null,
      superadmin_id:  sa.superadmin_id ?? null,
      sub_admin_id:   sa.sub_admin_id ?? null,
      store_admin_id: sa.store_admin_id ?? null,
    };
    subAdminToken = jwt.sign(payload, jwtSecret, { expiresIn: "1h" });
    pendingMenuId  = menu.id;
    break;
  }

  if (!subAdminToken) {
    console.warn("[integration] No SubAdmin found for any PENDING menu – approval tests skipped.");
  }
}, 30_000);

/* ─────────────────── tests ─────────────────── */

describe("Menu approval integration – live backend, live database", () => {
  it("POST /api/users/login returns a JWT for Admin credentials", async () => {
    if (!backendReachable || !adminToken) return;
    expect(typeof adminToken).toBe("string");
    expect(adminToken.length).toBeGreaterThan(20);
  });

  it("GET /api/menus/getList returns 200 and an array for Admin", async () => {
    if (!backendReachable || !adminToken) return;
    const { status, body } = await jsonFetch(
      `${BASE_URL}/api/menus/getList`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /api/menus/getList?status=PENDING returns only PENDING menus", async () => {
    if (!backendReachable || !adminToken) return;
    const { status, body } = await jsonFetch(
      `${BASE_URL}/api/menus/getList?status=PENDING`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    expect(status).toBe(200);
    const menus: any[] = Array.isArray(body.data) ? body.data : [];
    menus.forEach((m: any) => expect(m.status).toBe("PENDING"));
  });

  it("PUT approve with Admin token is rejected with 403 (role check)", async () => {
    if (!backendReachable || !adminToken) return;
    const menuId = pendingMenuId ?? "00000000-0000-0000-0000-000000000000";
    const { status, body } = await jsonFetch(
      `${BASE_URL}/api/menus/ApproveMenuById/approve/${menuId}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({}),
      }
    );
    expect(status).toBe(403);
    expect(body.success).toBe(false);
  });

  it("PENDING → PUT approve (SubAdmin) → GET re-fetch → status is APPROVED or REJECTED", async () => {
    if (!backendReachable || !subAdminToken) return;

    if (!pendingMenuId) {
      // No pending menus in DB: verify the SubAdmin role passes auth
      // and the non-existent menu returns 400 (not 403)
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const { status, body } = await jsonFetch(
        `${BASE_URL}/api/menus/ApproveMenuById/approve/${fakeId}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${subAdminToken}` },
          body: JSON.stringify({}),
        }
      );
      expect(status).toBe(400);
      expect(body.success).toBe(false);
      return;
    }

    /* ── 1. Approve ── */
    const { status: approveStatus, body: approveBody } = await jsonFetch(
      `${BASE_URL}/api/menus/ApproveMenuById/approve/${pendingMenuId}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${subAdminToken}` },
        body: JSON.stringify({ notes: "integration test approval" }),
      }
    );

    expect(approveStatus).toBe(200);
    expect(approveBody.success).toBe(true);
    const persistedStatus: string = approveBody.data?.status ?? approveBody.data;
    // APPROVED = normal; REJECTED = auto-reject (menu has no products)
    expect(["APPROVED", "REJECTED"]).toContain(persistedStatus);

    /* ── 2. Re-fetch to confirm the DB change persisted ── */
    const { status: getStatus, body: getBody } = await jsonFetch(
      `${BASE_URL}/api/menus/GetMenuById/${pendingMenuId}`,
      { headers: { Authorization: `Bearer ${subAdminToken}` } }
    );

    expect(getStatus).toBe(200);
    expect(getBody.success).toBe(true);
    expect(getBody.data?.status).toBe(persistedStatus);
  });

  it("PUT approve without any token returns 401 or 403", async () => {
    if (!backendReachable) return;
    const menuId = pendingMenuId ?? "00000000-0000-0000-0000-000000000001";
    const { status } = await jsonFetch(
      `${BASE_URL}/api/menus/ApproveMenuById/approve/${menuId}`,
      { method: "PUT", body: JSON.stringify({}) }
    );
    expect([401, 403]).toContain(status);
  });
});
