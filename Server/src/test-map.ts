import { DBconnection } from "./config/DBConnect";

async function run() {
  try {
    const { data: categories } = await DBconnection.from("categories").select("*");
    for (const cat of (categories ?? [])) {
      console.log("-------------------");
      console.log("Name:", cat.name);
      console.log("raw images:", cat.images);
      console.log("type of raw images:", typeof cat.images);
      console.log("Is array:", Array.isArray(cat.images));
      if (Array.isArray(cat.images)) {
        console.log("Array length:", cat.images.length);
        cat.images.forEach((val: any, idx: number) => {
          console.log(`  element ${idx}:`, typeof val, JSON.stringify(val));
        });
      } else if (typeof cat.images === "string") {
        try {
          const parsed = JSON.parse(cat.images);
          console.log("parsed images:", parsed);
          console.log("type of parsed images:", typeof parsed);
          console.log("Is parsed array:", Array.isArray(parsed));
          if (Array.isArray(parsed)) {
            console.log("Parsed Array length:", parsed.length);
            parsed.forEach((val: any, idx: number) => {
              console.log(`  parsed element ${idx}:`, typeof val, JSON.stringify(val));
            });
          }
        } catch (e: any) {
          console.log("failed to parse string:", e.message);
        }
      }
    }
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
