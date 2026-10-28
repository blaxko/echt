# Design notes: landing and dashboard references

Source: `landing-reference.MP4` (848×592, 30 fps, 12.6 s) and `dashboard-reference.MP4` (848×608, 30 fps, 19.6 s).
Frames: `frames/landing/` and `frames/dashboard/` at 2 fps (gitignored). Colours below are sampled from
full-frame PNGs (8-level quantised histogram, plus single-pixel reads). They are the feel we borrow,
not a brand to copy: no third-party logos, marks, text or product names are used in Echt.

Caveat on measurements: the videos are screen captures of other products, scaled to 848 px wide.
Pixel sizes below are therefore ratios of the frame, not CSS pixels. Animation durations come from
2 fps sampling plus playback, so they are estimates. Where a value is an estimate it says so.

## 1. Colour

### Landing reference (dark, lime accent)

| Role | Hex | Source |
|---|---|---|
| Page background | `#000000` | most common pixel, edges and hero |
| Deep panel | `#080808`, `#101010` | card and nav surfaces |
| Dark green wash | `#182018`, `#1B2719` | glow falloff behind hero |
| Accent (lime) | `#A1D11C` | CTA fill and highlighted headline word |
| Accent glow mid | `#3A5400` | edge of the lime glow |
| Headline ink | `#F4F4F2` (near white) | headline and nav text |
| Muted text | `#8A8F88` (estimated) | sub-line |

### Dashboard reference (deep teal, brass hub)

| Role | Hex | Source |
|---|---|---|
| Page background | `#020202` to `#07080B` | outer corners |
| Surface, teal-navy | `#101818`, `#151E21`, `#12181A` | panels and header bars |
| Glass panel | `#1D2123` over teal glow | modal and card |
| Teal glow | `#182828`, `#203838` | background falloff |
| Central hub (brass) | `#C89A65` | the gold central node |
| Accent violet/pink | (node colours, not sampled exactly) | node ring |

### Echt tokens chosen from these

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#f6f7f9` | `#050607` | page |
| `--surface` | `#ffffff` | `#0c1417` | cards (dashboard dark is teal-navy) |
| `--surface-glass` | n/a | `rgba(20,34,38,0.72)` | dashboard panels |
| `--ink` | `#0b0d0c` | `#f4f4f2` | text |
| `--ink-muted` | `#5b625e` | `#9aa6a2` | secondary text |
| `--accent` | `#4f7f10` (lime, AA on white) | `#a1d11c` | landing CTA and highlight |
| `--glow-teal` | n/a | `#203838` | dashboard background wash |
| `--hub` | `#c89a65` | `#c89a65` | dashboard hub and brass accents |
| `--focus` | `#0b5cad` | `#7fb6ff` | focus ring (unchanged, AA) |
| `--block` / `--review` / `--eligible` | unchanged | unchanged | verdict colours stay as they are |

Verdict colours are not restyled. They carry meaning and are checked against AA.

## 2. Type

Sans grotesk in the reference (geometric, medium-to-bold weights). Echt has no web font: the public build
serves only `'self'` fonts and the CSP has `font-src 'self'`. We use the system stack:
`ui-sans-serif, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.

| Style | Size (desktop / mobile) | Weight | Line height | Tracking |
|---|---|---|---|---|
| Hero headline | 64 px / 40 px | 700 | 1.05 | -0.02 em |
| Section headline (h2) | 40 px / 30 px | 700 | 1.1 | -0.015 em |
| Page headline (h1, section pages) | 48 px / 34 px | 700 | 1.08 | -0.02 em |
| Sub-line | 20 px / 17 px | 400 | 1.5 | 0 |
| Body | 17 px / 16 px | 400 | 1.6 | 0 |
| Small, labels, nav | 14 px | 500 | 1.4 | 0.01 em |
| Dashboard title | 16 px | 600 | 1.3 | 0 |

Reference headline measured at roughly 40 px cap-to-cap on a 848 px frame, which scales to about 64 px at
1440 CSS px. Matches the hero row above.

## 3. Spacing, radius, grid

Spacing scale (px): 4, 8, 12, 16, 24, 32, 48, 72. Nothing else.

| Use | Desktop | Mobile (≤768) |
|---|---|---|
| Between sections | 72 | 48 |
| Inside a section (headline to content) | 24 | 16 |
| Between cards in a grid | 16 | 16 |
| Page side gutter | 32 | 16 |
| Max content width | 1120 | 100% minus gutter |

Corner radii: 10 px (cards, panels, the existing `--radius`), 999 px (pill buttons, the reference
CTA is a pill), 6 px (chips and inputs). The dashboard panels use 16 px in the reference; we use 14 px.

Grid: 12 columns, 24 px gutter on desktop; 4 columns, 16 px gutter on mobile. Landing sections are
single column except "How it works" (4 across on desktop, 1 across on mobile) and "Built with" (logo row).

Header: 64 px tall, logo mark 28 px, 8 px gap to the word "echt", both vertically centred.

## 4. Motion

All durations are CSS milliseconds. All motion is disabled under `prefers-reduced-motion: reduce`
(opacity changes stay, movement and loops stop).

| Element | What moves | Duration | Easing | Trigger |
|---|---|---|---|---|
| Hero headline swap (landing ref) | cross-fade between two headlines, dot indicator follows | 600 ms fade, 4 s hold | `cubic-bezier(0.4, 0, 0.2, 1)` | loop |
| Hero lime glow | slow drift of the glow, 2–3 % of width | 12 s | `ease-in-out`, alternate | loop |
| Hero entrance | headline rises 12 px and fades in | 600 ms | `cubic-bezier(0.2, 0.8, 0.2, 1)` | page load, once |
| Hero CTA | pill background shifts to accent on hover | 180 ms | `ease-out` | hover, focus |
| Section reveal | content rises 16 px and fades in | 500 ms | `cubic-bezier(0.2, 0.8, 0.2, 1)` | enters viewport, once (IntersectionObserver) |
| Dashboard node pulse (dashboard ref) | node halo grows and fades | 2.4 s | `ease-in-out` | loop |
| Dashboard connection lines | dash offset travels along the line | 3 s linear | `linear` | loop |
| Dashboard panel (RI analysis style) | panel fades in and rises 8 px | 240 ms | `ease-out` | open |
| Mobile menu | full-screen panel fades in, links stagger 40 ms | 220 ms | `ease-out` | menu button |
| Button press | scale to 0.98 | 80 ms | `ease-out` | `:active` |

Timings marked "estimated" in the table above come from sampling, not frame-accurate reads. The landing
headline cycle was seen at about 4–5 s between swaps.

## 5. Brand and assets

- Logo for dark backgrounds: `apps/web/public/brand/echt-mark-white.svg`.
- Logo for light backgrounds: `apps/web/public/brand/echt-mark-black.svg`.
- Favicon, everywhere: `apps/web/public/brand/favicon.svg`.
- Open Graph image: generated from the mark, 1200×630, `apps/web/public/brand/og.png`.

## 6. Decisions taken from these notes

1. Dark landing by default, following the reference, with `prefers-color-scheme` light support kept.
2. The dashboard keeps its existing layout and copy. Only tokens change: teal-navy background, brass hub
   colour on the graph accents, 14 px radius, and the 240 ms panel fade.
3. No third-party fonts, images or marks. No copied headline text from the reference.
4. The lime accent appears on the landing only. The verdict colours stay on the dashboard.
