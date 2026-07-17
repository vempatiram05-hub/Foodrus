import { DBconnection } from "./config/DBConnect";

async function run() {
  try {
    const { data: users } = await DBconnection.from("users").select("id, email, phone, role_name, sub_admin_id, store_admin_id");
    console.log("Users in DB:", JSON.stringify(users, null, 2));
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
