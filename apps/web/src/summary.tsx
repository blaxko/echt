import type { RunRecord } from "./api.ts";
import { finalState } from "./state.ts";

// The plain-English layer on top of the evidence: one sentence anyone can read, four numbers, and the four steps the
// check went through. Every value is read from the record on screen; nothing here is a separate claim.
function story(record: RunRecord, scenario: string): { answer: string; detail: string } {
  const total = record.voices.length;
  const linked = record.linkedPersonaIds.length;
  const state = finalState(record);
  const tamper = scenario === "T6" ? " This record was altered after it was made: press Replay (R) to catch it." : "";
  if (state === "BLOCK") {
    return {
      answer: "The agent did not trade.",
      detail: `${linked} of the ${total} accounts hyping this token were paid by the same wallet shortly before they posted, and none of them said so.${tamper}`,
    };
  }
  if (state === "REVIEW") {
    return {
      answer: "The agent held off and asked for a person to look.",
      detail: `Part of the payment data could not be checked, so Echt does not guess. Missing data never counts as safe.${tamper}`,
    };
  }
  if (state === "OPEN_PRACTICE_POSITION") {
    return { answer: "No paid campaign found. A practice trade was opened.", detail: `The ${total} accounts were not funded by a shared wallet.${tamper}` };
  }
  return {
    answer: "No paid campaign found.",
    detail: `The ${total} accounts were not funded by a shared wallet, so the payment check passes. No trade was opened only because live market prices were unavailable.${tamper}`,
  };
}

function medianGap(record: RunRecord): string {
  const gaps = record.voices.filter((v) => v.linked && v.gapHours !== null).map((v) => v.gapHours as number).sort((a, b) => a - b);
  if (gaps.length === 0) return "—";
  return `${gaps[Math.floor(gaps.length / 2)]!.toFixed(1)} h`;
}

export function Summary({ record, scenario }: { record: RunRecord; scenario: string }) {
  const s = story(record, scenario);
  const state = finalState(record);
  const linked = record.linkedPersonaIds.length;
  const traded = state === "OPEN_PRACTICE_POSITION";
  const checked = state !== "REVIEW";
  const steps = [
    { n: 1, t: "Accounts turn bullish", d: `${record.voices.length} watched accounts post about one token in the same few hours.` },
    { n: 2, t: "The agent wants to buy", d: `It proposes a practice trade of $${record.proposal.sizeUsd} on ${record.proposal.symbol}.` },
    { n: 3, t: "Echt checks who paid them", d: checked ? `It reads every account's wallet payments before they posted. ${linked} came from one wallet.` : "It tried to read the wallet payments, but the data source failed." },
    { n: 4, t: traded ? "Trade allowed" : "Trade stopped", d: traded ? "The practice trade opens." : "No position is opened. The decision is written on-chain." },
  ];
  return (
    <section aria-labelledby="zone-summary" className="summary">
      <h2 id="zone-summary" className="sr-only">What happened, in plain words</h2>
      <div className="summary-story">
        <p className="summary-answer">{s.answer}</p>
        <p className="summary-detail">{s.detail}</p>
      </div>
      <ul className="kpis" aria-label="Key numbers">
        <li><span>Accounts watched</span><strong>{record.voices.length}</strong></li>
        <li className={linked > 0 && checked ? "kpi-alert" : ""}><span>Paid by one wallet{checked ? "" : " · not confirmed"}</span><strong>{linked}</strong></li>
        <li><span>Payment to post</span><strong>{medianGap(record)}</strong></li>
        <li className={traded ? "kpi-ok" : "kpi-dark"}><span>Agent's decision</span><strong>{traded ? "Trade" : "No trade"}</strong></li>
      </ul>
      <ol className="steps" aria-label="How the check ran">
        {steps.map((st) => (
          <li key={st.n} className={st.n === 4 ? (traded ? "step-ok" : "step-stop") : ""}>
            <span className="step-n" aria-hidden="true">{st.n}</span>
            <div><p className="step-t">{st.t}</p><p className="step-d">{st.d}</p></div>
          </li>
        ))}
      </ol>
      <details className="glossary">
        <summary>What do BLOCK, REVIEW and ELIGIBLE mean?</summary>
        <dl>
          <div><dt>BLOCK</dt><dd>Three or more accounts were paid by the same wallet before posting, with no ad disclosure. The agent stays out.</dd></div>
          <div><dt>REVIEW</dt><dd>Some data was missing or failed. Echt never guesses, so a person should look.</dd></div>
          <div><dt>ELIGIBLE</dt><dd>No shared paying wallet was found. The hype passes the payment check.</dd></div>
          <div><dt>Testnet</dt><dd>Payments are real transactions on Ethereum Sepolia, a test network. No real money is used.</dd></div>
        </dl>
      </details>
    </section>
  );
}
