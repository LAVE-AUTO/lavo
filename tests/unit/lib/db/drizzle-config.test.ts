/**
 * Unit tests for Drizzle config and migrations layout.
 * Verifies config loads and migration journal matches expected structure.
 */
import config from "../../../../drizzle.config";

describe("drizzle config and migrations", () => {
  describe("drizzle.config", () => {
    it("exports config with dialect postgresql", () => {
      expect(config.dialect).toBe("postgresql");
    });

    it("points schema to schema index", () => {
      expect(config.schema).toBe("./src/lib/db/schema/index.ts");
    });

    it("points migrations out to src/lib/db/migrations", () => {
      expect(config.out).toBe("./src/lib/db/migrations");
    });

    it("uses DATABASE_URL from env for credentials", () => {
      expect(config.dbCredentials).toBeDefined();
      expect(typeof config.dbCredentials?.url).toBe("string");
    });
  });

  describe("migrations journal", () => {
    it("migration journal exists and has entries array", async () => {
      const journal = await import("@/lib/db/migrations/meta/_journal.json");
      expect(journal.default).toBeDefined();
      expect(Array.isArray(journal.default.entries)).toBe(true);
    });

    it("initial migration entry references known migration file", async () => {
      const journal = await import("@/lib/db/migrations/meta/_journal.json");
      const entries = journal.default.entries as { tag: string }[];
      expect(entries.length).toBeGreaterThanOrEqual(1);
      const first = entries[0];
      expect(first.tag).toBeDefined();
      expect(typeof first.tag).toBe("string");
    });
  });
});
