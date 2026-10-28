import { useEffect, useState } from "react";
import { canonicalJson, type JsonValue } from "@echt/policy";
import { fetchRecord, PUBLIC_DEMO, startRun, type RunRecord } from "./api.ts";
import { replay, type ReplayResult } from "./replay.ts";
import { Banner, Brief, Market, PaymentGraph, Proof, Proposal, ReplayDialog, RunDrawer, SCENARIOS, type RunPhase } from "./components.tsx";
import { recordOf, screenFor, type LoadState } from "./state.ts";

// The Brief route names its scenario in the hash, so the dashboard and the Brief share one URL scheme.
const briefScenario = (): string | null => {
  const m = window.location.hash.match(/^#\/brief\/(T\d)$/);
  return m ? m[1]! : null;
};

export function App() {
  const [scenario, setScenario] = useState<string>("T1");
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<RunPhase>({ kind: "idle" });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null);
  const [brief, setBrief] = useState<string | null>(briefScenario());
  const record = recordOf(load);
  const screen = screenFor(load);

  // The Brief route names its own scenario, so the record it shows must be that scenario too.
  useEffect(() => {
    if (brief && brief !== scenario) setScenario(brief);
  }, [brief, scenario]);

  useEffect(() => {
    const onHash = () => setBrief(briefScenario());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Loading is the state until this request settles. A stale answer for an earlier tab is ignored.
  useEffect(() => {
    let current = true;
    setLoad({ status: "loading" });
    fetchRecord(scenario)
      .then((r) => current && setLoad({ status: "ready", record: r }))
      .catch((e: Error) => current && setLoad({ status: "error", message: e.message }));
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

  const runReplay = () => {
    if (record) setReplayResult(replay(record));
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
      const tag = (e.target as HTMLElement).tagName;
      if (e.altKey || e.ctrlKey || e.metaKey || tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).closest("dialog")) return;
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
  const exportJson = () => {
    if (!record) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([canonicalJson(record.evidence as Record<string, JsonValue>)], { type: "application/json" }));
    a.download = `echt-${scenario}-evidence.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <a className="skip" href="#main">Skip to decision</a>
      <header className="top">
        <h1 className="brand">Echt</h1>
        <nav aria-label="Scenarios">
          <ul className="tabs">
            {SCENARIOS.map((s) => (
              <li key={s.id}>
                <button type="button" aria-pressed={scenario === s.id} onClick={() => { setScenario(s.id); setPhase({ kind: "idle" }); setReplayResult(null); }}>
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
            <button type="button" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
          </div>
        )}
        {(screen === "record" || screen === "empty") && (
          <>
            <Banner record={record} phase={phase} />
            <div className="columns">
              <div className="reveal"><PaymentGraph record={record} /></div>
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
            {!PUBLIC_DEMO && <RunDrawer open={drawerOpen} setOpen={setDrawerOpen} phase={phase} log={log} />}
          </>
        )}
      </main>
      {replayResult && <ReplayDialog result={replayResult} scenario={scenario} onClose={() => setReplayResult(null)} />}
    </>
  );
}
