import { canonicalJson, type JsonValue } from "./canonical.ts";
import { sha256Hex } from "./sha256.ts";

const utf8 = new TextEncoder();

/** `0x` + sha256 of the RFC 8785 canonical UTF-8 bytes. Used for evidence and section hashes. */
export function hashCanonical(value: JsonValue): `0x${string}` {
  return `0x${sha256Hex(utf8.encode(canonicalJson(value)))}`;
}
