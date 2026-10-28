import { useCallback, useEffect, useRef, useState } from "react";
import { CONTRACT, DASHBOARD, ETHERSCAN, NAV, PAGES, REPO_URL, T1_TX, T2_TX } from "./content.ts";
import { Landing } from "./landing.tsx";
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

// Section pages: the fuller text for one section, with the same facts and links.
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
