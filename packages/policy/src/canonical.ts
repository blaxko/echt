// RFC 8785 (JSON Canonicalization Scheme), restricted to what Echt snapshots contain.
// Strings and numbers use ECMAScript's own serialization, which RFC 8785 adopts;
// object keys are sorted by UTF-16 code unit, which is the default JavaScript sort.

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue | undefined };

export function canonicalJson(value: JsonValue | undefined): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "string":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) {
        throw new TypeError(`canonicalJson: ${value} is not representable in JSON`);
      }
      return JSON.stringify(value);
    case "object": {
      if (Array.isArray(value)) {
        return "[" + value.map((item) => canonicalElement(item)).join(",") + "]";
      }
      const members = Object.keys(value)
        .sort()
        .flatMap((key) => {
          const member = value[key];
          return member === undefined ? [] : [JSON.stringify(key) + ":" + canonicalJson(member)];
        });
      return "{" + members.join(",") + "}";
    }
    default:
      throw new TypeError(`canonicalJson: unsupported value of type ${typeof value}`);
  }
}

function canonicalElement(item: JsonValue | undefined): string {
  if (item === undefined) {
    throw new TypeError("canonicalJson: undefined is not allowed inside an array");
  }
  return canonicalJson(item);
}
