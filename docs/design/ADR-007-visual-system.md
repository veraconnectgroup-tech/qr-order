# ADR-007 — QR Order / Denis Visual System

| Field | Value |
|-------|--------|
| **Status** | **Proposed** — design north star (May 2026) |
| **Relates to** | [ADR-005 Denis Maximum](../architecture/ADR-005-denis-maximum.md), `.cursor/rules/project.mdc` |
| **As-built audit** | 4 disconnected visual silos (see §2) |
| **Implementation** | Tracks **V0–V8** (§9), one PR per track |

---

## 1. Problem statement

Backend and Denis architecture (M0–M27) are coherent. **Visual layer is not.**

| Surface | Current look | User impact |
|---------|--------------|-------------|
| **Dashboard** (`dashboard-theme`) | Dark zinc + orange — strong | Tables/Floor feel “premium”; Overview stacks 5 KPIs + 2×2 cards + 360px Denis card → **long scroll, low scan** |
| **Guest** (`guest-theme`) | Same palette, different component choices | OK base; AI chat uses ad-hoc classes, not Denis chrome |
| **Admin** | `bg-neutral-50`, shadcn **blue** `:root` primary | Feels like a different product; Denis debug/insights look “internal tool” |
| **Platform** | Same light admin shell | Same fracture |
| **Marketing** (`landing-page`) | Raycast-style `#08080c`, custom utilities, brand copy **“Vera”** | Third aesthetic; does not inherit product tokens |
| **Kitchen** | Minimal `kitchen-theme` | Acceptable isolation (high contrast) |

**Goal:** One **design system** with **contextual density**, so Denis reads as the same premium intelligence everywhere — without forcing KDS or marketing into identical layouts.

---

## 2. Design principles

1. **One token spine, many densities** — Same colors, type, radius, motion; ops screens are denser, guest is more airy.
2. **Floor-first ops** — If staff see it in 3 seconds, it wins. Overview = cockpit, not blog layout.
3. **Denis is a sub-brand, not a purple chatbot** — Distinct AI chrome (glow, chips, avatar) on top of QR Order zinc+ember.
4. **No spinners** — Skeleton shimmer only (existing rule).
5. **Touch & legibility** — Min 48px targets on guest/waiter; dashboard tablet 44px; KDS 56px+.
6. **Motion 200ms** — `ease-out` for enter; no bounce; reduced-motion respected.
7. **Status color is sacred** — Order status hues stay the single source in `globals.css` (already correct in `dashboard-theme`).

---

## 3. Brand architecture

```
┌─────────────────────────────────────────────────────────────┐
│  QR ORDER (platform)                                         │
│  Wordmark · zinc neutrals · ember accent #f97316            │
├─────────────────────────────────────────────────────────────┤
│  DENIS (AI layer)                                            │
│  Mark · subtle aurora gradient · chip grammar · voice ring   │
│  Never replaces platform orange — extends it                 │
└─────────────────────────────────────────────────────────────┘
```

### Naming (decision required)

| Option | Marketing | Product chrome | Recommendation |
|--------|-----------|----------------|----------------|
| A | **Vera** (DE hospitality) | QR Order in app | Align `page.tsx` metadata with dashboard “Skyline” tenants |
| B | **QR Order** everywhere | Drop Vera on landing | Simpler B2B |
| C | **Vera** product + “powered by Denis” | Denis only for AI surfaces | Best for premium AI story |

**Proposal: C** — Vera for public site; in-app sidebar “Denis” with shared tokens; footer “Vera by …” optional.

### Logo / mark

- **Platform:** Wordmark, no icon required in v1.
- **Denis mark:** Minimal monogram (e.g. stylised “D” in ember gradient ring) — 24×24 nav, 40×40 chat header. Not generic `Sparkles` as primary identity.

---

## 4. Token system (L0) — single file, scoped themes

**Source of truth:** extend `src/app/globals.css` → split to `src/styles/tokens/` when V2 lands.

### 4.1 Core palette (all product surfaces)

| Token | Value | Role |
|-------|-------|------|
| `--qr-void` | `#09090b` | App background |
| `--qr-surface-1` | `#131316` | Cards |
| `--qr-surface-2` | `#1c1c21` | Raised / popover |
| `--qr-surface-3` | `#2a2a32` | Inputs, overlays |
| `--qr-border` | `#232329` | Default border |
| `--qr-border-subtle` | `#1a1a1f` | Section dividers |
| `--qr-text` | `#fafafa` | Primary text |
| `--qr-text-secondary` | `#d4d4d8` | Labels |
| `--qr-text-muted` | `#71717a` | Meta |
| `--qr-ember` | `#f97316` | Primary CTA, active nav |
| `--qr-ember-hover` | `#ea580c` | Hover |
| `--qr-ember-muted` | `rgba(249,115,22,0.12)` | Active bg |
| `--qr-ember-glow` | `rgba(249,115,22,0.35)` | Focus ring / Denis halo |

