export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'showInMenu';

export interface ModulePermissions {
  [action: string]: { allowed: boolean };
}

export interface UserPermissions {
  [module: string]: ModulePermissions;
}

/**
 * Merges DEFAULT_PERMISSIONS[role] with caller-supplied overrides so that
 * every new user always receives at least the full current default permission
 * set for their role, regardless of which overrides are provided.
 *
 * Invariant: only modules and actions that already exist in
 * DEFAULT_PERMISSIONS[role] are ever written into the result.  Any module or
 * action in `overrides` that is not present in the role's defaults is silently
 * dropped.  This prevents callers from injecting arbitrary permission keys.
 *
 * - Modules/actions present in defaults but absent from overrides keep their default value.
 * - Modules/actions present in both overrides and defaults: override value wins.
 * - Modules/actions present only in overrides: silently dropped.
 * - Unknown role name: returns an empty object.
 */
export function mergeWithDefaults(
  role: string,
  overrides: UserPermissions = {}
): UserPermissions {
  const defaults: UserPermissions = DEFAULT_PERMISSIONS[role] ?? {};
  const result: UserPermissions = {};

  for (const [mod, actions] of Object.entries(defaults)) {
    result[mod] = { ...(actions as ModulePermissions) };
  }

  for (const [mod, actions] of Object.entries(overrides)) {
    if (!result[mod]) {
      continue;
    }
    for (const [action, value] of Object.entries(actions as ModulePermissions)) {
      if (!(action in result[mod])) {
        continue;
      }
      result[mod][action] = value;
    }
  }

  return result;
}

