import canonicalizeReference from "canonicalize";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../src/canonical.ts";
import { hashCanonical } from "../src/hash.ts";

describe("canonicalJson (RFC 8785 JCS)", () => {
  it("sorts object keys by UTF-16 code units, recursively", () => {
    expect(canonicalJson({ b: 1, a: { d: true, c: null } })).toBe('{"a":{"c":null,"d":true},"b":1}');
  });

  it("orders keys by UTF-16 code unit, not by locale", () => {
    // "ﬁ" (ﬁ) sorts after "z" by code unit, and "Z" sorts before "a".
    expect(canonicalJson({ "ﬁ": 1, z: 2, Z: 3, a: 4 })).toBe(
      '{"Z":3,"a":4,"z":2,"ﬁ":1}',
    );
  });

  it("serializes numbers with ECMAScript Number::toString", () => {
    expect(canonicalJson([1.0, 0.1, 1e21, 1e-7, -0, 123456789])).toBe(
      "[1,0.1,1e+21,1e-7,0,123456789]",
    );
  });

  it("escapes strings as JSON.stringify does (short escapes, lowercase \\u for controls)", () => {
    expect(canonicalJson("a\"b\\c\n\u0001\u001f")).toBe('"a\\"b\\\\c\\n\\u0001\\u001f"');
  });

  it("keeps array order and omits undefined object members", () => {
    expect(canonicalJson({ z: [3, 1, 2], skipped: undefined, a: "x" })).toBe(
      '{"a":"x","z":[3,1,2]}',
    );
  });

  it("rejects values JSON cannot represent exactly", () => {
    expect(() => canonicalJson(Number.NaN)).toThrow();
    expect(() => canonicalJson(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => canonicalJson(10n as never)).toThrow();
    expect(() => canonicalJson([undefined] as never)).toThrow();
  });

  it("matches the reference canonicalize package on a fixture set", () => {
    const fixtures: unknown[] = [
      {},
      [],
      { runId: "run-1", transfers: [{ amountWei: "1000000000000000", blockNumber: 18402112 }] },
      { unicode: "héllo ✓ 𝄞", escapes: "\t\r\n\b\f\u0000" },
      { nested: { deep: { deeper: [1.5, -2.25, 0.000001, 12e30] } } },
      { emptyString: "", nullValue: null, flag: false },
    ];
    for (const value of fixtures) {
      expect(canonicalJson(value as never)).toBe(canonicalizeReference(value));
    }
  });
});

describe("hashCanonical", () => {
  it("is independent of key order", () => {
    expect(hashCanonical({ a: 1, b: { c: 2, d: 3 } })).toBe(
      hashCanonical({ b: { d: 3, c: 2 }, a: 1 }),
    );
  });

  it("returns a 0x-prefixed 32-byte hex string", () => {
    expect(hashCanonical({ a: 1 })).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("changes for a one-character change in a value", () => {
    const base = { transfers: [{ amountWei: "2000000000000000" }] };
    const changed = { transfers: [{ amountWei: "2000000000000001" }] };
    expect(hashCanonical(changed)).not.toBe(hashCanonical(base));
  });
});
