import { useEffect, useState } from "react";
import { fetchRecord, type RunRecord } from "./api.ts";
import { replay, type ReplayResult } from "./replay.ts";
import { Banner, Brief, downloadCsv, Market, PaymentGraph, Proof, Proposal, ReplayDialog, RunDrawer, SCENARIOS, type RunPhase } from "./components.tsx";
import { startRun } from "./api.ts";

// Scenario choice lives in the hash so the Evidence Brief and the dashboard share one URL scheme.
const briefScenario = (): string | null => {
  const m = window.location.hash.match(/^#\/brief\/(T\d)$/);
  return m ? m[1]! : null;
};

export function App() {
  const [scenario, setScenario] = useState<string>("T1");
  const [record, setRecord] = useState<RunRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<RunPhase>({ kind: "idle" });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null);
  const [brief, setBrief] = useState<string | null>(briefScenario());

  // The Brief route names its own scenario, so the record it shows must be that scenario too.
  useEffect(() => {
    if (brief && brief !== scenario) setScenario(brief);
  }, [brief, scenario]);

  useEffect(() => {
    const onHash = () => setBrief(briefScenario());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    setLoadError(null);
    fetchRecord(scenario).then(setRecord).catch((e: Error) => setLoadError(e.message));
  }, [scenario]);

  // Run log: stream the server's SSE for the run this session started.
  useEffect(() => {
    if (phase.kind !== "running") return;
    const es = new EventSource(`/api/runs/${phase.id}/events`);
    es.addEventListener("log", (e) => setLog((l) => [...l, JSON.parse((e as MessageEvent).data) as string]));
    es.addEventListener("done", () => {
      setPhase({ kind: "finished" });
      es.close();
    });
    es.onerror = () => es.close();
    return () => es.close();
  }, [phase]);

  // One start path for the proof-strip button. The drawer opens so the log is visible.
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

  const exportJson = () => {
    const a = document.createElement("a");
    a.href = `/api/runs/${scenario}/evidence.json`;
    a.download = `echt-${scenario}-evidence.json`;
    a.click();
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
        {loadError && <p role="alert">Could not load the run record: {loadError}</p>}
        <Banner record={record} phase={phase} />
        <div className="columns">
          <div className="reveal"><PaymentGraph record={record} /></div>
          <div className="side">
            <Proposal record={record} />
            <Market record={record} />
          </div>
        </div>
        <Proof record={record} scenario={scenario} phase={phase} onRun={startCheck} onBrief={() => { if (record) window.location.hash = `#/brief/${scenario}`; }} onReplay={runReplay} onExport={exportJson} />
        <RunDrawer open={drawerOpen} setOpen={setDrawerOpen} phase={phase} log={log} />
      </main>
      {replayResult && <ReplayDialog result={replayResult} scenario={scenario} onClose={() => setReplayResult(null)} />}
    </>
  );
}
