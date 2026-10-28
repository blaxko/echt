import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "../src/sha256.ts";

const nodeSha256 = (data: Uint8Array): string => createHash("sha256").update(data).digest("hex");

describe("sha256Hex (pure TypeScript, no dependencies)", () => {
  it("matches the FIPS 180-4 test vectors", () => {
    expect(sha256Hex(new Uint8Array())).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(sha256Hex(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(
      sha256Hex(
        new TextEncoder().encode("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
      ),
    ).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  });

  it("agrees with node:crypto across padding boundaries (0..300 bytes)", () => {
    for (let len = 0; len <= 300; len++) {
      const data = randomBytes(len);
      expect(sha256Hex(data), `length ${len}`).toBe(nodeSha256(data));
    }
  });

  it("agrees with node:crypto on a 1 MB input", () => {
    const data = randomBytes(1_000_000);
    expect(sha256Hex(data)).toBe(nodeSha256(data));
  });
});
