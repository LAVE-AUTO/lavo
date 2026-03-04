/**
 * Unit tests for seed script module. Does not connect to DB.
 * Verifies module loads and exports seed function; does not invoke seed() so no DATABASE_URL required.
 * @jest-environment node
 */
import * as seedModule from "../../../scripts/seed";

describe("seed script module", () => {
  it("exports seed function", () => {
    expect(seedModule.seed).toBeDefined();
    expect(typeof seedModule.seed).toBe("function");
  });

  it("seed has arity 0 (no required args)", () => {
    expect(seedModule.seed.length).toBe(0);
  });
});
