/**
 * Generates a structured SKU for a product.
 * Pattern: [CAT]-[PROD]-[RANDOM]
 * 
 * @param categoryName - Name of the product category
 * @param productName - Name of the product
 * @returns A string representing the generated SKU
 */
export function generateSKU(categoryName: string, productName: string): string {
  // Sanitize and take first 3 characters of Category Name
  const catPart = (categoryName || "GEN")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3);

  // Sanitize and take first 3 characters of Product Name
  const prodPart = (productName || "PROD")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3);

  // Generate a timestamp-based part (last 6 chars of base-36 time)
  // This changes every millisecond and only repeats every 25 days.
  const timePart = Date.now().toString(36).slice(-6).toUpperCase();

  // Generate a random 3-character alphanumeric string for extra collision protection
  const randomPart = Math.random().toString(36).substring(2, 5).toUpperCase();

  return `${catPart}-${prodPart}-${timePart}${randomPart}`;
}
