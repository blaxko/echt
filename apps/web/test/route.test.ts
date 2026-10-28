import { describe, expect, it } from "vitest";
import { canonicalHash, parseRoute } from "../src/route.ts";

describe("hash routes", () => {
  it("the bare root and an empty hash are the landing page", () => {
    expect(parseRoute("")).toEqual({ kind: "site", page: "home" });
    expect(parseRoute("#")).toEqual({ kind: "site", page: "home" });
    expect(parseRoute("#/")).toEqual({ kind: "site", page: "home" });
  });

  it("each section has its own page", () => {
    expect(parseRoute("#/how-it-works")).toEqual({ kind: "site", page: "how-it-works" });
    expect(parseRoute("#/proof")).toEqual({ kind: "site", page: "proof" });
    expect(parseRoute("#/why-it-matters")).toEqual({ kind: "site", page: "why-it-matters" });
    expect(parseRoute("#/built-with")).toEqual({ kind: "site", page: "built-with" });
    expect(parseRoute("#/limits")).toEqual({ kind: "site", page: "limits" });
    expect(parseRoute("#/faq")).toEqual({ kind: "site", page: "faq" });
  });

  it("#/app is the dashboard, and #/dashboard reads as the same route", () => {
    expect(parseRoute("#/app")).toEqual({ kind: "app" });
    expect(parseRoute("#/dashboard")).toEqual({ kind: "app" });
  });

  it("the Brief keeps its #/brief/T1 form", () => {
    expect(parseRoute("#/brief/T1")).toEqual({ kind: "brief", scenario: "T1" });
    expect(parseRoute("#/brief/T2/")).toEqual({ kind: "brief", scenario: "T2" });
  });

  it("an unknown or malformed hash falls back to the landing page", () => {
    expect(parseRoute("#/brief/xyz")).toEqual({ kind: "site", page: "home" });
    expect(parseRoute("#/nonsense")).toEqual({ kind: "site", page: "home" });
  });
});

describe("legacy dashboard links", () => {
  it("#/dashboard is rewritten to #/app", () => {
    expect(canonicalHash("#/dashboard")).toBe("#/app");
  });

  it("canonical routes are left alone", () => {
    expect(canonicalHash("#/app")).toBeNull();
    expect(canonicalHash("#/brief/T1")).toBeNull();
    expect(canonicalHash("#/faq")).toBeNull();
    expect(canonicalHash("")).toBeNull();
  });
});