**Migrate:** map existing `--dash-*` → `--qr-*` aliases (no breaking rename in one PR).

### 4.2 Denis AI tokens (additive)

| Token | Value | Role |
|-------|-------|------|
| `--denis-aurora-1` | `#fb923c` | Gradient stop |
| `--denis-aurora-2` | `#f97316` | Gradient stop |
| `--denis-aurora-3` | `#c2410c` | Depth |
| `--denis-bubble-user` | `--qr-surface-3` | User message |
| `--denis-bubble-assistant` | `--qr-surface-2` | Assistant message |
| `--denis-chip-bg` | `--qr-ember-muted` | Quick reply / T0 chip |
| `--denis-chip-border` | `rgba(249,115,22,0.25)` | Chip outline |
| `--denis-voice-pulse` | `--qr-ember-glow` | Mic recording |

### 4.3 Admin / platform mode (converge to dark pro)

**Do not keep light blue admin** for Denis-era product.

| Token | Light (legacy, deprecate) | **Admin pro (target)** |
|-------|-------------------------|-------------------------|
| Background | `#fafafa` | `#09090b` |
| Primary | `#2563eb` | `#f97316` |
| Card | `#ffffff` | `#131316` |

Implement as `.admin-theme` mirroring `.dashboard-theme` with **wider content** (max-w-6xl forms) and **lighter density** than KDS.

### 4.4 Marketing mode

Landing keeps cinematic hero (gradient mesh, glass). **Must consume L0 tokens** for orange/zinc/type — remove duplicate hex in `landing-*` where possible.

### 4.5 Typography

| Role | Family | Size / weight |
|------|--------|---------------|
| Display | `--font-display` (existing) | 28–32px bold, tracking-tight |
| Heading | sans | 20–24px semibold |
| Body | sans (Inter) | 14px regular |
| Caption | sans | 11–12px medium, uppercase labels |
| **Stat / KPI** | sans tabular | 32–40px extrabold |
| **Floor table #** | sans | 32px extrabold (keep) |
| Denis chat | body 15px on guest, 14px dashboard | line-height 1.45 |

### 4.6 Radius & elevation

| Level | Radius | Shadow |
|-------|--------|--------|
| Chip | `9999px` / `full` | none |
| Control | `10px` (`--radius`) | `--shadow-xs` |
| Card | `12–16px` (`rounded-xl`) | `--shadow-card` |
| Sheet / modal | `16px` top | `--shadow-lg` |
| Denis panel | `20px` | ember glow `0 0 40px var(--qr-ember-glow)` at 8% opacity |

### 4.7 Spacing scale (4px grid)

`1=4, 2=8, 3=12, 4=16, 5=20, 6=24, 8=32, 10=40, 12=48`

**Density profiles:**

| Profile | Padding card | Gap grid | Use |
|---------|--------------|----------|-----|
| `compact` | 12px | 8px | Overview KPI strip, KDS |
| `comfortable` | 16px | 12px | Tables, orders |
| `luxury` | 20px | 16px | Guest menu, Denis sheet |

---

## 5. Component taxonomy (L1–L2)

### 5.1 Primitives (`src/components/ui/` + wrappers)

| Component | Notes |
|-----------|--------|
| `QrCard` | variant: `default \| interactive \| status` — replaces ad-hoc `rounded-xl border border-dash-border` |
| `QrKpi` | label + stat + delta pill (replaces `OverviewKpiCard` styling only) |
| `QrButton` | `primary \| secondary \| ghost \| danger`; primary = ember |
| `QrBadge` | status colors from CSS vars only |
| `QrSkeleton` | shimmer on `--qr-surface-2` |
| `DenisChip` | T0 / quick reply — full token, min-h 44 guest |
| `DenisAvatar` | mark + optional pulse when “thinking” |
| `DenisPanel` | chat container, sheet, dashboard card shared chrome |

### 5.2 Patterns

| Pattern | Reference implementation | Reuse |
|---------|-------------------------|--------|
| **Floor grid** | `/dashboard/tables` zone sections | Overview mini-map, Denis floor hints |
| **Order status pill** | orders kanban | everywhere |
| **Ops top bar** | revenue + live + notifications | admin/platform equivalent |
| **Sidebar** | 260px, section labels OPERATIONS / FLOOR | admin same structure |
| **Empty state** | illustration optional; one line + CTA | all surfaces |

