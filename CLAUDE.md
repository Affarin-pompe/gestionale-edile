# CLAUDE.md — Gestionale edile (frontend)

## Cos'è
Frontend React di un gestionale per imprese edili (cantieri, rapportini, scadenze, costi). Lo usano titolare, ufficio e capi cantiere, questi anche da telefono. Parla con un backend separato solo via API.

## Profilo
`A` — web app con utenti e dati altrui

## Stack
- **Runtime:** Node LTS, solo per sviluppo e build. In produzione sono file statici.
- **Framework:** Vite, React 19, TypeScript, shadcn/ui (Radix + Tailwind 4), React Router 7, TanStack Query e Table, React Hook Form + Zod
- **Backend:** in un altro repository. Il contratto è un file OpenAPI.
- **Deploy:** da decidere; stesso dominio delle API.

## Comandi

```bash
npm install
npm run dev
npm run lint            # ESLint con regole type-aware
npm run format:check    # Prettier (npm run format per correggere); i .md sono esclusi
npm run typecheck
npm test
npm run build
```

Prima di dichiarare finito un lavoro: lint, formattazione, tipi, test e build devono passare. Sono gli stessi controlli della CI (`.github/workflows/ci.yml`).

## Architettura in 5 righe
- `src/features/<modulo>/`: un modulo per area, sempre con `api.ts`, `routes.tsx`, `schemas.ts`, `pages/`, `components/`.
- `src/components/ui/` contiene i componenti shadcn/ui; `src/components/common/` quelli del gestionale costruiti sopra.
- `src/api/` ha i tipi generati dal contratto: non si scrivono a mano. `src/mocks/` contiene le risposte finte (MSW).
- L'azienda è sempre nell'URL (`/:azienda/...`) e nel percorso delle API.
- Il dettaglio è in `docs/frontend.md`; le decisioni sono in `docs/adr/`.

## Convenzioni di questo progetto
- Codice e commenti in inglese. Documentazione, testi dell'interfaccia e URL in italiano. I testi stanno in `src/i18n/`, mai scritti nei componenti.
- Importi e quantità arrivano dal backend come stringhe. Le anteprime si calcolano con big.js, mai con i numeri decimali di JavaScript.
- Errori API:
  - 422 sotto i campi del form;
  - 401 riporta al login;
  - 403 mostra un messaggio senza cambiare pagina;
  - 404 apre la pagina "non trovato o non accessibile".
- Dipendenze a versione esatta (`.npmrc`) e uscite da almeno 7 giorni, come fa Dependabot. Per aggiungerne una: `npm install <pacchetto>@<versione>`, scegliendo una versione con almeno 7 giorni. Per rigenerare il lockfile: `npm install --before=<data di 7 giorni fa>`.
- Componenti shadcn/ui: `npx shadcn add <nome>`, che usa la versione della CLI fissata nel progetto. Si aggiungono solo quando servono, e dopo si lancia `npm run format`.
- `main` è protetto: si lavora solo con branch corti e pull request, con merge "squash". Il titolo della PR segue i Conventional Commits (`feat:`, `fix:`, `docs:`…) e lo controlla la CI.

## Trappole
- **Il repository è pubblico.** Non vanno committati template ThemeForest, segreti, nomi di sistemi o di progetti interni.
- `import.meta.env` finisce nel browser: è pubblico.
- `.claude/commands/` e `.claude/standards/` sono installati in locale e non versionati. Non vanno aggiunti a git.
- La cartella `interno/` è un altro repository, privato, ignorato da questo. Il suo contenuto non va mai copiato qui.

## Vincoli non negoziabili
- Valgono gli standard del team in `.claude/standards/`, in particolare `security.md` ed `engineering.md`. Per questo profilo contano soprattutto le famiglie A (autorizzazione), B (confini di fiducia), C (identità e sessione) ed E (file).
- La sessione è un cookie HttpOnly: mai token in `localStorage`.
- Mai `dangerouslySetInnerHTML` su contenuti scritti dagli utenti.
- I permessi nell'interfaccia sono solo una comodità: decide il backend.

## Come lavoriamo qui
- Per lavori non banali: prima il piano (`/plan`), poi il codice.
- I test non li scrive la stessa sessione che ha scritto il codice.
- Ogni bug corretto lascia un test che fallirebbe senza il fix.
- Non introdurre dipendenze senza dichiararlo e motivarlo: va aggiunta una riga, con il perché, nella tabella dello stack in `docs/frontend.md`.
- Riporta i fatti come sono: se un test fallisce o un passo è stato saltato, dillo.
