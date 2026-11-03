# CLAUDE.md — Gestionale edile (frontend)

## Cos'è
Frontend React di un gestionale per imprese edili (cantieri, rapportini, scadenze, costi). Lo usano titolare, ufficio e capi cantiere, questi anche da telefono. Parla con un backend separato solo via API.

## Profilo
`A` — web app con utenti e dati altrui

## Stack
- **Runtime:** Node LTS, solo per sviluppo e build. In produzione sono file statici.
- **Framework:** Vite, React 19, TypeScript, shadcn/ui (Radix + Tailwind 4), React Router 8 (modalità data), TanStack Query e Table, React Hook Form + Zod
- **Backend:** in un altro repository. Il contratto è un file OpenAPI.
- **Deploy:** da decidere; stesso dominio delle API.

## Comandi

```bash
npm install
npm run dev
npm run lint            # ESLint con regole type-aware
npm run format:check    # Prettier (npm run format per correggere); i .md sono esclusi
npm run typecheck
npm run api:types       # rigenera src/api/schema.d.ts da api/openapi.yaml
npm test
npm run build
```

Prima di dichiarare finito un lavoro: lint, formattazione, tipi, test e build devono passare. Sono gli stessi controlli della CI (`.github/workflows/ci.yml`).

## Architettura in 5 righe
- `src/features/<modulo>/`: un modulo per area, sempre con `api.ts`, `routes.ts`, `schemas.ts`, `paths.ts`, `pages/`, `components/`. `routes.ts` contiene solo oggetti di route (`Component: Pagina`, senza JSX): così l'aggiornamento a caldo delle pagine continua a funzionare. Se i loader devono caricare dati, è una funzione che riceve il `queryClient` (esempio: `clientRoutes`). `paths.ts` costruisce gli URL assoluti delle pagine del modulo. Le route sono annidate come le briciole di pane (elenco › scheda › modifica) e ogni passo dichiara `handle: { crumb }` (`RouteHandle`, `src/app/route-handle.ts`).
- `src/components/ui/` contiene i componenti shadcn/ui, `src/components/reui/` quelli di ReUI (l'aspetto di Metronic, ADR-0001); `src/components/common/` quelli del gestionale costruiti sopra.
- `api/openapi.yaml` è il contratto con il backend. `src/api/schema.d.ts` è generato da lì: non si scrive a mano. `src/mocks/` contiene le risposte finte (MSW).
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
  - I controlli prima delle pagine sono middleware di React Router in `src/auth/session.ts`: `requireAuth` (sessione) e `requireCompany` (azienda nell'URL). Le pagine leggono l'utente con `useMe()` e l'azienda con `useCompany()`.
  - Le chiamate passano da `api` (`src/api/client.ts`), che aggiunge il token CSRF e gestisce il 401. `unwrap` trasforma le risposte non 2xx in `ApiError`, e `fieldErrors` estrae i messaggi del 422 per ogni campo (`src/api/errors.ts`).
- Dipendenze a versione esatta (`.npmrc`) e uscite da almeno 7 giorni, come fa Dependabot. Per aggiungerne una: `npm install <pacchetto>@<versione>`, scegliendo una versione con almeno 7 giorni. Per rigenerare il lockfile: `npm install --before=<data di 7 giorni fa>`.
- Il contratto si cambia prima in `api/openapi.yaml`, poi si lancia `npm run api:types` e si committano entrambi. La CI fallisce se i tipi non sono aggiornati.
- Ogni operazione nuova del contratto ha la sua risposta finta in `src/mocks/handlers.ts`, con gli stessi controlli del backend: sessione, CSRF, azienda e permessi. I test girano contro MSW e usano `createTestApi` (`src/test/api.ts`), che gestisce i cookie come un browser. I test delle pagine girano in jsdom (`// @vitest-environment jsdom`) con `setupAppTests` e `renderApp` (`src/test/app.ts`), che montano l'app intera su un router in memoria.
- Componenti shadcn/ui: `npx shadcn add <nome>`, che usa la versione della CLI fissata nel progetto. Si aggiungono solo quando servono, e dopo si lancia `npm run format`. Se la CLI chiede di sovrascrivere un componente già presente, si risponde di no. Gli eventuali testi in inglese dei componenti copiati si spostano in `src/i18n/it.ts` (id `ui.*`). I componenti di ReUI si aggiungono allo stesso modo: `npx shadcn add @reui/<nome>`.
- Le pagine dentro un'azienda sono figlie di `AppLayout` (`src/layouts/`). Il menu laterale è `src/app/menu.ts`: un modulo nuovo è una voce in più, con il permesso che la mostra; finché non è pronto ha `soon: true` e compare come "Presto", senza link. Per i permessi si usano `useCan`, `PermissionGate` e, sulle route, `loader: requirePermission('…')`. Va usato come loader, non come middleware, anche se TypeScript accetterebbe entrambi.
- Gli elenchi usano `useListParams` (`src/hooks/`) e `PageHeader`, `FilterBar`, `DataTable` (`src/components/common/`). Pagina, righe per pagina, ordinamento, ricerca e filtri stanno nell'URL, in italiano (`pagina`, `per_pagina`, `ordine`, `cerca`, un parametro per filtro). `DataTable` è una card: i filtri si passano nella prop `filters` e vanno nella sua intestazione. Ordinamento e paginazione li fa il backend. Una colonna è ordinabile solo se il suo id è un valore di `sort` del contratto; le altre hanno `enableSorting: false`. Esempio completo: `src/features/clients/`.
- I form usano `EntityForm`, `FormSection`, `TextField` e `SelectField` (`src/components/common/EntityForm.tsx`), con lo schema Zod del modulo in `schemas.ts`. I messaggi dello schema sono id di `src/i18n/it.ts`, mai testi. `EntityForm` mette sotto i campi gli errori 422 e mostra sopra i pulsanti il 403 e gli altri errori. Dopo un salvataggio: avviso con `toast` di sonner, poi la scheda. Scheda e modifica caricano il record nel loader, così un 404 dell'API apre la pagina "non trovato".
- `main` è protetto: si lavora solo con branch corti e pull request, con merge "squash". Il titolo della PR segue i Conventional Commits (`feat:`, `fix:`, `docs:`…) e lo controlla la CI.

## Trappole
- **Il repository è pubblico.** Non vanno committati template ThemeForest, segreti, nomi di sistemi o di progetti interni. L'aspetto di Metronic si ottiene con ReUI e con valori presi dalla demo pubblica: mai codice, CSS, icone o immagini di Metronic.
- `import.meta.env` finisce nel browser: è pubblico.
- `.claude/commands/` e `.claude/standards/` sono installati in locale e non versionati. Non vanno aggiunti a git.
- openapi-typescript 7.13 dichiara di supportare solo TypeScript 5. La regola `overrides` in `package.json` gli fa usare il nostro TypeScript 6: va tolta quando esce una versione che lo supporta.
- MSW non deve mai finire nella build di produzione: si carica solo dentro `import.meta.env.DEV`, e la CI controlla che `dist/` non contenga né MSW né i dati finti.
- MSW è alla versione 3: `http` si importa da `msw/http`, e l'opzione per le richieste senza risposta si chiama `onUnhandledFrame` (non più `onUnhandledRequest`). In Node i cookie non restano fra una richiesta e l'altra: li gestisce `createTestApi`. Sotto jsdom MSW non scrive nemmeno in `document.cookie`.
- jsdom non ha `window.matchMedia`, che serve alla barra laterale: `setupAppTests` ne mette una finta. `src/hooks/use-mobile.ts` è riscritto rispetto a quello di shadcn/ui, che non passava il lint di React: non va sovrascritto.
- React Router 8: `RouterProvider` si importa da `react-router/dom`, tutto il resto da `react-router`. Il pacchetto `react-router-dom` non esiste più.
- TanStack Table è alla 9: `useTable` con le funzioni dichiarate in `tableFeatures` (per gli elenchi, `listFeatures` e `listColumnHelper` in `src/components/common/list-table.ts`). Gli esempi della guida "Data Table" di shadcn/ui usano la 8 (`useReactTable`) e non si copiano così come sono. Colonne e funzioni si dichiarano fuori dai componenti, perché restino stabili fra un render e l'altro.
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
