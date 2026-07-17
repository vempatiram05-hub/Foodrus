import { DBconnection } from "./config/DBConnect";

async function run() {
  try {
    // 1. Get an existing store
    const { data: stores } = await DBconnection.from("stores").select("id, name");
    if (!stores || stores.length === 0) {
      console.log("No stores found in DB");
      process.exit(1);
    }
    const storeId = stores[0].id;
    console.log("Using Store ID:", storeId, "Name:", stores[0].name);

    // 2. Get an existing category
    const { data: categories } = await DBconnection.from("categories").select("id, name");
    if (!categories || categories.length === 0) {
      console.log("No categories found in DB");
      process.exit(1);
    }
    const categoryId = categories[0].id;
    console.log("Using Category ID:", categoryId, "Name:", categories[0].name);

    // 3. Create a product linked to this store and category to test the association
    const prodPayload = {
      name: "Test Product " + Date.now(),
      store_id: storeId,
      category_id: categoryId,
      base_price: 10.0,
      quantity: 100,
      is_active: 1,
      approval_status: "APPROVED"
    };

    console.log("Inserting test product...");
    const { data: insertedProduct, error: insertErr } = await DBconnection.from("products").insert(prodPayload);
    if (insertErr) {
      console.error("Insert product error:", insertErr);
      process.exit(1);
    }
    console.log("Inserted Product:", insertedProduct);

    // 4. Now execute getByStoreId query logic
    // ── 2. Get distinct category_id values from products of this store ──
    const { data: products, error: prodErr } = await DBconnection
      .from("products").select("category_id").eq("store_id", storeId);
    if (prodErr) throw prodErr;

    console.log("Products found for store:", products);

    const categoryIds = Array.from(
      new Set(
        (products ?? [])
          .map((p: any) => p.category_id)
          .filter(Boolean)
      )
    );

    console.log("Distinct category IDs:", categoryIds);

    if (categoryIds.length === 0) {
      console.log("No category IDs found for store products");
    } else {
      const { data: storeCategories, error: catErr } = await DBconnection
        .from("categories")
        .select("*")
        .in("id", categoryIds);
      if (catErr) throw catErr;
      console.log("Categories found by getByStoreId logic:", storeCategories);
    }

    // Clean up: delete the inserted test product
    if (insertedProduct && (insertedProduct as any).id) {
      console.log("Cleaning up inserted product...");
      await DBconnection.from("products").delete().eq("id", (insertedProduct as any).id);
    }

    process.exit(0);
  } catch (err) {
    console.error("Error in test:", err);
    process.exit(1);
  }
}

run();