export const DEFAULT_PERMISSIONS: Record<string, UserPermissions> = {

  // ─────────────────────────────────────────────────────────────────────
  // ADMIN  – can CRUD SuperAdmins; reads everything else down the hierarchy
  // ─────────────────────────────────────────────────────────────────────
  Admin: {
    Users: {
      view: { allowed: true },
      create: { allowed: true }, // creates SuperAdmins
      edit: { allowed: true },
      delete: { allowed: true },
      approve: { allowed: true },
      showInMenu: { allowed: true },
    },
    Party: { view: { allowed: true }, showInMenu: { allowed: true } },
    Store: { view: { allowed: true }, showInMenu: { allowed: true } },
    Orders: { view: { allowed: true }, showInMenu: { allowed: true } },
    Products: { view: { allowed: true }, showInMenu: { allowed: true } },
    Menus: { view: { allowed: true }, showInMenu: { allowed: true } },
    Payments: { view: { allowed: true }, showInMenu: { allowed: true } },
    Analytics: { view: { allowed: true }, showInMenu: { allowed: true } },
    Reports: { view: { allowed: true }, showInMenu: { allowed: true } },
    Categories: { view: { allowed: true }, showInMenu: { allowed: true } },
    Subcategories: { view: { allowed: true }, showInMenu: { allowed: true } },
    Brands: { view: { allowed: true }, showInMenu: { allowed: true } },
    Templates: { view: { allowed: true }, showInMenu: { allowed: true } },
  },

  // ─────────────────────────────────────────────────────────────────────
  // SUPER ADMIN – can CRUD SubAdmins; reads everything else down the hierarchy
  // No access to Categories — category management belongs to SubAdmin only
  // ─────────────────────────────────────────────────────────────────────
  SuperAdmin: {
    Users: {
      view: { allowed: true },
      create: { allowed: true }, // creates SubAdmins
      edit: { allowed: true },
      delete: { allowed: true },
      approve: { allowed: true },
      showInMenu: { allowed: true },
    },
    Party: {
      view: { allowed: true },
      showInMenu: { allowed: true },
    },
    Payments: { view: { allowed: true }, showInMenu: { allowed: true } },
    Store: { view: { allowed: true }, showInMenu: { allowed: true } },
    Orders: { view: { allowed: true }, showInMenu: { allowed: true } },
    Products: { view: { allowed: true }, showInMenu: { allowed: true } },
    Menus: { view: { allowed: true }, showInMenu: { allowed: true } },
    Analytics: { view: { allowed: true }, showInMenu: { allowed: true } },
    Reports: { view: { allowed: true }, showInMenu: { allowed: true } },
    Templates: { view: { allowed: true }, showInMenu: { allowed: true } },
  },

  // ─────────────────────────────────────────────────────────────────────
  // SUB ADMIN – can CRUD Stores & StoreAdmins; can approve Products & Menus;
  //             sole owner of Categories CRUD
  // ─────────────────────────────────────────────────────────────────────
  SubAdmin: {
    Store: {
      view: { allowed: true },
      create: { allowed: true },
      edit: { allowed: true },
      delete: { allowed: true },
      showInMenu: { allowed: true },
    },
    Users: {
      view: { allowed: true },
      create: { allowed: true }, // creates StoreAdmins
      edit: { allowed: true },
      delete: { allowed: true },
      approve: { allowed: true },
      showInMenu: { allowed: true },
    },
    Products: {
      view: { allowed: true },
      approve: { allowed: true },
      showInMenu: { allowed: true },
    },
    Menus: {
      view: { allowed: true },
      approve: { allowed: true },
      showInMenu: { allowed: true },
    },
    Orders: { view: { allowed: true }, showInMenu: { allowed: true } },
    Analytics: { view: { allowed: true }, showInMenu: { allowed: true } },
    Reports: { view: { allowed: true }, showInMenu: { allowed: true } },
    Payments: { view: { allowed: true }, showInMenu: { allowed: true } },
    Party: {
      view: { allowed: true },
      edit: { allowed: true },
      approve: { allowed: true },
      showInMenu: { allowed: true },
    },
    Categories: {
      view: { allowed: true },
      create: { allowed: true },
      edit: { allowed: true },
      delete: { allowed: true },
      showInMenu: { allowed: true },
    },
    Subcategories: {
      view: { allowed: true },
      create: { allowed: true },
      edit: { allowed: true },
      delete: { allowed: true },
      showInMenu: { allowed: true },
    },
    Brands: {
      view: { allowed: true },
      create: { allowed: true },
      edit: { allowed: true },
      delete: { allowed: true },
      showInMenu: { allowed: true },
    },
    Templates: {
      view: { allowed: true },
      create: { allowed: true },
      edit: { allowed: true },
      delete: { allowed: true },
      showInMenu: { allowed: true },
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // STORE ADMIN – can CRUD Employees, Products & Menus; reads Orders & Payments
  //               can view Categories but cannot manage them
  // ─────────────────────────────────────────────────────────────────────
  StoreAdmin: {
    Users: {
      view: { allowed: true },
      create: { allowed: true }, // creates Employees
      edit: { allowed: true },
      delete: { allowed: true },
      approve: { allowed: true },
      showInMenu: { allowed: true },
    },
    Products: {
      view: { allowed: true },
      create: { allowed: true },
      edit: { allowed: true },
      delete: { allowed: true },
      showInMenu: { allowed: true },
    },
    Menus: {
      view: { allowed: true },
      create: { allowed: true },
      edit: { allowed: true },
      delete: { allowed: true },
      showInMenu: { allowed: true },
    },
    Store: { view: { allowed: true }, showInMenu: { allowed: true } },
    Orders: { view: { allowed: true }, showInMenu: { allowed: true } },
    Payments: { view: { allowed: true }, showInMenu: { allowed: true } },
    Analytics: { view: { allowed: true }, showInMenu: { allowed: true } },
    Reports: { view: { allowed: true }, showInMenu: { allowed: true } },
    Categories: { view: { allowed: true }, showInMenu: { allowed: true } },
    Subcategories: { view: { allowed: true }, showInMenu: { allowed: true } },
    Brands: {
      view: { allowed: true },
      create: { allowed: true },
      edit: { allowed: true },
      showInMenu: { allowed: true },
    },
    Party: {
      view: { allowed: true },
      create: { allowed: true },
      edit: { allowed: true },
      delete: { allowed: true },
      showInMenu: { allowed: true },
    },
    Templates: { view: { allowed: true }, showInMenu: { allowed: true } },
  },

  // ─────────────────────────────────────────────────────────────────────
  // EMPLOYEE – view-only by default on Products & Menus; reads Orders.
  //            StoreAdmin grants write access per employee via the PermissionsModal.
  //            can view Categories; no access to Analytics or Reports
  // ─────────────────────────────────────────────────────────────────────
  Employee: {
    Products: {
      view: { allowed: true },
      create: { allowed: false },
      edit: { allowed: false },
      delete: { allowed: false },
      showInMenu: { allowed: true },
    },
    Menus: {
      view: { allowed: true },
      create: { allowed: false },
      edit: { allowed: false },
      delete: { allowed: false },
      showInMenu: { allowed: true },
    },
    Party: {
      view: { allowed: true },
      create: { allowed: false },
      edit: { allowed: false },
      delete: { allowed: false },
      showInMenu: { allowed: true },
    },
    Orders: { view: { allowed: true }, showInMenu: { allowed: true } },
    Store: { view: { allowed: true }, showInMenu: { allowed: false } },
    Categories: { view: { allowed: true }, showInMenu: { allowed: true } },
    Subcategories: { view: { allowed: true }, showInMenu: { allowed: true } },
    Brands: { view: { allowed: true }, showInMenu: { allowed: true } },
    Templates: { view: { allowed: true }, showInMenu: { allowed: true } },
  },

  // ─────────────────────────────────────────────────────────────────────
  // CUSTOMER – can browse menus/products, place & view own orders
  // ─────────────────────────────────────────────────────────────────────
  Customer: {
    Menus: { view: { allowed: true } },
    Products: { view: { allowed: true } },
    Users: {
      view: { allowed: true }, // View own profile
      edit: { allowed: true }  // Edit own profile
    },
    Orders: {
      view: { allowed: true },
      create: { allowed: true },
      edit: { allowed: true }, // Allow cancelling/modifying unconfirmed orders
      showInMenu: { allowed: true },
    },
    Payments: {
      create: { allowed: true },
    },
    Party: {
      view: { allowed: true },
    },
  },
};