---

## 6. Shell layouts (L3)

### 6.1 Dashboard shell (keep structure, fix content grid)

```
┌──────────┬──────────────────────────────────────────────────┐
│ Sidebar  │ TopBar: title · revenue · live · notifications │
│ 260px    ├──────────────────────────────────────────────────┤
│          │ COCKPIT (no vertical stack of 4 full cards)      │
│          │ ┌ KPI strip ────────────────────────────────────┐ │
│          │ │ Rev │ Orders │ Avg │ Tables │ Calls          │ │
│          │ └─────────────────────────────────────────────┘ │
│          │ ┌────────────────────────────┬─────────────────┐ │
│          │ │ Floor snapshot (zones)      │ Quick actions    │ │
│          │ │ + last 4 orders inline      │ (sticky)         │ │
│          │ ├────────────────────────────┴─────────────────┤ │
│          │ │ Denis insights (collapsed default, expand)    │ │
│          │ └──────────────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────────────┘
```

**Changes vs today:**

- Remove 2×2 grid that puts sparkline + active sessions as **full cards** below fold.
- **Sparkline** → inline under “Revenue today” KPI (spark only, 48px tall).
- **Active sessions** → compact **floor dots** row inside KPI strip or top of floor snapshot (reuse tables visual language).
- **AiIntelligenceCard** → `DenisInsightsCollapsible` max **240px** collapsed; full analytics → `/dashboard/denis`.
- **Live feed** → max 4 rows, single column beside floor — not half-page card.

**Breakpoint:** `lg` uses 12-column; `md` stacks floor then actions; mobile: KPI horizontal scroll strip (snap).

### 6.2 Admin shell

Align with dashboard:

- `.admin-theme` dark + same sidebar component family (shared `AppSidebar` primitive).
- Content: white-on-dark forms are **inverted inputs** (`--qr-surface-3` bg), not light gray boxes.
- Denis pages (`denis-debug`, `denis-insights`, `denis-sim`, rollout panel) use `DenisPanel` + timeline graph colors from §4.2.

### 6.3 Guest shell

- Keep dark luxury; unify border/radius with `QrCard`.
- Denis: bottom sheet height `min(70dvh, 600px)`; header = `DenisAvatar` + “Denis” + close; chips = `DenisChip`.
- Voice: ring animation uses `--denis-voice-pulse`.

### 6.4 Marketing shell

- Hero: keep mesh; buttons use `--qr-ember`.
- Product screenshots: render with `dashboard-theme` iframe/preview (already partially done) — **no fake third palette**.

### 6.5 Platform shell

Same as admin pro (operators are power users).

---

## 7. Denis AI visual grammar (L5)

Applies to: guest chat, dashboard Denis copilot, admin debugger, consent banner, memory welcome chips.

| Element | Rule |
|---------|------|
| **Assistant bubble** | Left, `--denis-bubble-assistant`, no purple |
| **User bubble** | Right, `--denis-bubble-user` |
| **Thinking** | 3-dot skeleton in bubble; never spinner |
| **T0 chips** | Pill, ember border, 44px min height; max 3 visible + “More” |
| **Recommendations** | Product card = `QrCard` interactive, same as menu |
| **Proactive nudge** | Toast-style bar above cart, ember left border 3px |
| **Staff copilot** | Right drawer 400px, same bubbles, denser |
| **Debugger** | Graph nodes: belief=blue-gray, goal=ember, event=muted; edges 1px `--qr-border` |
| **Consent** | Calm banner, not modal; checkmark ember |

**Copy tone in UI** is product/i18n — visual stays consistent per locale.

---

## 8. Information architecture map

| Route group | Theme class | Density | Denis chrome |
|-------------|-------------|---------|--------------|
| `(guest)` | `guest-theme` | luxury | full |
| `(dashboard)` | `dashboard-theme` → `qr-theme ops` | compact–comfortable | copilot + overview strip |
| `(dashboard)/kitchen` | `kitchen-theme` | max contrast | off |
| `(admin)` | **`admin-theme` (new)** | comfortable | debug, insights, rollout |
| `(platform)` | `admin-theme` | comfortable | eval runs |
| `/`, `/enterprise` | `marketing-theme` | airy | hero only |
| `(auth)` | neutral split | — | off |

---

## 9. Implementation roadmap (V-tracks)

One PR per track. Run `pnpm type-check` + visual smoke on Vercel preview.

