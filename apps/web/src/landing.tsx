import type { CSSProperties } from "react";
import { CONTRACT, DASHBOARD, ETHERSCAN, HERO, PAGES, T1_FACTS, T1_TX } from "./content.ts";

// The landing page. Copy stays short and every fact comes from README.md or docs/PRD.md; the T1 numbers are checked
// against the recorded run by apps/web/test/landing-facts.test.ts.
const short = (hash: string) => `${hash.slice(0, 8)}…${hash.slice(-5)}`;

function FloatingCards() {
  // Decorative: the headline carries the meaning, so these cards are hidden from assistive technology.
  return (
    <div className="float-layer" aria-hidden="true">
      <div className="glass float-card card-post">
        <p>@echt_persona_03 · bullish ETH</p>
      </div>
      <div className="glass float-card card-chip">
        <span className="chip-dot" />
        <p>0.002 ETH · {T1_FACTS.gapHours} before post</p>
      </div>
      <div className="glass float-card card-pill">
        <span className="pill">Blocked · THRESHOLD_MET</span>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="hero hero-center" aria-labelledby="hero-title">
      <div className="hero-glow" aria-hidden="true" />
      <div className="site-wrap hero-stage">
        <h1 id="hero-title" className="hero-title">{HERO.title}</h1>
        <p className="hero-sub">{HERO.sub}</p>
        <div className="hero-actions">
          <a className="btn" href={DASHBOARD}>Open dashboard</a>
        </div>
        <FloatingCards />
      </div>
    </section>
  );
}

// The live demo plays once through the recorded T1 run. The steps appear in order; with reduced motion they all show.
function Demo() {
  return (
    <section className="section" aria-labelledby="demo-title">
      <div className="site-wrap reveal">
        <h2 id="demo-title">One check, three steps</h2>
        <div className="glass demo-card">
          <ol className="demo-steps">
            <li className="demo-step" style={{ "--d": "0ms" } as CSSProperties}>
              <span className="demo-num" aria-hidden="true">1</span>
              <p>Seven bullish voices on one token.</p>
            </li>
            <li className="demo-step" style={{ "--d": "1200ms" } as CSSProperties}>
              <span className="demo-num" aria-hidden="true">2</span>
              <p>The payment trail is checked: {T1_FACTS.linked} of {T1_FACTS.voices} voices were paid from one source before posting.</p>
            </li>
            <li className="demo-step" style={{ "--d": "2400ms" } as CSSProperties}>
              <span className="demo-num" aria-hidden="true">3</span>
              <p><strong>{T1_FACTS.verdict}</strong></p>
            </li>
          </ol>
          <p className="muted small demo-foot">
            Recorded T1 run, testnet transfers.{" "}
            <a href={`${ETHERSCAN}/tx/${T1_TX}`} rel="noopener noreferrer" target="_blank">Read the verdict transaction</a>
          </p>
        </div>
      </div>
    </section>
  );
}

const TILES = [
  { kind: "trail", title: "The payment trail, checked by Chainlink CRE", text: "A CRE workflow reads each voice's transfers at a pinned block." },
  { kind: "closed", title: "Fails closed", text: "Missing or failed data gives REVIEW, never ELIGIBLE." },
  { kind: "replay", title: "Replayable evidence", text: "Replay recomputes the decision in your browser. Its evidence hash matches the one on chain." },
  { kind: "chain", title: "The verdict on Ethereum Sepolia", text: "Each verdict is written to a contract you can read.", href: `${ETHERSCAN}/address/${CONTRACT}`, link: "Read the contract" },
  { kind: "practice", title: "Practice trades only", text: "No real funds move. The RYO tools are read-only." },
] as const;

function Bento() {
  return (
    <section className="section" aria-labelledby="why-title">
      <div className="site-wrap reveal">
        <h2 id="why-title">Why it holds</h2>
        <ul className="bento">
          {TILES.map((t) => (
            <li key={t.kind} className={`glass tile tile-${t.kind}`}>
              <span className={`tile-visual v-${t.kind}`} aria-hidden="true">
                {t.kind === "trail" && <><i /><i /><i /><i /></>}
                {t.kind === "closed" && <span className="pill">REVIEW</span>}
                {t.kind === "replay" && <span className="pill">MATCH</span>}
                {t.kind === "chain" && <span className="chip">{short(CONTRACT)}</span>}
                {t.kind === "practice" && <span className="chip">PRACTICE</span>}
              </span>
              <h3>{t.title}</h3>
              <p>{t.text}</p>
              {"href" in t && (
                <a className="tile-link" href={t.href} rel="noopener noreferrer" target="_blank">{t.link}</a>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const PFR = [
  { label: "Problem", text: "About 160 influencers accepted paid promotions in a 2025 leak. Fewer than 5 labelled them as ads." },
  { label: "Fix", text: "Echt checks whether converging voices were paid from one source before a practice trade opens." },
  { label: "Result", text: `T1: BLOCK, ${T1_FACTS.linked} of ${T1_FACTS.voices} voices linked. T2: ELIGIBLE, 0 voices linked.` },
];

function ProblemFixResult() {
  return (
    <section className="section" aria-labelledby="pfr-title">
      <div className="site-wrap reveal">
        <h2 id="pfr-title" className="sr-only">Problem, fix and result</h2>
        <ol className="pfr">
          {PFR.map((p) => (
            <li key={p.label} className="glass pfr-item">
              <h3>{p.label}</h3>
              <p>{p.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// A tile, not a button: the mobile header holds the only dashboard button. The Brief link is the way in here.
function DashboardPreview() {
  return (
    <section className="section" aria-labelledby="preview-title">
      <div className="site-wrap reveal">
        <h2 id="preview-title">The dashboard, from the recorded run</h2>
        <div className="glass preview">
          <p className="preview-verdict">{T1_FACTS.verdict}</p>
          <ul className="preview-row">
            <li>{T1_FACTS.linked} of {T1_FACTS.voices} voices linked</li>
            <li>{T1_FACTS.payments} payments</li>
            <li>Pinned block {T1_FACTS.pinnedBlock.toLocaleString("en-US")}</li>
          </ul>
          <p className="muted small">Evidence hash {short(T1_FACTS.evidenceHash)}</p>
          <a className="tile-link" href="#/brief/T1">Read the Evidence Brief</a>
        </div>
      </div>
    </section>
  );
}

// Objection handling: the first three questions from the FAQ page, unchanged. The rest live on #/faq.
function Questions() {
  return (
    <section className="section" aria-labelledby="faq-title">
      <div className="site-wrap reveal">
        <h2 id="faq-title">Questions</h2>
        <dl className="qa">
          {PAGES.faq.qa.slice(0, 3).map((item) => (
            <div key={item.q} className="qa-item">
              <dt>{item.q}</dt>
              <dd>{item.a}</dd>
            </div>
          ))}
        </dl>
        <p className="more"><a href="#/faq">All questions <span aria-hidden="true">→</span></a></p>
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="section" aria-labelledby="cta-title">
      <div className="site-wrap reveal">
        <div className="glass cta-band">
          <h2 id="cta-title">See the check on the real record</h2>
          <p className="lede">Replay the T1 run and check the transactions yourself.</p>
          <div className="actions">
            <a className="btn desk-only" href={DASHBOARD}>Open dashboard</a>
            <a className="btn btn-ghost" href="#/brief/T1">Read the Evidence Brief</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Landing() {
  return (
    <>
      <Hero />
      <Demo />
      <Bento />
      <ProblemFixResult />
      <DashboardPreview />
      <Questions />
      <CtaBand />
    </>
  );
}
