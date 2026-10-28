import { describe, expect, it } from "bun:test";
import { parsePingRequest, summarizeTxlist } from "./ping.ts";

const ADDRESS = "0xaA9FE8c47cBFD12E1D6109b7c825c5b478A7B25c";

describe("parsePingRequest", () => {
  it("accepts a valid request and lowercases the address", () => {
    expect(parsePingRequest({ runId: "r1", address: ADDRESS, startBlock: 0, endBlock: 10 })).toEqual({
      runId: "r1",
      address: ADDRESS.toLowerCase(),
      startBlock: 0,
      endBlock: 10,
    });
  });

  it("rejects a malformed address", () => {
    expect(() => parsePingRequest({ runId: "r1", address: "0x1234", startBlock: 0, endBlock: 1 })).toThrow("address");
  });

  it("rejects an endBlock before startBlock", () => {
    expect(() => parsePingRequest({ runId: "r1", address: ADDRESS, startBlock: 5, endBlock: 4 })).toThrow("startBlock");
  });

  it("rejects a non-integer block", () => {
    expect(() => parsePingRequest({ runId: "r1", address: ADDRESS, startBlock: 0.5, endBlock: 1 })).toThrow("integers");
  });

  it("rejects a non-object payload", () => {
    expect(() => parsePingRequest("nope")).toThrow("JSON object");
  });
});

describe("summarizeTxlist", () => {
  it("summarises rows to hashes sorted, with a count", () => {
    const summary = summarizeTxlist({
      status: "1",
      message: "OK",
      result: [{ hash: "0xb" }, { hash: "0xa" }],
    });
    expect(summary).toEqual({ status: "1", message: "OK", count: 2, hashes: ["0xa", "0xb"] });
  });

  it("treats 'No transactions found' as a valid empty answer", () => {
    expect(summarizeTxlist({ status: "0", message: "No transactions found", result: [] })).toEqual({
      status: "0",
      message: "No transactions found",
      count: 0,
      hashes: [],
    });
  });

  it("throws on NOTOK so a failed call is never read as an empty history", () => {
    expect(() => summarizeTxlist({ status: "0", message: "NOTOK", result: "Invalid API Key" })).toThrow("NOTOK");
  });
});
