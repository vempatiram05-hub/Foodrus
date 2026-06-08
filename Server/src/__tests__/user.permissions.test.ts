import { DEFAULT_PERMISSIONS, mergeWithDefaults } from "../constants/permissions";

const roles = Object.keys(DEFAULT_PERMISSIONS);

describe("mergeWithDefaults", () => {
  describe("no overrides provided", () => {
    it.each(roles)(
      "returns the full DEFAULT_PERMISSIONS for role %s",
      (role) => {
        const result = mergeWithDefaults(role);
        expect(result).toEqual(DEFAULT_PERMISSIONS[role]);
      }
    );
  });

  describe("creating a user for each role produces a superset of DEFAULT_PERMISSIONS[role]", () => {
    it.each(roles)(
      "role %s: result contains every module and action from defaults",
      (role) => {
        const overrides = { SomeExtraModule: { view: { allowed: true } } };
        const result = mergeWithDefaults(role, overrides);
        const defaults = DEFAULT_PERMISSIONS[role];

        for (const [module, actions] of Object.entries(defaults)) {
          expect(result).toHaveProperty(module);
          for (const [action, value] of Object.entries(actions)) {
            expect(result[module]).toHaveProperty(action);
            expect(result[module][action]).toEqual(value);
          }
        }
      }
    );

    it.each(roles)(
      "role %s: unknown override modules are silently dropped",
      (role) => {
        const overrides = { ExtraModule: { create: { allowed: true } } };
        const result = mergeWithDefaults(role, overrides);
        expect(result).not.toHaveProperty("ExtraModule");
      }
    );

    it.each(roles)(
      "role %s: empty overrides yield the full defaults",
      (role) => {
        const result = mergeWithDefaults(role, {});
        expect(result).toEqual(DEFAULT_PERMISSIONS[role]);
      }
    );
  });

  describe("override values take precedence over defaults", () => {
    it("allows an override to restrict a normally-allowed action", () => {
      const role = "Admin";
      const result = mergeWithDefaults(role, {
        Users: { view: { allowed: false } },
      });
      expect(result["Users"]["view"]).toEqual({ allowed: false });
      expect(result["Users"]["create"]).toEqual({ allowed: true });
    });

    it("allows an override to flip a known action within an existing module", () => {
      const role = "Admin";
      const result = mergeWithDefaults(role, {
        Store: { view: { allowed: false } },
      });
      expect(result["Store"]["view"]).toEqual({ allowed: false });
    });
  });

  describe("unknown role", () => {
    it("returns an empty object when role has no defaults and overrides are supplied", () => {
      const result = mergeWithDefaults("UnknownRole", {
        Products: { view: { allowed: true } },
      });
      expect(result).toEqual({});
    });

    it("returns an empty object when role has no defaults and no overrides", () => {
      const result = mergeWithDefaults("UnknownRole");
      expect(result).toEqual({});
    });
  });
});
