import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { BUILT_WITH, CONTRACT, DASHBOARD, ETHERSCAN, FAQ_TEASER, HERO, HOW, LIMITS, NAV, PAGES, PROBLEM, PROOF, REPO_URL, T1_TX, T2_TX } from "./content.ts";
import type { SitePage } from "./route.ts";

const BASE = import.meta.env.BASE_URL;
const MARK_WHITE = `${BASE}brand/echt-mark-white.svg`;
const MARK_BLACK = `${BASE}brand/echt-mark-black.svg`;
const short = (hash: string) => `${hash.slice(0, 10)}…${hash.slice(-4)}`;

// The mark sits before the word, 8 px apart, both centred on the header line. The dashboard header uses the
// same lockup with the black mark in light mode (styles.css).
export function Lockup() {
  return (
    <span className="lockup">
      <img className="mark mark-white" src={MARK_WHITE} alt="" width="46" height="28" />
      <img className="mark mark-black" src={MARK_BLACK} alt="" width="46" height="28" />
      <span className="lockup-word">echt</span>
    </span>
  );
}

// Entrance and reveal motion. Nothing hides unless the page has JavaScript and the reader accepts motion.
function useReveal(key: string) {
  useEffect(() => {
    document.documentElement.classList.add("js");
    const items = document.querySelectorAll<HTMLElement>(".reveal:not(.is-in)");
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("is-in");
          io.unobserve(en.target);
        }
      }),
      { threshold: 0.12 },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [key]);
}

