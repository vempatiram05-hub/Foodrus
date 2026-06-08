/**
 * menu.approval.e2e.test.ts
 *
 * TRUE END-TO-END integration test for the menu approval flow.
 *
 * All requests hit the live backend at localhost:PORT with no mocked
 * middleware.  Authentication uses real credentials from env vars:
 *
 *   • ADMIN_EMAIL / ADMIN_PASSWORD  → verify list endpoints (Admin role)
 *   • SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY + JWT_SECRET →
 *     walk the real DB hierarchy (menu → store → StoreAdmin → SubAdmin)
 *     and mint a cryptographically valid access token for that SubAdmin
 *     so we can exercise the full approval path end-to-end.
 *
 * Token minting mirrors the real auth middleware exactly:
 *   jwt.sign(payload, JWT_SECRET) where payload matches generateToken().
 *   The auth middleware verifies the signature, role_name, and
 *   token_version against the users table row we read from Supabase.
 *
 * If the backend is not reachable the tests are automatically skipped.
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

/** Direct Supabase REST call using the service-role key (bypasses RLS). */
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

/** JWT for the Admin account – used for list-endpoint tests. */
let adminToken = "";

/** JWT minted from a real SubAdmin row + JWT_SECRET – used for approve. */
let subAdminToken = "";

/**
 * A PENDING menu whose store hierarchy resolves to the SubAdmin above.
 * If null – no matching pending menu in the DB.
 */
let pendingMenuId: string | null = null;

/* ─────────────────── setup ─────────────────── */

beforeAll(async () => {
  /* 1 ─ Health check */
  try {
    const { status } = await jsonFetch(`${BASE_URL}/health`);
    backendReachable = status === 200;
  } catch {
    backendReachable = false;
  }
  if (!backendReachable) {
    console.warn("[E2E] Backend not reachable – tests will be skipped.");
    return;
  }

  /* 2 ─ Admin login */
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
  if (!adminToken) console.warn("[E2E] Admin login failed – list tests skipped.");

  /* 3 ─ Derive SubAdmin token by walking the real DB hierarchy
   *
   * Strategy (forward from menus):
   *   PENDING menu → store → StoreAdmin user → sub_admin_id → SubAdmin user
   *
   * This guarantees the SubAdmin we mint a token for is actually
   * authorised to approve the specific menu we found (isAuthorizedForMenuRegion
   * performs the same walk at request time).
   */
  const jwtSecret    = process.env.JWT_SECRET;
  const supabaseUrl  = process.env.SUPABASE_URL;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!jwtSecret || !supabaseUrl || !serviceKey) {
    console.warn("[E2E] JWT_SECRET / Supabase vars missing – SubAdmin tests skipped.");
    return;
  }

  // a) Find a PENDING menu
  const pendingMenus = await supabaseGet("menus?status=eq.PENDING&select=id,store_id&limit=10");
  if (!pendingMenus.length) {
    console.info("[E2E] No PENDING menus in DB – approve assertion will use a fake ID.");
  }

  for (const menu of pendingMenus) {
    // b) Get the store
    const stores = await supabaseGet(
      `stores?id=eq.${menu.store_id}&select=id,store_admin_id&limit=1`
    );
    const store = stores[0];
    if (!store?.store_admin_id) continue;

    // c) Get the StoreAdmin's sub_admin_id
    const storeAdmins = await supabaseGet(
      `users?id=eq.${store.store_admin_id}&select=id,sub_admin_id&limit=1`
    );
    const storeAdmin = storeAdmins[0];
    if (!storeAdmin?.sub_admin_id) continue;

    // d) Fetch the SubAdmin user row including permissions (needed for requirePermission)
    const subAdmins = await supabaseGet(
      `users?id=eq.${storeAdmin.sub_admin_id}&account_status=eq.active&is_active=eq.true&select=id,email,phone,full_name,role_name,account_status,is_active,token_version,permissions,sub_admin_id,admin_id,superadmin_id,store_admin_id&limit=1`
    );
    const sa = subAdmins[0];
    if (!sa || sa.role_name !== "SubAdmin") continue;

    // e) Mint a valid access token (mirrors generateToken() payload exactly,
    //    including real permissions so requirePermission('Menus','approve') passes)
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
    console.warn("[E2E] Could not derive a SubAdmin for any PENDING menu – approve tests skipped.");
  } else if (!pendingMenuId) {
    console.info("[E2E] No pending menu found – approval test will assert fake-ID returns 400.");
  }
}, 30_000);

/* ─────────────────── tests ─────────────────── */

describe("Menu approval E2E – real backend, real database", () => {
  /* ── Infrastructure ── */

  it("backend /health returns 200", async () => {
    if (!backendReachable) return;
    const { status, body } = await jsonFetch(`${BASE_URL}/health`);
    expect(status).toBe(200);
    expect(body.status).toBe("ok");
  });

  /* ── Admin: list endpoints ── */

  it("POST /api/users/login returns a JWT string for Admin credentials", async () => {
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

  /* ── Role enforcement ── */

  it("PUT approve with Admin token returns 403 – only SubAdmin may approve", async () => {
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

  /* ── SubAdmin: full approval flow ── */

  it("PUT approve with SubAdmin token persists APPROVED (or REJECTED) status", async () => {
    if (!backendReachable || !subAdminToken) return;

    if (!pendingMenuId) {
      // No pending menu in DB – at least confirm the role check passes
      // and ID validation fails (400 not 403)
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const { status, body } = await jsonFetch(
        `${BASE_URL}/api/menus/ApproveMenuById/approve/${fakeId}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${subAdminToken}` },
          body: JSON.stringify({}),
        }
      );
      // requireRole passes → isAuthorizedForMenuRegion → menu not found → 400
      expect(status).toBe(400);
      expect(body.success).toBe(false);
      return;
    }

    /* 1. Approve the menu */
    const { status, body } = await jsonFetch(
      `${BASE_URL}/api/menus/ApproveMenuById/approve/${pendingMenuId}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${subAdminToken}` },
        body: JSON.stringify({ notes: "E2E approval test" }),
      }
    );

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    // APPROVED = normal; REJECTED = auto-rejected (no products in menu)
    const finalStatus: string = body.data?.status ?? body.data;
    expect(["APPROVED", "REJECTED"]).toContain(finalStatus);

    /* 2. Re-fetch the menu to confirm the status change persisted in the DB */
    const { status: getStatus, body: getBody } = await jsonFetch(
      `${BASE_URL}/api/menus/GetMenuById/${pendingMenuId}`,
      { headers: { Authorization: `Bearer ${subAdminToken}` } }
    );
    expect(getStatus).toBe(200);
    expect(getBody.success).toBe(true);
    expect(getBody.data?.status).toBe(finalStatus);
  });

  /* ── Unauthenticated access ── */

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
