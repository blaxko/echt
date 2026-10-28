import { useEffect, useRef } from "react";
import { startRun, type RunRecord, type Transfer, type Voice } from "./api.ts";
import { ethFrom, hours, reasonText, short, txLink } from "./format.ts";
import type { ReplayResult } from "./replay.ts";

export const SCENARIOS = [
  { id: "T1", name: "T1 · Coordinated" },
  { id: "T2", name: "T2 · Unrelated" },
  { id: "T5", name: "T5 · Provider fault" },
  { id: "T6", name: "T6 · Tampered snapshot (replay)" },
] as const;

export type RunPhase = { kind: "idle" } | { kind: "running"; id: string } | { kind: "refused"; message: string } | { kind: "finished" };

/** One place that decides which headline state the screen shows (PRD §7 states). */
export function headline(record: RunRecord | null, phase: RunPhase): { tone: string; icon: string; title: string } {
  if (phase.kind === "running") return { tone: "run", icon: "◌", title: "RUNNING · checking the chain" };
  if (!record) return { tone: "idle", icon: "○", title: "IDLE · no run recorded for this scenario" };
  if (record.verdict === "BLOCK") return { tone: "block", icon: "■", title: "NO POSITION · BLOCK" };
  if (record.verdict === "REVIEW") return { tone: "review", icon: "▲", title: "NO POSITION · REVIEW" };
  if (record.marketGate === "PASS") return { tone: "open", icon: "●", title: "OPEN PRACTICE POSITION · ELIGIBLE" };
  return { tone: "eligible", icon: "◇", title: "NO POSITION · ELIGIBLE, market unavailable" };
}

export function Banner({ record, phase }: { record: RunRecord | null; phase: RunPhase }) {
  const h = headline(record, phase);
  const total = record?.voices.length ?? 0;
  const linked = record?.linkedPersonaIds.length ?? 0;
  return (
    <section aria-labelledby="zone-banner" className={`banner tone-${h.tone}`}>
      <h2 id="zone-banner" className="sr-only">Decision</h2>
      <p className="banner-title"><span aria-hidden="true">{h.icon}</span> <span>{h.title}</span></p>
      {record && phase.kind !== "running" && <p className="banner-reason">{reasonText(record.verdict, record.reasons, linked, total)}</p>}
      {phase.kind === "refused" && <p className="banner-reason" role="status">Run refused: {phase.message}</p>}
      {record && (
        <ul className="chips" aria-label="Status chips">
          <li className="chip">Payment: {record.verdict}</li>
          <li className="chip">Reason: {record.reasons.join(", ")}</li>
          <li className="chip">Market: {record.marketGate}</li>
          <li className="chip">{record.dryRun ? "SIMULATED · dry run, nothing written on-chain" : `Verdict tx: ${record.verdictTx}`}</li>
        </ul>
      )}
    </section>
  );
}

