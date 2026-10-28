import type { RunInput } from "@echt/policy";
import type { RunRecord } from "./api.ts";
import { baseWhatIf, recordedPaymentVoices, runWhatIf, type WhatIf } from "./whatif.ts";

// The What-if panel re-runs the policy in the browser. The recorded verdict stays printed above the result, and the
// heading says plainly that nothing here is on-chain.
export function WhatIfPanel({ record, w, setW, onReset }: { record: RunRecord; w: WhatIf; setW: (w: WhatIf) => void; onReset: () => void }) {
  const input = record.inputs as RunInput;
  const recorded = recordedPaymentVoices(input);
  const decision = runWhatIf(record, w);
  const changed = JSON.stringify(w) !== JSON.stringify(baseWhatIf(input));
  const handleOf = (personaId: string) => record.voices.find((v) => v.personaId === personaId)?.handle ?? personaId;

  return (
    <section aria-labelledby="zone-whatif" className="zone whatif">
      <h2 id="zone-whatif">What-if <span className="muted">· computed in your browser · not on-chain</span></h2>
      <p className="whatif-recorded">Recorded verdict, unchanged: <strong>{record.verdict}</strong></p>
      <p className="whatif-result" aria-live="polite">
        What-if verdict: <strong>{decision.verdict}</strong>
        {decision.reasons.length > 0 && <span className="muted"> · {decision.reasons.join(", ")}</span>}
      </p>

      <table className="whatif-table">
        <caption className="sr-only">What-if controls for each voice</caption>
        <thead><tr><th scope="col">Voice</th><th scope="col">Payment present</th><th scope="col">Disclosure detected</th></tr></thead>
        <tbody>
          {input.voices.map((v) => {
            const canToggle = recorded.has(v.personaId);
            const handle = handleOf(v.personaId);
            return (
              <tr key={v.personaId}>
                <th scope="row">{handle}</th>
                <td>
                  <label>
                    <input
                      type="checkbox"
                      checked={w.paid[v.personaId] ?? false}
                      disabled={!canToggle}
                      aria-describedby={canToggle ? undefined : `no-payment-${v.personaId}`}
                      onChange={(e) => setW({ ...w, paid: { ...w.paid, [v.personaId]: e.target.checked } })}
                    />
                    <span className="sr-only"> payment present for {handle}</span>
                  </label>
                  {!canToggle && <span id={`no-payment-${v.personaId}`} className="muted small"> none recorded</span>}
                </td>
                <td>
                  <label>
                    <input
                      type="checkbox"
                      checked={w.disclosed[v.personaId] ?? false}
                      onChange={(e) => setW({ ...w, disclosed: { ...w.disclosed, [v.personaId]: e.target.checked } })}
                    />
                    <span className="sr-only"> disclosure detected for {handle}</span>
                  </label>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="whatif-switch">
        <label>
          <input type="checkbox" checked={w.providerDown} onChange={(e) => setW({ ...w, providerDown: e.target.checked })} />
          {" "}Transfer provider down
        </label>
      </p>
      <p className="actions">
        <button type="button" onClick={onReset} disabled={!changed}>Reset what-if</button>
      </p>
      <p className="muted small try-it">
        Try it: pick a scenario tab, press R to replay the recorded run, press E to open the Evidence Brief, and use the controls above. What-if results are not recorded.
      </p>
    </section>
  );
}
