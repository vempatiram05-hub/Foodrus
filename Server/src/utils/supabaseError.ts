type OperationType = "create" | "update" | "delete" | "read";
type ReadSubtype = "getById" | "getAll" | "getRelated" | undefined;

export function normalizeSupabaseError(
  err: any,
  operation: OperationType = "read",
  subtype?: ReadSubtype
):  { message: string } {
  if (!err) {
    if (operation === "read") {
      switch (subtype) {
        case "getById":
          return { message: "Failed to retrieve the item by ID. Please try again later." };
        case "getAll":
          return { message: "Failed to retrieve the list of items. Please try again later." };
        case "getRelated":
          return { message: "Failed to retrieve related data for this item. Please try again later." };
        default:
          return { message: "Something went wrong while fetching data. Please try again later." };
      }
    }
    switch (operation) {
      case "create":
        return { message: "Failed to create the item. Please try again later." };
      case "update":
        return { message: "Failed to update the item. Please try again later." };
      case "delete":
        return { message: "Failed to delete the item. Please try again later." };
      default:
        return { message: "Something went wrong with the database. Please try again later." };
    }
  }

  // Foreign key constraint violation (cannot delete item used elsewhere)
  if (
    err.code === "23503" ||
    err.errno === 1451 ||
    err.errno === 1452 ||
    err.code === "ER_ROW_IS_REFERENCED_2" ||
    err.code === "ER_NO_REFERENCED_ROW_2" ||
    (err.message && /violates foreign key constraint|foreign key constraint/i.test(err.message)) ||
    (err.details && /violates foreign key constraint|foreign key constraint/i.test(err.details))
  ) {
    if (operation === "delete") {
      return { message: "Cannot delete this item because it is referenced by other records. Remove or update those records first." };
    }
    if (operation === "read" && subtype === "getRelated") {
      return { message: "Failed to retrieve related data because of missing or invalid references." };
    }
    return { message: "This item is referenced by other records and cannot be modified as requested. Give the proper id's(identifiers)." };
  }

  // Unique constraint violation
  if (
    err.code === "23505" ||
    err.errno === 1062 ||
    err.code === "ER_DUP_ENTRY" ||
    (err.message && /duplicate entry|unique/i.test(err.message)) ||
    (err.details && /unique/i.test(err.details))
  ) {
    switch (operation) {
      case "create":
        return { message: "Creation failed: this entry already exists. Please use a different value or check for duplicates." };
      case "update":
        return { message: "Update failed: this value would duplicate an existing entry." };
      default:
        return { message: "This entry already exists. Please use a different value or check for duplicates." };
    }
  }

  // Not found
  if (
    err.code === "PGRST116" ||
    (err.details && /not found/i.test(err.details))
  ) {
    if (operation === "read") {
      switch (subtype) {
        case "getById":
          return { message: "Item with the specified ID was not found." };
        case "getAll":
          return { message: "No items found." };
        case "getRelated":
          return { message: "Related data for this item was not found." };
        default:
          return { message: "The requested item was not found. Please check your input and try again." };
      }
    }
    switch (operation) {
      case "update":
        return { message: "Update failed: the item you are trying to update was not found." };
      case "delete":
        return { message: "Delete failed: the item you are trying to delete was not found." };
      default:
        return { message: "The requested item was not found. Please check your input and try again." };
    }
  }

  // Connection or authentication issues
  if (
    err.code === "28P01" ||
    err.errno === 1045 ||
    err.code === "ER_ACCESS_DENIED_ERROR" ||
    (err.details && /authentication/i.test(err.details))
  ) {
    return { message: "Database authentication failed. Please contact support." };
  }
  if (
    err.code === "ECONNREFUSED" ||
    err.errno === 2003 ||
    err.code === "ER_CONN_HOST_ERROR" ||
    (err.details && /connection/i.test(err.details))
  ) {
    return { message: "Unable to connect to the database. Please try again later." };
  }

  // Numeric field overflow (e.g. lat/lng out of range)
  if (
    err.code === '22003' ||
    err.errno === 1264 ||
    err.code === "ER_WARN_DATA_OUT_OF_RANGE" ||
    (err.message && /numeric field overflow|out of range/i.test(err.message))
  ) {
    return { message: 'A numeric value is out of the allowed range. Check that latitude is between -90 and 90 and longitude is between -180 and 180.' };
  }

  // Validation errors
  if (err.details && /validation/i.test(err.details)) {
    switch (operation) {
      case "create":
        return { message: "Creation failed: invalid data provided. Please check your input and try again." };
      case "update":
        return { message: "Update failed: invalid data provided. Please check your input and try again." };
      default:
        return { message: "Invalid data provided. Please check your input and try again." };
    }
  }

  // Default fallback
  if (operation === "read") {
    switch (subtype) {
      case "getById":
        return { message: err.message || "Failed to retrieve the item by ID. Please try again later." };
      case "getAll":
        return { message: err.message || "Failed to retrieve the list of items. Please try again later." };
      case "getRelated":
        return { message: err.message || "Failed to retrieve related data for this item. Please try again later." };
      default:
        return { message: err.message || "An unexpected error occurred while fetching data. Please try again later." };
    }
  }
  switch (operation) {
    case "create":
      return { message: err.message || "Failed to create the item. Please try again later." };
    case "update":
      return { message: err.message || "Failed to update the item. Please try again later." };
    case "delete":
      return { message: err.message || "Failed to delete the item. Please try again later." };
    default:
      return { message: err.message || "An unexpected error occurred. Please try again later." };
  }
}