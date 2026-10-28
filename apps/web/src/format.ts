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
export function reasonText(verdict: string, reasons: string[], linked: number, total: number): string {
  if (reasons.includes("PROVIDER_FAILED") || reasons.includes("PROVIDER_INCONSISTENT")) {
    return "A provider lookup failed, so this run cannot clear the check. Missing data is never read as clean.";
  }
  if (verdict === "BLOCK") {
    return `Policy threshold met: ${linked} of ${total} voices received linked transfers before posting, with no disclosure detected. This is not a finding that any law was broken.`;
  }
  if (reasons.includes("DISCLOSED_CAMPAIGN")) return "Linked voices all disclosed. Shown as disclosed connections, not counted toward BLOCK.";
  return "No qualifying transfer pattern observed in this window. This is not a finding that the activity is organic or safe.";
}
