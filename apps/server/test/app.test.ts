import { describe, expect, it } from "vitest";
import { app } from "../src/app.ts";

describe("apps/server", () => {
  it("answers /api/health with the policy version", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", policyVersion: "echt-policy@2" });
  });
});
