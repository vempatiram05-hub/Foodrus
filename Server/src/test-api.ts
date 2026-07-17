import request from "supertest";
import app from "../app";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

const createToken = (id: string, email: string, role: string, subAdminId: string | null = null) => {
  const payload = {
    id,
    email,
    phone: "+919876543210",
    full_name: "Test User",
    role_name: role,
    permissions: {},
    is_active: true,
    account_status: "active",
    token_version: 1,
    sub_admin_id: subAdminId
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
};

async function run() {
  try {
    const adminToken = createToken("99c83506-38c2-462c-8a10-3830160c6ca5", "admin@gmail.com", "Admin");
    const storeAdminToken = createToken("f5828f9f-e00e-4094-8971-4a168587c409", "storeadmin1@gmail.com", "StoreAdmin");

    console.log("--- Requesting getList PUBLIC ---");
    const resPublic = await request(app).get("/api/categories/getList");
    console.log("Status:", resPublic.status);
    console.log("Response Body:", JSON.stringify(resPublic.body, null, 2));

    console.log("--- Requesting getList ADMIN ---");
    const resAdmin = await request(app)
      .get("/api/categories/getList")
      .set("Authorization", `Bearer ${adminToken}`);
    console.log("Status:", resAdmin.status);
    console.log("Response Body:", JSON.stringify(resAdmin.body, null, 2));

    console.log("--- Requesting getList STOREADMIN ---");
    const resStoreAdmin = await request(app)
      .get("/api/categories/getList")
      .set("Authorization", `Bearer ${storeAdminToken}`);
    console.log("Status:", resStoreAdmin.status);
    console.log("Response Body:", JSON.stringify(resStoreAdmin.body, null, 2));

    // GetCategoryByStoreId
    const storeId = "5f0f632c-0422-4256-8d7b-dce14815f858";
    console.log(`--- Requesting getCategoryByStoreId for store ${storeId} ---`);
    const resByStore = await request(app).get(`/api/categories/getCategoryByStoreId/${storeId}`);
    console.log("Status:", resByStore.status);
    console.log("Response Body:", JSON.stringify(resByStore.body, null, 2));

    console.log("--- Requesting subcategories/getList STOREADMIN ---");
    const resSubStoreAdmin = await request(app)
      .get("/api/subcategories/getList")
      .set("Authorization", `Bearer ${storeAdminToken}`);
    console.log("Status:", resSubStoreAdmin.status);
    console.log("Response Body:", JSON.stringify(resSubStoreAdmin.body, null, 2));

    console.log("--- Requesting templates/getList STOREADMIN ---");
    const resTemplateStoreAdmin = await request(app)
      .get("/api/templates/getList")
      .set("Authorization", `Bearer ${storeAdminToken}`);
    console.log("Status:", resTemplateStoreAdmin.status);
    console.log("Response Body:", JSON.stringify(resTemplateStoreAdmin.body, null, 2));

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
