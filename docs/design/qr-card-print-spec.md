# QR Table Card — Print Spec (Denis Spatial)

| Field | Value |
|-------|--------|
| **Status** | v1 — bulk print implemented (May 2026) |
| **Relates to** | [ADR-007](./ADR-007-visual-system.md), [denis-spatial-implementation-plan.md](./denis-spatial-implementation-plan.md) |
| **As-built export** | `TablesBoard.downloadAllQrCodes()` · `TablesManager` PNG preview |

---

## 1. Purpose

Physical cards guests scan at the table. The card must:

1. **Scan reliably** — high contrast QR, quiet zone, no glossy overlays on code area
2. **Identify the table** — staff and guests know which table they are at
3. **Carry tenant brand** — venue name is primary; Denis is secondary attribution
4. **Never say “QR Order”** on guest-facing print — infra name only in code/URLs

---

## 2. Brand hierarchy (locked)

```
┌─────────────────────────────┐
│  [Venue logo — optional]    │
│  SKYLINE LOUNGE             │  ← tenant, largest
│  Table 12 · Rooftop         │  ← table + zone
│                             │
│         ┌─────────┐         │
│         │   QR    │         │
│         └─────────┘         │
│                             │
│  Scan to order & pay        │  ← action line (DE: „Scannen zum Bestellen“)
│  Denis · Part of Vera Group  │  ← 8–9 pt muted subline
└─────────────────────────────┘
```

| Element | Rule |
|---------|------|
| **Venue name** | Bold, 18–24 pt, tenant `organizations.name` |
| **Table label** | `{table.name}` + optional zone in muted secondary |
| **Action line** | Short imperative; localized per venue locale |
| **Denis lockup** | Table **D** mark (16 px) + “Denis” + “Part of Vera Group” — never Sparkles on print |
| **Product wordmark** | Do not use “QR Order” as headline |

---

## 3. Card formats

| Format | Size | Use case |
|--------|------|----------|
| **Tent card** | 85 × 55 mm (ISO/IEC 7810 ID-1 landscape) | Table stand, most venues |
| **Sticker** | 50 × 50 mm min | Bar rail, small tables |
| **A4 sheet** | 3 × N grid, 12 mm gutters | Bulk print from dashboard (current) |

**Bleed:** 3 mm if professional print; **safe area:** 5 mm inset from trim.

**Corner radius:** 3 mm (tent) · 2 mm (sticker) — matches `QrCard` `rounded-xl` (~12 px at screen scale).

---

## 4. QR code technical spec

| Property | Value |
|----------|--------|
| **URL pattern** | `{appUrl}/{orgSlug}/{qr_token}` — token from `tables.qr_token`, never table UUID |
| **Error correction** | **H** (30%) — tolerates logo overlay or slight damage |
| **Quiet zone** | ≥ 4 modules (margin ≥ 2 in `qrcode` lib) |
| **Module color** | `#000000` on `#ffffff` — no brand tint in QR modules |
| **Minimum print size** | 25 × 25 mm code area (32 mm recommended for dim lighting) |
| **PNG export** | 280 px @ 1× for preview; 840 px (3×) for print PNG download |

---

## 5. Color & typography

### Print palette (light card)

| Role | Hex | Notes |
|------|-----|-------|
| Card background | `#ffffff` | Scan reliability |
| Primary text | `#0a0a0a` | Venue + table |
| Secondary text | `#52525b` | Zone, action hint |
| Accent line | `#f97316` | Optional 1 px top rule — ember only, no Vera indigo |
| Denis subline | `#71717a` | 8–9 pt |

### Type

- **Font:** Inter (project default) — fallback `system-ui, sans-serif` in browser print
- **Venue:** 600 weight, tracking −0.02 em
- **Table:** 500 weight
- **Subline:** 400 weight, uppercase optional for zone chip only

Dark Denis ops chrome (`--qr-void`, zinc surfaces) is **not** used on physical cards — guests scan in varied lighting; white cards win.

---

## 6. Layout grid (tent card 85 × 55 mm)

```
        5mm safe
    ┌──────────────────────┐
    │ [optional logo 12mm] │
    │ VENUE NAME           │  y: 14mm
    │ Table · Zone         │  y: 22mm
    │                      │
    │    ┌──────────┐      │  QR: 32×32mm centered
    │    │ QR 32mm  │      │
    │    └──────────┘      │
    │ Scan to order & pay  │  y: 58mm
    │ D Denis · Vera Group │  y: 64mm
    └──────────────────────┘
```

---

## 7. As-built vs target

| Area | As-built | Target (future track) |
|------|----------|-------------------------|
| Dashboard bulk print | Branded A4 sheet via `src/lib/print/qr-table-card-print.ts` | PDF export with bleed |
| Admin PNG download | 840 px ECC H + print card dialog | Same template as export |
| Onboarding preview | Branded `QrTableCardPreview` in setup wizard | Same template as export |
| Copy | Denis subline, no “QR Order” on cards | Locale from org settings |

**Implementation note:** Shared template lives in `src/lib/print/qr-table-card-print.ts`. Update `tables-board.tsx` and `tables-manager.tsx` together when the template changes.

---

## 8. Localization

| Key | EN | DE (default market) |
|-----|----|---------------------|
| Action | Scan to order & pay | Scannen zum Bestellen & Bezahlen |
| Sheet title | `{venue} — Table ordering` | `{venue} — Tischbestellung` |
| Zone fallback | Unassigned | Ohne Bereich |

Use venue `organizations.default_locale` when available; fallback DE.

---

## 9. Accessibility & ops

- Minimum **48 mm** touch target not required on print — but QR quiet zone must not be cropped by tent fold
- Include **human-readable table name** under QR — staff must match physical table to dashboard tile
- **Do not** print full URL on guest card (staff/debug export may include URL in admin only)
- Lamination: matte finish on QR area; gloss OK on header/footer only

---

## 10. Acceptance checklist (when implementing export)

- [ ] White card, black QR, ECC H
- [ ] Venue name largest; Denis subline smallest
- [ ] No “QR Order” guest copy
- [ ] Table D mark SVG (from `DenisTableMark`) embedded or outlined for print
- [ ] 3 mm bleed PDF option for print shops
- [ ] Preview matches printed output (WYSIWYG)
- [ ] `pnpm type-check` + visual smoke on print preview dialog

---

## 11. References

- Token spine: `src/app/globals.css` (`--qr-ember`, `--qr-*`)
- Brand mark: `src/components/design-system/denis-brand-mark.tsx`
- Table mark SVG: `src/components/design-system/denis-table-mark.tsx`
- Export code: `src/components/dashboard/tables-board.tsx` · `src/components/admin/tables-manager.tsx`
