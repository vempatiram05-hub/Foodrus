import { DBconnection } from "./config/DBConnect";

async function run() {
  try {
    // 1. Get all stores
    const { data: stores } = await DBconnection.from("stores").select("id, name");
    console.log("Stores in DB:", JSON.stringify(stores, null, 2));

    // 2. Get all products and their category_id
    const { data: products } = await DBconnection.from("products").select("id, name, store_id, category_id");
    console.log("Products in DB:", JSON.stringify(products, null, 2));

    // 3. Test getList query (Admin/Customer with no auth)
    const { data: categories } = await DBconnection.from("categories").select("id, name, description, is_active, type, images, created_at, updated_at, created_by");
    console.log("Categories base query result:", JSON.stringify(categories, null, 2));

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
