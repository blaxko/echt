import type { JsonValue } from "@echt/policy";
import { useEffect, useState } from "react";
import { fetchRecord, PUBLIC_DEMO, startRun } from "./api.ts";
import type { ReplayResult } from "./replay.ts";
import { Banner, Brief, Market, PaymentGraph, Proof, Proposal, ReplayDialog, RunDrawer, SCENARIOS, type RunPhase } from "./components.tsx";
import { recordOf, screenFor, shownFor, type LoadState } from "./state.ts";
import { Lockup } from "./site.tsx";
import { baseWhatIf, viewRecord, type WhatIf } from "./whatif.ts";
import { WhatIfPanel } from "./whatif-panel.tsx";
import type { RunInput } from "@echt/policy";

// The decision dashboard and the Evidence Brief. It is loaded on demand (see App.tsx), so the landing page does not pay for it.
export function Dashboard({ brief }: { brief: string | null }) {
  // The scenario on screen is the Brief route's when one is open, otherwise the tab the reader picked.
  const [pick, setPick] = useState<string>("T1");
  const [load, setLoad] = useState<LoadState>({ status: "loading", scenario: "T1" });
  const [attempt, setAttempt] = useState(0);
  const scenario = brief ?? pick;
  const shown = shownFor(load, scenario);
  const [phase, setPhase] = useState<RunPhase>({ kind: "idle" });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null);
  const record = recordOf(shown);
  const screen = screenFor(shown);
  // The what-if starts from the recorded run and resets when the reader moves to another scenario.
  // Keyed by scenario, so a what-if left on one scenario is simply not shown on another.
  const [whatifEdit, setWhatifEdit] = useState<{ scenario: string; w: WhatIf } | null>(null);
  const whatif = whatifEdit && whatifEdit.scenario === scenario ? whatifEdit.w : null;
  const setWhatif = (w: WhatIf | null) => setWhatifEdit(w && { scenario, w });
  const whatifBase = record ? baseWhatIf(record.inputs as RunInput) : null;

  // Loading is the state until this request settles. An answer for a scenario the reader has left is dropped.
  useEffect(() => {
    let current = true;
    fetchRecord(scenario)
      .then((r) => current && setLoad({ status: "ready", scenario, record: r }))
      .catch((e: Error) => current && setLoad({ status: "error", scenario, message: e.message }));
    return () => {
      current = false;
    };
  }, [scenario, attempt]);

  // Run log: stream the server's SSE for the run this session started (local mode only).
  useEffect(() => {
    if (phase.kind !== "running" || PUBLIC_DEMO) return;
    const es = new EventSource(`/api/runs/${phase.id}/events`);
    es.addEventListener("log", (e) => setLog((l) => [...l, JSON.parse((e as MessageEvent).data) as string]));
    es.addEventListener("done", () => {
      setPhase({ kind: "finished" });
      es.close();
    });
    es.onerror = () => es.close();
    return () => es.close();
  }, [phase]);

  const startCheck = async () => {
    setLog([]);
    setDrawerOpen(true);
    const r = await startRun(scenario);
    if ("error" in r) setPhase({ kind: "refused", message: r.error });
    else setPhase({ kind: "running", id: r.id });
  };

  // The policy code is loaded on first use, so the first paint does not pay for it.
  const runReplay = async () => {
    if (!record) return;
    const { replay } = await import("./replay.ts");
    setReplayResult(replay(record));
  };

  // Esc closes the run log when it is open, as the drawer pattern expects.
  useEffect(() => {
    if (!drawerOpen) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawerOpen(false); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [drawerOpen]);

  // Keyboard: R replays, E opens the Evidence Brief. Ignored while typing or inside a dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Key events from the page itself (document or window) have no element to inspect; ignore them.
      if (!(e.target instanceof Element)) return;
      const tag = e.target.tagName;
      if (e.altKey || e.ctrlKey || e.metaKey || tag === "INPUT" || tag === "TEXTAREA" || e.target.closest("dialog")) return;
      if (e.key === "r" || e.key === "R") runReplay();
      if ((e.key === "e" || e.key === "E") && record) window.location.hash = `#/brief/${scenario}`;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (brief && record && record.scenario === brief) {
    return (
      <main id="main">
        <Brief record={record} scenario={brief} />
      </main>
    );
  }

  // The JSON download is the canonical evidence bytes, built in the browser with the same code as the server.
  const exportJson = async () => {
    if (!record) return;
    const { canonicalJson } = await import("@echt/policy");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([canonicalJson(record.evidence as JsonValue)], { type: "application/json" }));
    a.download = `echt-${scenario}-evidence.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <a className="skip" href="#main">Skip to decision</a>
      <header className="top">
        <h1 className="brand"><a className="home-link" href="#/" aria-label="Echt home"><Lockup /></a></h1>
        <nav aria-label="Scenarios">
          <ul className="tabs">
            {SCENARIOS.map((s) => (
              <li key={s.id}>
                <button type="button" aria-pressed={scenario === s.id} onClick={() => { setPick(s.id); setPhase({ kind: "idle" }); setReplayResult(null); }}>
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <p className="legend" aria-label="Provenance legend">SYNTHETIC personas · TESTNET transfers · SIMULATED verdict run</p>
      </header>
      <main id="main" className="screen">
        {screen === "loading" && <p role="status" className="loading">Loading the run record for {scenario}…</p>}
        {screen === "error" && load.status === "error" && (
          <div role="alert" className="loading">
            <p>Could not load the run record for {scenario}: {load.message}</p>
            <button type="button" onClick={() => { setLoad({ status: "loading", scenario }); setAttempt((n) => n + 1); }}>Try again</button>
          </div>
        )}
        {(screen === "record" || screen === "empty") && (
          <>
            <Banner record={record} phase={phase} />
            <div className="columns">
              <div><PaymentGraph record={record && whatif ? viewRecord(record, whatif) : record} /></div>
              <div className="side">
                <Proposal record={record} />
                <Market record={record} />
              </div>
            </div>
            <Proof
              record={record}
              scenario={scenario}
              phase={phase}
              onRun={startCheck}
              onBrief={() => { if (record) window.location.hash = `#/brief/${scenario}`; }}
              onReplay={runReplay}
              onExport={exportJson}
            />
            {record && whatifBase && (
              <WhatIfPanel record={record} w={whatif ?? whatifBase} setW={setWhatif} onReset={() => setWhatif(null)} />
            )}
            {!PUBLIC_DEMO && <RunDrawer open={drawerOpen} setOpen={setDrawerOpen} phase={phase} log={log} />}
          </>
        )}
      </main>
      {replayResult && <ReplayDialog result={replayResult} scenario={scenario} onClose={() => setReplayResult(null)} />}
    </>
  );
}
