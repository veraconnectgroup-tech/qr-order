# Denis Operations Runbook

Operational guide for venue owners and managers when Denis or ordering behaves unexpectedly. No engineering background required.

---

## Denis ne odgovara gostima

### Simptomi

- Gosti vide poruku da AI nije dostupan
- Staff dashboard → Denis health widget je crven

### Dijagnoza

1. Otvorite **Dashboard → Settings** ili pozovite support da proveri `GET /api/admin/health`:
   - `openai.circuit = "open"` → OpenAI privremeno nedostupan
   - `redis.status = "down"` → Redis offline
   - `supabase.status = "down"` → problem sa bazom

2. Proverite da li gosti mogu i dalje naručivati iz **menija** (bez chata) — to potvrđuje da je samo AI sloj pogođen.

3. Ako imate pristup Vercel-u: pogledajte logove za poslednjih 30 minuta.

### Rješenja

| Problem | Akcija | Vrijeme |
|---------|--------|---------|
| OpenAI down | Sačekajte. Circuit breaker se oporavlja ~30s. Gosti imaju fallback meni. | Auto |
| Redis down | Denis radi bez Redis-a (memory fallback). Rate limiti su mekši. | Auto |
| Supabase down | **KRITIČNO.** Gosti ne mogu naručiti. Zovite support odmah. | Manual |
| Credits exhausted | Nadopunite AI kredite na **Dashboard → Billing** | ~1 min |
| Vercel cold start | Prvi zahtev nakon mirovanja može biti spor — ignorišite ako je jednokratno | Auto |

---

## Denis daje krive odgovore

### Simptomi

- Gost kaže „dva piva" → Denis ne dodaje u korpu
- Denis predlaže jelo koje nije na meniju
- Denis odgovara na pogrešnom jeziku

### Dijagnoza

1. **Dashboard → Denis** → otvorite razgovor (turn inspector) i proverite beliefs / cart stanje.
2. Proverite da li je meni sinhronizovan — **Dashboard → Menu**, sačuvajte kategoriju da se invalidira keš.
3. Proverite **Settings → jezik lokacije** (`default_locale`).

### Rješenja

| Problem | Akcija |
|---------|--------|
| Menu not synced | Re-save meni u dashboardu |
| Wrong language | Podesite default locale u Settings |
| Cart not working | Rollout mora biti `denis_only` za pun AI order flow |
| Bad perception | Prijavite supportu — tim pokreće eval suite |

---

## Rutinske operacije

### Dnevno (~30 sekundi)

- Pogledajte Denis health widget na dashboardu
- Proverite trend **Experience Score** ako je uključen

### Sedmično

- Proverite **Denis ROI** dashboard — AI trošak vs. prihod
- Pregledajte top correction patterns (šta gosti najčešće ispravljaju)

### Mjesečno

- Pregledajte blocked injection patterns sa support timom
- Zatražite full eval izvještaj pri većim promjenama menija ili prompta

---

## Eskalacija

| Prioritet | Kada | Kontakt |
|-----------|------|---------|
| P1 | Gosti ne mogu naručiti uopšte | Support + on-call |
| P2 | Denis down, meni radi | Support (radno vrijeme) |
| P3 | Pojedinačni pogrešni odgovori | Dashboard feedback / support ticket |

---

*Ažurirajte ovaj runbook nakon svakog produkcijskog incidenta.*
