export const short = (hex: string, head = 10, tail = 6) => (hex.length > head + tail + 1 ? `${hex.slice(0, head)}…${hex.slice(-tail)}` : hex);

export const txLink = (hash: string) => `https://sepolia.etherscan.io/tx/${hash}`;

export const ethFrom = (wei: string) => {
  const n = BigInt(wei);
  const whole = n / 10n ** 18n;
  const frac = (n % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
};

export const hours = (h: number | null) => (h === null ? "no payment" : `${h.toFixed(1)} h before post`);

/** Plain-language reason for the banner. Wording follows CLAUDE.md §9: no "fraud", "illegal" or "paid shill". */
export function reasonText(verdict: string, reasons: string[], linked: number, total: number, marketStatus = "UNAVAILABLE"): string {
  if (reasons.includes("PROVIDER_FAILED") || reasons.includes("PROVIDER_INCONSISTENT")) {
    return "A provider lookup failed, so this run cannot clear the check. Missing data is never read as clean.";
  }
  if (verdict === "BLOCK") {
    return `Policy threshold met: ${linked} of ${total} voices received linked transfers before posting, with no disclosure detected. This is not a finding that any law was broken.`;
  }
  if (verdict === "ELIGIBLE" && marketStatus !== "ok") {
    return "ELIGIBLE: no qualifying payment pattern. No position, because live market data (RYO) is unavailable.";
  }
  if (reasons.includes("DISCLOSED_CAMPAIGN")) return "Linked voices all disclosed. Shown as disclosed connections, not counted toward BLOCK.";
  return "No qualifying transfer pattern observed in this window. This is not a finding that the activity is organic or safe.";
}

/** A wallet address as shown in tables: 0x, four characters, an ellipsis and four characters. The full value stays in `full`. */
export const addressView = (addr: string) => ({ short: `${addr.slice(0, 6)}…${addr.slice(-4)}`, full: addr });

export const etherscanAddress = (addr: string) => `https://sepolia.etherscan.io/address/${addr}`;

/** True only when every transfer has the same sender (case-insensitive). No transfers is not "one sender": keep the column. */
export const sameSender = (transfers: readonly { from: string }[]): boolean => {
  if (transfers.length === 0) return false;
  const first = transfers[0]!.from.toLowerCase();
  return transfers.every((t) => t.from.toLowerCase() === first);
};