export function PaymentGraph({ record }: { record: RunRecord | null }) {
  if (!record) return <section aria-labelledby="zone-graph" className="zone"><h2 id="zone-graph">Payment graph</h2><p>No run recorded yet.</p></section>;
  const paid = record.voices.filter((v) => v.paymentTx);
  const source = (record.inputs as { transfers: Transfer[] }).transfers[0]?.from ?? "";
  const width = 640;
  const rowH = 44;
  const height = Math.max(rowH * record.voices.length + 40, 160);
  return (
    <section aria-labelledby="zone-graph" className="zone">
      <h2 id="zone-graph">Payment graph <span className="muted">· {paid.length} payment{paid.length === 1 ? "" : "s"} from one source</span></h2>
      <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`Campaign source paid ${paid.length} voice wallets before posting. Each edge opens its transaction on Sepolia Etherscan.`} className="graph">
        <rect x="8" y={height / 2 - 26} width="170" height="52" rx="8" className="node source" />
        <text x="93" y={height / 2 - 4} textAnchor="middle" className="node-label">Campaign source</text>
        <text x="93" y={height / 2 + 14} textAnchor="middle" className="node-sub">{short(source, 8, 4)}</text>
        {record.voices.map((v, i) => {
          const y = 20 + i * rowH;
          const cy = y + 17;
          return (
            <g key={v.personaId}>
              {v.paymentTx && (
                <a href={txLink(v.paymentTx)} target="_blank" rel="noreferrer" tabIndex={0} aria-label={`${v.handle}: ${hours(v.gapHours)}, transaction ${v.paymentTx}`}>
                  <line x1="178" y1={height / 2} x2="430" y2={cy} className={`edge ${v.linked ? "linked" : "unlinked"}`} />
                </a>
              )}
              <rect x="430" y={y} width="200" height="34" rx="6" className={`node voice ${v.linked ? "linked" : ""}`} />
              <text x="440" y={cy + 5} className="node-label">{v.handle.replace("@echt_", "")}</text>
              <text x="622" y={cy + 5} textAnchor="end" className="node-sub">{v.linked ? "linked" : "not linked"}</text>
            </g>
          );
        })}
      </svg>
      <details className="table-alt">
        <summary>Table view of every voice, its payment and measured gap</summary>
        <table>
          <caption className="sr-only">Voices, payments from the campaign source, and measured gap to post</caption>
          <thead><tr><th scope="col">Voice</th><th scope="col">Paid</th><th scope="col">Gap, from block timestamps</th><th scope="col">Transaction</th><th scope="col">Linked</th></tr></thead>
          <tbody>
            {record.voices.map((v) => (
              <tr key={v.personaId}>
                <th scope="row">{v.handle}</th>
                <td>{v.paymentTx ? "0.002 ETH" : "no"}</td>
                <td>{hours(v.gapHours)}</td>
                <td>{v.paymentTx ? <a href={txLink(v.paymentTx)} target="_blank" rel="noreferrer">{short(v.paymentTx)}</a> : "—"}</td>
                <td>{v.linked ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

export function Proposal({ record }: { record: RunRecord | null }) {
  if (!record) return <section aria-labelledby="zone-proposal" className="zone"><h2 id="zone-proposal">Proposal</h2><p>No proposal yet.</p></section>;
  const p = record.proposal;
  return (
    <section aria-labelledby="zone-proposal" className="zone proposal">
      <h2 id="zone-proposal">Before the check · proposal</h2>
      <p><s>Practice long · {p.symbol} · ${p.sizeUsd} · stop −{Math.round(p.stopPct * 100)}%</s></p>
      <p className="muted">{p.rationale}</p>
      <p><strong>Final action: </strong>{record.finalAction === "OPEN_PRACTICE_POSITION" ? "OPEN PRACTICE POSITION" : "NO POSITION"}</p>
    </section>
  );
}

export function Market({ record }: { record: RunRecord | null }) {
  return (
    <section aria-labelledby="zone-market" className="zone">
      <h2 id="zone-market">Market evidence · RYO</h2>
      {!record && <p>No market evidence recorded.</p>}
      {record && (
        <>
          <p><span aria-hidden="true">✕</span> <strong>{record.market.status}</strong> · {record.market.tool} for {record.market.symbol}</p>
          <p>RYO says: “{record.market.message}” ({record.market.code}).</p>
          <p className="muted">Trace id <code>{record.market.traceId}</code>. Source: <code>{record.market.source}</code></p>
          <p className="muted">Unavailable sections are listed, not filled in. The payment verdict does not depend on market data.</p>
        </>
      )}
    </section>
  );
}

export function Proof({ record, onBrief, onReplay, onExport }: { record: RunRecord | null; onBrief: () => void; onReplay: () => void; onExport: () => void }) {
  return (
    <section aria-labelledby="zone-proof" className="zone proof">
      <h2 id="zone-proof">Proof</h2>
      {record ? (
        <dl className="proof-list">
          <div><dt>Evidence hash</dt><dd><code title={record.evidenceHash}>{short(record.evidenceHash, 12, 8)}</code></dd></div>
          <div><dt>Policy</dt><dd>{record.policyVersion}</dd></div>
          <div><dt>Pinned block</dt><dd>{record.pinnedToBlock}{record.pinNote ? ` · ${record.pinNote}` : ""}</dd></div>
          <div><dt>Verdict transaction</dt><dd>{record.verdictTx ? <a href={txLink(record.verdictTx)} target="_blank" rel="noreferrer">{short(record.verdictTx)}</a> : "none: dry run"}</dd></div>
          <div><dt>Run</dt><dd>{record.cre}</dd></div>
        </dl>
      ) : <p>Nothing to prove yet.</p>}
      <div className="actions">
        <button type="button" onClick={onBrief} disabled={!record}>Evidence Brief (E)</button>
        <button type="button" onClick={onExport} disabled={!record}>JSON</button>
        <button type="button" onClick={onReplay} disabled={!record}>Replay (R)</button>
      </div>
    </section>
  );
}

export function ReplayDialog({ result, onClose, scenario }: { result: ReplayResult; onClose: () => void; scenario: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  const text = result.result === "MATCH"
    ? "MATCH · hash and verdict match the stored record"
    : result.result === "HASH_MISMATCH"
      ? `HASH_MISMATCH · section changed: ${result.section}`
      : "VERDICT_MISMATCH · hash matches but the verdict differs";
  return (
    <dialog ref={ref} className="replay" aria-labelledby="replay-title" onClose={onClose}>
      <h2 id="replay-title">Replay {scenario}</h2>
      <p>Recomputed offline from the stored inputs. No model, RYO or provider calls.</p>
      <p role="status" className="replay-result"><strong>{text}</strong></p>
      <form method="dialog"><button type="submit">Close</button></form>
    </dialog>
  );
}

export function RunDrawer({ open, setOpen, scenario, phase, setPhase, log, onRun }: {
  open: boolean; setOpen: (v: boolean) => void; scenario: string; phase: RunPhase; setPhase: (p: RunPhase) => void;
  log: string[]; onRun: (id: string) => void;
}) {
  const start = async () => {
    const r = await startRun(scenario);
    if ("error" in r) { setPhase({ kind: "refused", message: r.error }); return; }
    setPhase({ kind: "running", id: r.id });
    onRun(r.id);
  };
  return (
    <aside className={`drawer ${open ? "open" : ""}`} aria-labelledby="drawer-title">
      <button type="button" className="drawer-toggle" aria-expanded={open} aria-controls="run-log" onClick={() => setOpen(!open)}>
        {open ? "Hide run log" : "Show run log"}
      </button>
      <div id="run-log" hidden={!open}>
        <h2 id="drawer-title">Run log</h2>
        <button type="button" onClick={start} disabled={phase.kind === "running"}>Run check for {scenario}</button>
        <ol className="log" aria-live="polite">
          {log.length === 0 && <li>No run in this session.</li>}
          {log.map((l, i) => <li key={i}>{l}</li>)}
        </ol>
      </div>
    </aside>
  );
}

export function Brief({ record, scenario }: { record: RunRecord; scenario: string }) {
  const transfers = (record.inputs as { transfers: Transfer[] }).transfers;
  const byHash = new Map(transfers.map((t) => [t.txHash, t]));
  const qualifying = (record.evidence.transfers ?? []).map((q) => ({ ...q, t: byHash.get(q.txHash) }));
  return (
    <article className="brief">
      <h1>Evidence Brief · {scenario}</h1>
      <p><strong>{record.label}</strong></p>
      <p><strong>Final action:</strong> {record.finalAction === "NO_POSITION" ? "NO POSITION" : record.finalAction} · {record.verdict} · {record.reasons.join(", ")}</p>
      <p><strong>Policy:</strong> {record.policyVersion} · <strong>Evidence hash:</strong> <code>{record.evidenceHash}</code></p>
      <p><strong>Verdict transaction:</strong> {record.verdictTx ?? "none: dry run, nothing written on-chain"}</p>
      <h2>Converging posts</h2>
      <table>
        <thead><tr><th>Persona</th><th>Posted (UTC)</th><th>Provenance</th><th>Disclosure</th><th>Gap from payment</th></tr></thead>
        <tbody>{record.voices.map((v) => (
          <tr key={v.personaId}><td>{v.handle}</td><td>{v.postedAt}</td><td>{v.provenance}</td><td>{v.disclosed ? "disclosed" : "not detected"}</td><td>{hours(v.gapHours)}</td></tr>
        ))}</tbody>
      </table>
      <h2>Qualifying transfers</h2>
      {qualifying.length === 0 ? <p>None.</p> : (
        <table>
          <thead><tr><th>From</th><th>To</th><th>Amount (ETH)</th><th>Block</th><th>Transaction</th></tr></thead>
          <tbody>{qualifying.map((q) => (
            <tr key={q.txHash}><td><code>{short(q.t?.from ?? "", 10, 6)}</code></td><td><code>{short(q.t?.to ?? "", 10, 6)}</code></td><td>{ethFrom(q.amountWei)}</td><td>{q.t?.blockNumber}</td><td><code>{short(q.txHash)}</code></td></tr>
          ))}</tbody>
        </table>
      )}
      <h2>Market data (RYO)</h2>
      <p>{record.market.status}: {record.market.tool} for {record.market.symbol} returned “{record.market.message}” ({record.market.code}), trace id {record.market.traceId}.</p>
      <h2>Missing data</h2>
      <p>{record.market.status === "UNAVAILABLE" ? "Market evidence from RYO. " : ""}{record.provider.status === "failed" ? record.provider.detail : "No provider data missing."}</p>
      <h2>Limitations</h2>
      <p>Personas and posts are synthetic. Transfers are testnet transfers on Ethereum Sepolia. The CRE step runs as a local simulation, not a deployed DON. Disclosure is a heuristic flag. Nothing here is a finding that any law was broken.</p>
      <p><button type="button" className="no-print" onClick={() => window.print()}>Print</button> <a className="no-print" href="#/">Back to dashboard</a></p>
    </article>
  );
}

export type { Voice };
