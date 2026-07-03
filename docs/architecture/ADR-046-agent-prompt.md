# ADR-046 — Univerzalni prompt za agente

Kopiraj ceo blok ispod i pošalji ga svakom agentu kao prvi (i jedini) prompt.
Isti prompt važi za sve agente — task board odlučuje ko šta radi.

---

```text
Radiš na projektu QR Order (Denis) po ADR-046 stabilizacionom planu. Prati protokol DOSLOVNO, redom:

1. PROČITAJ (obavezno, pre bilo čega):
   - docs/architecture/ADR-046-stabilization-freeze.md   (plan, pravila, spisak grešaka)
   - docs/architecture/ADR-046-task-board.md             (tabla zadataka — jedini izvor istine ko šta radi)
   - .cursor/rules/commit-checklist.mdc                  (pre-commit pravila)

2. PREUZMI I ODMAH OBELEŽI ZADATAK:
   - Na tabli nađi PRVI zadatak sa statusom TODO, redosled prioriteta: sekcija A → B → C → D.
   - Zadatke sa statusom "RADIM NA TOME" NE DIRAJ — na njima radi drugi agent.
   - PRE nego što počneš bilo kakav rad, izmeni ADR-046-task-board.md:
       Status: RADIM NA TOME
       Agent: <tvoje ime/ID> — <današnji datum i vreme>
     i SAČUVAJ fajl. Ovo je obavezno prvo — tako drugi agenti koji čitaju istu poruku
     znaju da je zadatak zauzet.
   - Jedan agent = jedan zadatak. Sledeći smeš da uzmeš tek kad ovaj zatvoriš.

3. URADI ZADATAK tačno po opisu sa table. Ključna pravila:
   - Mrtav kod (nije importovan van sopstvenog testa) se BRIŠE, ne popravlja. Provera:
     grep -rn "ime-modula" src/ | grep -v __tests__
   - Pali test koji testira STARO ponašanje (namerno promenjeno) → ažuriraj TEST.
     Pali test koji testira ŽELJENO ponašanje → popravi KOD. Nejasno? Vidi ADR-046 §3.3.
   - FREEZE je aktivan: nema novih funkcija, nema refaktorisanja van opsega zadatka.
   - Migracije: samo novi sekvencijalni broj, postojeće se nikad ne menjaju.

4. VERIFIKUJ — sva 4 moraju biti zelena, bez izuzetka:
   - pnpm test:run
   - pnpm type-check
   - pnpm lint
   - pnpm build

5. ZATVORI ZADATAK na tabli (ADR-046-task-board.md):
   - Status: ZAVRŠENO I TESTIRANO
   - Napomena: 1-2 rečenice šta je urađeno (šta obrisano / šta popravljeno / koji testovi promenjeni)
   - Dodaj red u tabelu "Dnevnik" na dnu: datum | tvoje ime | ID zadatka | kratak opis
   - Komituj kod + ažuriranu tablu ZAJEDNO, poruka: "ADR-046 <ID zadatka>: <kratak opis>"

6. AKO ZAPNEŠ:
   - Status: BLOKIRANO + tačan razlog u Napomena (šta blokira, šta si pokušao)
   - Uzmi sledeći TODO. Nikad ne ostavljaj zadatak na "RADIM NA TOME" ako ne radiš na njemu.

ZABRANJENO: nove funkcije i moduli, menjanje ADR-046 dokumenata osim statusa/napomena/dnevnika
na tabli, dva zadatka odjednom, commit sa crvenim testovima/type-check/lint/build, brisanje ili
labavljenje denis-architecture-compliance testa.
```

---

## Napomene za vlasnika (Jovica)

- Agente puštaš paralelno slobodno — task board + pravilo "jedan zadatak po agentu" sprečava sudare.
  Za sekciju A možeš 3-4 agenta odjednom (zadaci su nezavisni po fajlovima).
- Sekciju B pusti tek kad je sekcija A cela "ZAVRŠENO I TESTIRANO" — A menja skup fajlova.
- Sekcija D (zlatan tok) zahteva agenta sa pristupom browseru za test na produkciji.
- Napredak pratiš otvaranjem [ADR-046-task-board.md](ADR-046-task-board.md) — Dnevnik na dnu
  je hronologija svega što je urađeno.
