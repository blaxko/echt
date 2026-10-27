import { Hono } from "hono";
import { POLICY_VERSION } from "@echt/policy";

export const app = new Hono();

app.get("/api/health", (c) => c.json({ status: "ok", policyVersion: POLICY_VERSION }));
