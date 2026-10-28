import { describe, expect, it } from "vitest";
import { POLICY_VERSION } from "../src/index.ts";

describe("packages/policy", () => {
  it("exports the policy version", () => {
    expect(POLICY_VERSION).toBe("echt-policy@2");
  });
});