| Track | Deliverable | Depends |
|-------|-------------|---------|
| **V0** | This ADR + `docs/design/visual-audit.md` screenshot checklist | — |
| **V1** | Token aliases `--qr-*`, `QrCard`, `QrButton`, `QrKpi` | V0 |
| **V2** | Overview cockpit layout (§6.1) | V1 |
| **V3** | `admin-theme` + refactor `AdminSidebar` to match dashboard | V1 |
| **V4** | `DenisChip`, `DenisAvatar`, `DenisPanel`; guest chat refactor | V1 |
| **V5** | Admin Denis pages + rollout panel visual pass | V3, V4 |
| **V6** | Dashboard `/dashboard/denis` + `AiIntelligenceCard` → collapsible | V2, V4 |
| **V7** | Landing token alignment + brand decision (Vera vs QR Order) | V1 |
| **V8** | Platform shell + Storybook or `/design-system` internal page (optional) | V3 |

**Not in v1:** custom font purchase, illustrated empty states, motion-heavy marketing.

---

## 10. Overview wireframe (target)

```
┌─────────────────────────────────────────────────────────────────┐
│ Skyline Lounge Hamburg                                          │
├─────────┬─────────┬─────────┬─────────┬─────────┬──────────────┤
│ €88.08  │ 4 ord   │ €22.02  │ 4/17 🟢│ 0 calls │ ▁▂▃▅ spark │
│ +100%   │ +100%   │ +100%   │         │           │              │
├───────────────────────────────┬─────────────────────────────────┤
│ [Indoor Bar]  Bar1 Bar2 …     │  Quick Actions                  │
│ [Rooftop]     T1 T2 …         │  ┌────┐ ┌────┐                  │
│ [Terrace]     …               │  │New │ │KDS │                  │
│ (same card component as       │  └────┘ └────┘                  │
│  /tables, max 2 rows/zone)    │  ┌────┐ ┌────┐                  │
│                               │  │Tbl │ │CSV │                  │
│ Live: #4 €22 · #3 €18 …       │  └────┘ └────┘                  │
├───────────────────────────────┴─────────────────────────────────┤
│ ▶ Denis today — 12 guests · 34% conversion    [Open Denis →]   │
└─────────────────────────────────────────────────────────────────┘
```

**Above the fold on 1440×900:** KPI strip + floor snapshot + quick actions. **No scroll** for default ops check.

---

## 11. Anti-patterns (ban list)

| Do | Don’t |
|----|--------|
| Reuse table card on overview | New one-off overview card styles |
| `text-dash-*` / semantic tokens | Raw `text-zinc-400` in feature code |
| Collapse Denis insights | 360px static AI card on overview |
| Shared sidebar primitive | Admin light blue unrelated theme |
| Skeleton loaders | Spinners |
| Ember for primary CTA | Blue `#2563eb` in product surfaces |

---

## 12. File structure (code layout)

```
src/styles/
  tokens/qr-core.css          # --qr-*, --denis-*
  tokens/status.css           # order status (move from globals)
  themes/dashboard.css        # .dashboard-theme
  themes/guest.css
  themes/admin.css            # new
  themes/marketing.css

src/components/design-system/
  qr-card.tsx
  qr-kpi.tsx
  qr-button.tsx
  denis-chip.tsx
  denis-avatar.tsx
  denis-panel.tsx
  app-sidebar.tsx             # shared shell

src/components/dashboard/
  overview-cockpit.tsx        # replaces stacked grid (V2)
```

Import from `globals.css` via `@import` — no duplicate theme blocks.

---

## 13. Success metrics

| Metric | Target |
|--------|--------|
| Overview first paint (1440px) | KPI + floor visible **without scroll** |
| Token duplication (hex in components) | −80% after V4 |
| Admin/dashboard side-by-side | Recognised as **same product** (user test n≥3) |
| Denis chat chip tap target | ≥48px guest, ≥44px dashboard |
| Lighthouse CLS on overview | <0.1 after cockpit |

---

## 14. Operator prompt

```
Visual system mode. Read docs/design/ADR-007-visual-system.md.
Implement next V-track only (V0–V8). Reuse tables floor pattern for overview.
Run pnpm type-check. Do not commit unless asked.
```

---

## 15. Immediate recommendation

**Start with V2 (Overview cockpit)** — highest pain from screenshots; uses existing table components, no admin migration yet.

**Parallel decision:** confirm **Vera vs QR Order** naming (§3) before V7 landing work.

**Denis identity:** ship `DenisAvatar` + `DenisChip` in guest (V4) so AI feels premium before admin light theme is removed.