// Full-screen menu. Opaque, traps focus (the rest of the page is inert), closes on Esc, locks page scroll,
// and returns focus to the button that opened it.
function Menu({ open, onClose, current }: { open: boolean; onClose: () => void; current: SitePage }) {
  const panel = useRef<HTMLDivElement>(null);
  const close = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [open, close]);

  // Above the mobile breakpoint the header shows the links, so an open menu closes.
  useEffect(() => {
    if (!open) return;
    const wide = window.matchMedia("(min-width: 769px)");
    const onChange = () => { if (wide.matches) close(); };
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, [open, close]);

  if (!open) return null;
  const items = [{ page: "home" as const, label: "Home" }, ...NAV];
  return (
    <div className="menu" role="dialog" aria-modal="true" aria-label="Site menu" ref={panel}>
      <div className="menu-top">
        <Lockup />
        <button type="button" className="menu-close" onClick={close} aria-label="Close menu">
          <span aria-hidden="true">✕</span>
        </button>
      </div>
      <nav aria-label="Menu">
        <ul className="menu-list">
          {items.map((item) => (
            <li key={item.page}>
              {/* Only a section page is highlighted. Home is the landing itself, not a section, so it never takes the lime. */}
              <a href={item.page === "home" ? "#/" : `#/${item.page}`} aria-current={current !== "home" && current === item.page ? "page" : undefined} onClick={close}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function SiteHeader({ page, menuOpen, setMenuOpen }: { page: SitePage; menuOpen: boolean; setMenuOpen: (open: boolean) => void }) {
  return (
    <header className="site-header" inert={menuOpen}>
      <div className="site-wrap header-row">
        <a className="home-link" href="#/" aria-label="Echt home">
          <Lockup />
        </a>
        <nav aria-label="Pages" className="desk-nav">
          <ul>
            {NAV.map((item) => (
              <li key={item.page}>
                <a href={`#/${item.page}`} aria-current={page === item.page ? "page" : undefined}>{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <a className="btn btn-small" href={DASHBOARD}>Open dashboard</a>
        <button
          type="button"
          className="menu-button"
          aria-expanded={menuOpen}
          aria-controls="site-menu"
          onClick={() => setMenuOpen(true)}
        >
          <span className="sr-only">Open menu</span>
          <span aria-hidden="true" className="menu-bars" />
        </button>
      </div>
    </header>
  );
}

function SiteFooter({ inert }: { inert: boolean }) {
  return (
    <footer className="site-footer" inert={inert}>
      <div className="site-wrap footer-row">
        <p className="footer-line">
          <a href={REPO_URL} rel="noopener noreferrer" target="_blank">Source on GitHub</a>
          <span aria-hidden="true"> · </span>
          Echt
        </p>
        <p className="footer-line muted">Practice trades only. Testnet only (Ethereum Sepolia).</p>
        {/* One dashboard button on mobile: the header holds it. The footer repeats it on desktop only. */}
        <a className="btn btn-ghost footer-dashboard" href={DASHBOARD}>Open dashboard</a>
      </div>
    </footer>
  );
}

function MoreLink({ to, label }: { to: string; label: string }) {
  return (
    <p className="more">
      <a href={`#/${to}`}>Read more<span className="sr-only"> about {label}</span> <span aria-hidden="true">→</span></a>
    </p>
  );
}

function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-glow" aria-hidden="true" />
      <div className="site-wrap hero-grid">
        <div className="hero-copy">
          <h1 id="hero-title" className="hero-title">{HERO.title}</h1>
          <p className="hero-sub">{HERO.sub}</p>
          <div className="hero-actions">
            <a className="btn" href={DASHBOARD}>Open dashboard</a>
          </div>
        </div>
        <figure className="hero-art">
          <svg viewBox="0 0 480 300" role="img" aria-label="Seven voices linked to one campaign source. Five of the seven are linked.">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => {
              const y = 36 + i * 40;
              const linked = i < 5;
              return (
                <path
                  key={`line-${i}`}
                  pathLength={1}
                  d={`M 70 ${y} C 190 ${y}, 300 150, 402 150`}
                  className={linked ? "wire linked" : "wire"}
                  style={{ "--i": i } as CSSProperties}
                />
              );
            })}
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <circle key={`voice-${i}`} cx="70" cy={36 + i * 40} r="9" className={i < 5 ? "node linked" : "node"} />
            ))}
            <circle cx="402" cy="150" r="20" className="source" />
            <text x="402" y="196" textAnchor="middle" className="source-label">source</text>
          </svg>
          <p className="verdict-chip">
            <span className="chip-dot" aria-hidden="true" />
            BLOCK · 5 of 7 linked
          </p>
          <figcaption>{HERO.caption}</figcaption>
        </figure>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="section" id="problem" aria-labelledby="problem-title">
      <div className="site-wrap">
        <div className="reveal">
          <h2 id="problem-title">{PROBLEM.title}</h2>
          <ul className="facts">
            {PROBLEM.facts.map((f) => (
              <li key={f.source} className="fact">
                <p className="fact-figure">{f.figure}</p>
                <p>{f.text}</p>
                <p className="fact-source"><a href={f.href} rel="noopener noreferrer" target="_blank">{f.source}</a></p>
              </li>
            ))}
          </ul>
          <MoreLink to={PROBLEM.more} label={PROBLEM.moreLabel} />
        </div>
      </div>
    </section>
  );
}

function How() {
  return (
    <section className="section" aria-labelledby="how-title">
      <div className="site-wrap">
        <div className="reveal">
          <h2 id="how-title">{HOW.title}</h2>
          <ol className="steps">
            {HOW.steps.map((s, i) => (
              <li key={s.title} className="step">
                <span className="step-num" aria-hidden="true">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
          <MoreLink to={HOW.more} label={HOW.moreLabel} />
        </div>
      </div>
    </section>
  );
}

function Proof() {
  return (
    <section className="section" aria-labelledby="proof-title">
      <div className="site-wrap">
        <div className="reveal">
          <h2 id="proof-title">{PROOF.title}</h2>
          <p className="lede">{PROOF.text}</p>
          <ul className="proof-links">
            {PROOF.items.map((item) => (
              <li key={item.href}>
                <a href={item.href} rel="noopener noreferrer" target="_blank">
                  <span>{item.label}</span>
                  <span className="muted">{item.text}</span>
                </a>
              </li>
            ))}
          </ul>
          <MoreLink to={PROOF.more} label={PROOF.moreLabel} />
        </div>
      </div>
    </section>
  );
}

function BuiltWith() {
  return (
    <section className="section" aria-labelledby="built-title">
      <div className="site-wrap">
        <div className="reveal">
          <h2 id="built-title">{BUILT_WITH.title}</h2>
          <ul className="stack">
            {BUILT_WITH.items.map((item) => (
              <li key={item.name} className="stack-item">
                <h3>{item.name}</h3>
                <p>{item.text}</p>
              </li>
            ))}
          </ul>
          <MoreLink to={BUILT_WITH.more} label={BUILT_WITH.moreLabel} />
        </div>
      </div>
    </section>
  );
}

function Limits() {
  return (
    <section className="section" aria-labelledby="limits-title">
      <div className="site-wrap">
        <div className="reveal">
          <h2 id="limits-title">{LIMITS.title}</h2>
          {LIMITS.lines.map((line) => <p key={line} className="lede">{line}</p>)}
          <MoreLink to={LIMITS.more} label={LIMITS.moreLabel} />
        </div>
      </div>
    </section>
  );
}

function FaqTeaser() {
  return (
    <section className="section" aria-labelledby="faq-title">
      <div className="site-wrap">
        <div className="reveal">
          <h2 id="faq-title">Questions</h2>
          <dl className="qa">
            {FAQ_TEASER.map((item) => (
              <div key={item.q} className="qa-item">
                <dt>{item.q}</dt>
                <dd>{item.a}</dd>
              </div>
            ))}
          </dl>
          <MoreLink to="faq" label="the FAQ" />
        </div>
      </div>
    </section>
  );
}

function Landing() {
  return (
    <>
      <Hero />
      <Problem />
      <How />
      <Proof />
      <BuiltWith />
      <Limits />
      <FaqTeaser />
    </>
  );
}

// Section pages: the fuller text for one landing section, with the same facts and links.
function SectionPage({ page }: { page: Exclude<SitePage, "home"> }) {
  const p = PAGES[page];
  return (
    <article className="section-page site-wrap reveal">
      <p className="crumb"><a href="#/">Echt</a> <span aria-hidden="true">/</span> {p.title}</p>
      <h1>{p.title}</h1>
      <p className="lede">{p.intro}</p>
      {"body" in p && p.body.map((para) => <p key={para.slice(0, 40)} className="body-text">{para}</p>)}
      {"facts" in p && (
        <ul className="facts">
          {p.facts.map((f) => (
            <li key={f.source} className="fact">
              <p className="fact-figure">{f.figure}</p>
              <p>{f.text}</p>
              <p className="fact-source"><a href={f.href} rel="noopener noreferrer" target="_blank">{f.source}</a></p>
            </li>
          ))}
        </ul>
      )}
      {"list" in p && (
        <ul className="proof-links">
          {p.list.map((item) => (
            <li key={item.href}>
              <a href={item.href} rel="noopener noreferrer" target="_blank"><span>{item.label}</span></a>
            </li>
          ))}
        </ul>
      )}
      {"qa" in p && (
        <dl className="qa">
          {p.qa.map((item) => (
            <div key={item.q} className="qa-item">
              <dt>{item.q}</dt>
              <dd>{item.a}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="actions">
        {p.links.map((l) => (
          <a key={l.href} className="btn btn-ghost" href={l.href}>{l.label}</a>
        ))}
      </p>
      <p className="muted small">
        Verdict transactions: <a href={`${ETHERSCAN}/tx/${T1_TX}`} rel="noopener noreferrer" target="_blank">T1 {short(T1_TX)}</a>,{" "}
        <a href={`${ETHERSCAN}/tx/${T2_TX}`} rel="noopener noreferrer" target="_blank">T2 {short(T2_TX)}</a>, contract{" "}
        <a href={`${ETHERSCAN}/address/${CONTRACT}`} rel="noopener noreferrer" target="_blank">{short(CONTRACT)}</a>.
      </p>
    </article>
  );
}

// The landing and section pages share one shell. The dashboard renders its own header (see App.tsx).
export function SitePages({ page }: { page: SitePage }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useReveal(page);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = page === "home"
      ? "Echt · check crypto hype before a practice trade"
      : `${PAGES[page].title} · Echt`;
  }, [page]);

  return (
    <div className="site" data-page={page}>
      <a className="skip" href="#site-main">Skip to content</a>
      <SiteHeader page={page} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <main id="site-main" inert={menuOpen}>
        {page === "home" ? <Landing /> : <SectionPage page={page} />}
      </main>
      <div id="site-menu">
        <Menu open={menuOpen} onClose={closeMenu} current={page} />
      </div>
      <SiteFooter inert={menuOpen} />
    </div>
  );
}
