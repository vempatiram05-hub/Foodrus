
/* ======================================================================
 * menu.notification.test.ts
 *
 * Integration tests for notifySubAdminsOfSubmission — verifies that the
 * hierarchy-based lookup (store → store_admin_id → users.sub_admin_id)
 * correctly identifies the responsible SubAdmin and sends them an email
 * and an in-app notification.
 *
 * The old implementation used region-based lookup (sub_admin_regions).
 * This file confirms the new hierarchy path works correctly and that
 * auth and notification targets are consistent.
 *
 * DB call sequence inside notifySubAdminsOfSubmission:
 *   1. from("stores").select("store_admin_id").eq("id", storeId).single()
 *   2. from("users").select("sub_admin_id").eq("id", storeAdminId).single()
 *   3. from("users").select("id, email, full_name").eq("id", subAdminId)
 *        .eq("role_name", "SubAdmin").single()
 *   4. from("notification_channel").select("id").eq("name","MAILGUN").single()
 *   5. from("notifications").insert({ ... })
 * ====================================================================== */

/* ================= MOCKS ================= */
jest.mock("../config/DBConnect", () => ({
  DBconnection: { from: jest.fn() },
}));

jest.mock("../utils/mailer", () => ({
  sendHtmlEmail: jest.fn().mockResolvedValue(undefined),
}));

import { notifySubAdminsOfSubmission } from "../services/menuNotification.service";
import { DBconnection } from "../config/DBConnect";
import { sendHtmlEmail } from "../utils/mailer";

/* ================= CONSTANTS ================= */
const STORE_ID       = "store-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const STORE_ADMIN_ID = "sadmin-bb-bbbb-bbbb-bbbbbbbbbbbb";
const SUBADMIN_ID    = "subadm-cc-cccc-cccc-cccccccccccc";
const CHANNEL_ID     = "channel-dd-dddd-dddd-dddddddddddd";

const BASE_PARAMS = {
  storeId: STORE_ID,
  storeName: "Test Bistro",
  targetDate: "2026-06-15",
  slotName: "Lunch",
  revisionCount: 0,
};

const mockFrom = DBconnection.from as jest.Mock;
const mockSendHtmlEmail = sendHtmlEmail as jest.Mock;

/* ================= HELPERS ================= */
/**
 * Returns a chainable Supabase query stub.
 * The terminalMethod resolves to value; all other methods return the chain.
 */
function makeChain(value: object, terminalMethod = "single") {
  const chain: any = {};
  const methods = ["select", "eq", "neq", "in", "is", "single", "maybeSingle",
                   "insert", "update", "order", "limit"];
  methods.forEach((m) => {
    chain[m] = m === terminalMethod
      ? jest.fn().mockResolvedValue(value)
      : jest.fn().mockReturnValue(chain);
  });
  return chain;
}

/**
 * Stubs the full happy-path DB sequence for notifySubAdminsOfSubmission.
 * Returns mock objects so tests can inspect them.
 */
function stubHappyPath() {
  const storeChain        = makeChain({ data: { store_admin_id: STORE_ADMIN_ID }, error: null });
  const storeAdminChain   = makeChain({ data: { sub_admin_id: SUBADMIN_ID }, error: null });
  const subAdminChain     = makeChain({
    data: { id: SUBADMIN_ID, email: "sub@test.com", full_name: "Sub Admin" },
    error: null,
  });
  const channelChain      = makeChain({ data: { id: CHANNEL_ID }, error: null }, "maybeSingle");
  const notifyInsertChain = makeChain({ data: null, error: null }, "insert");

  mockFrom
    .mockReturnValueOnce(storeChain)        // 1. stores → store_admin_id
    .mockReturnValueOnce(storeAdminChain)   // 2. users  → sub_admin_id
    .mockReturnValueOnce(subAdminChain)     // 3. users  → SubAdmin details
    .mockReturnValueOnce(channelChain)      // 4. notification_channel → id
    .mockReturnValueOnce(notifyInsertChain);// 5. notifications.insert

  return { storeChain, storeAdminChain, subAdminChain, channelChain, notifyInsertChain };
}

/* ======================================================================
 * TESTS
 * ==================================================================== */

