import { DEFAULT_PERMISSIONS, mergeWithDefaults } from "../constants/permissions";

describe("mergeWithDefaults – targeted unit tests", () => {
  describe("returns full defaults when no overrides are passed", () => {
    it("Customer: result equals DEFAULT_PERMISSIONS.Customer", () => {
      expect(mergeWithDefaults("Customer")).toEqual(DEFAULT_PERMISSIONS["Customer"]);
    });

    it("Employee: result equals DEFAULT_PERMISSIONS.Employee", () => {
      expect(mergeWithDefaults("Employee")).toEqual(DEFAULT_PERMISSIONS["Employee"]);
    });

    it("StoreAdmin: result equals DEFAULT_PERMISSIONS.StoreAdmin", () => {
      expect(mergeWithDefaults("StoreAdmin")).toEqual(DEFAULT_PERMISSIONS["StoreAdmin"]);
    });
  });

  describe("allows a caller to override a known action", () => {
    it("flips Products.create for an Employee from false to true", () => {
      const result = mergeWithDefaults("Employee", {
        Products: { create: { allowed: true } },
      });
      expect(result["Products"]["create"]).toEqual({ allowed: true });
      expect(result["Products"]["view"]).toEqual({ allowed: true });
      expect(result["Products"]["edit"]).toEqual({ allowed: false });
    });

    it("restricts a normally-allowed action for Admin", () => {
      const result = mergeWithDefaults("Admin", {
        Users: { view: { allowed: false } },
      });
      expect(result["Users"]["view"]).toEqual({ allowed: false });
      expect(result["Users"]["create"]).toEqual({ allowed: true });
    });
  });

  describe("silently drops unknown modules", () => {
    it("Customer with injected Analytics module does not gain Analytics", () => {
      const result = mergeWithDefaults("Customer", {
        Analytics: { view: { allowed: true } },
      });
      expect(result).not.toHaveProperty("Analytics");
    });

    it("Employee with injected Reports module does not gain Reports", () => {
      const result = mergeWithDefaults("Employee", {
        Reports: { view: { allowed: true }, create: { allowed: true } },
      });
      expect(result).not.toHaveProperty("Reports");
    });

    it("all known default modules are still present after unknown module override", () => {
      const result = mergeWithDefaults("StoreAdmin", {
        FakeModule: { view: { allowed: true } },
      });
      expect(result).not.toHaveProperty("FakeModule");
      for (const mod of Object.keys(DEFAULT_PERMISSIONS["StoreAdmin"])) {
        expect(result).toHaveProperty(mod);
      }
    });
  });

  describe("silently drops unknown actions within a known module", () => {
    it("Employee Products with an injected unknown action 'approve'", () => {
      const result = mergeWithDefaults("Employee", {
        Products: { approve: { allowed: true } },
      });
      expect(result["Products"]).not.toHaveProperty("approve");
      expect(result["Products"]["view"]).toEqual({ allowed: true });
    });

    it("Customer Users with an injected unknown action 'delete'", () => {
      const result = mergeWithDefaults("Customer", {
        Users: { delete: { allowed: true } },
      });
      expect(result["Users"]).not.toHaveProperty("delete");
      expect(result["Users"]["view"]).toEqual({ allowed: true });
    });
  });

  describe("returns an empty object for an unknown role name", () => {
    it("unknown role with no overrides → empty object", () => {
      expect(mergeWithDefaults("GhostRole")).toEqual({});
    });

    it("unknown role with overrides → empty object (overrides dropped)", () => {
      expect(
        mergeWithDefaults("GhostRole", { Products: { view: { allowed: true } } })
      ).toEqual({});
    });
  });
});