describe("notifySubAdminsOfSubmission – hierarchy-based lookup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ── Happy path ── */

  it("sends an email to the responsible SubAdmin on a successful first submission", async () => {
    stubHappyPath();

    await notifySubAdminsOfSubmission(BASE_PARAMS);

    expect(mockSendHtmlEmail).toHaveBeenCalledTimes(1);
    expect(mockSendHtmlEmail).toHaveBeenCalledWith(
      "sub@test.com",
      expect.stringContaining("Test Bistro"),
      expect.any(String)
    );
  });

  it("uses the store → store_admin_id → sub_admin_id hierarchy (not region tables)", async () => {
    stubHappyPath();

    await notifySubAdminsOfSubmission(BASE_PARAMS);

    // The first from() call must be on "stores" selecting "store_admin_id"
    expect(mockFrom).toHaveBeenNthCalledWith(1, "stores");
    // The second from() call must be on "users" to get sub_admin_id
    expect(mockFrom).toHaveBeenNthCalledWith(2, "users");
    // The third from() call must be on "users" again for SubAdmin contact details
    expect(mockFrom).toHaveBeenNthCalledWith(3, "users");
    // "sub_admin_regions" must NEVER be queried
    const allCallArgs = mockFrom.mock.calls.map(([table]: any) => table);
    expect(allCallArgs).not.toContain("sub_admin_regions");
  });

  it("creates an in-app notification for the SubAdmin", async () => {
    stubHappyPath();

    await notifySubAdminsOfSubmission(BASE_PARAMS);

    // The notification_channel query must happen
    expect(mockFrom).toHaveBeenCalledWith("notification_channel");
    // The notifications insert must happen
    expect(mockFrom).toHaveBeenCalledWith("notifications");
  });

  it("includes revision label in the email subject when revisionCount > 0", async () => {
    stubHappyPath();

    await notifySubAdminsOfSubmission({ ...BASE_PARAMS, revisionCount: 2 });

    expect(mockSendHtmlEmail).toHaveBeenCalledWith(
      "sub@test.com",
      expect.stringContaining("Revision 3"),
      expect.any(String)
    );
  });

  it("does NOT include revision label when revisionCount is 0", async () => {
    stubHappyPath();

    await notifySubAdminsOfSubmission({ ...BASE_PARAMS, revisionCount: 0 });

    const [, subject] = mockSendHtmlEmail.mock.calls[0];
    expect(subject).not.toContain("Revision");
  });

  /* ── Early-exit conditions ── */

  it("sends no email when the store has no StoreAdmin assigned", async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: { store_admin_id: null }, error: null }));

    await notifySubAdminsOfSubmission(BASE_PARAMS);

    expect(mockSendHtmlEmail).not.toHaveBeenCalled();
  });

  it("sends no email when the StoreAdmin has no sub_admin_id", async () => {
    mockFrom
      .mockReturnValueOnce(makeChain({ data: { store_admin_id: STORE_ADMIN_ID }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { sub_admin_id: null }, error: null }));

    await notifySubAdminsOfSubmission(BASE_PARAMS);

    expect(mockSendHtmlEmail).not.toHaveBeenCalled();
  });

  it("sends no email when the SubAdmin user record is not found", async () => {
    mockFrom
      .mockReturnValueOnce(makeChain({ data: { store_admin_id: STORE_ADMIN_ID }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { sub_admin_id: SUBADMIN_ID }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null })); // SubAdmin not found

    await notifySubAdminsOfSubmission(BASE_PARAMS);

    expect(mockSendHtmlEmail).not.toHaveBeenCalled();
  });

  it("sends no email when the store record itself is not found", async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: null, error: { message: "not found" } }));

    await notifySubAdminsOfSubmission(BASE_PARAMS);

    expect(mockSendHtmlEmail).not.toHaveBeenCalled();
  });

  /* ── Resilience ── */

  it("does not throw when sendHtmlEmail rejects (email failure is non-fatal)", async () => {
    stubHappyPath();
    mockSendHtmlEmail.mockRejectedValue(new Error("SMTP timeout"));

    await expect(notifySubAdminsOfSubmission(BASE_PARAMS)).resolves.toBeUndefined();
  });
});
