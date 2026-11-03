# Gestionale edile — struttura del frontend

Bozza del 2 novembre 2026. Il backend è sviluppato a parte: questo documento copre solo l'interfaccia e il **contratto con il backend**, che va concordato con il team backend. Le voci **[da concordare]** aspettano quella discussione; le voci **[da verificare]** vanno controllate quando si crea il progetto.

## Base dell'interfaccia

Il repository è pubblico, quindi la base è **shadcn/ui** (licenza MIT): componenti React costruiti su Radix e Tailwind, che la CLI copia dentro il progetto. I template ThemeForest sono esclusi perché la loro licenza vieta di pubblicarne il codice sorgente. Il confronto è in [ADR-0001](adr/0001-template-ui-e-repository-pubblico.md).

L'aspetto è quello di **Metronic**. Lo danno i componenti di **ReUI** (MIT, stessi autori, installati con la CLI di shadcn/ui dal registry `@reui`) e un tema che riprende i valori della demo pubblica di Metronic:
- blu come colore principale e grigi "zinc";
- angoli di 0.5rem e il carattere di sistema;
- pulsanti e campi alti 34px, con testo a 13px (`text-2sm`);
- menu laterale bianco largo 280px;
- intestazione alta 70px (60px su telefono), con le briciole di pane.

Di Metronic non si copia nulla: né codice, né CSS, né icone, né immagini.

Il frontend è un'app separata che parla con il backend solo via API ([ADR-0002](adr/0002-frontend-separato-via-api.md)). Il sito vetrina è un progetto a parte e non condivide codice con il gestionale.

## Stack del frontend

Ogni libreria ha il suo motivo nella colonna "Perché". Se il motivo cade, la libreria si toglie.

| Ruolo | Libreria | Perché |
|---|---|---|
| Base | **Vite + React 19 + TypeScript** | App separata dal backend, servita come file statici |
| Componenti | **shadcn/ui** (Radix + Tailwind 4), stile "nova" | Il codice sta nel progetto e ha licenza MIT: si modifica liberamente e può stare in un repository pubblico. Lo stile "nova" è la variante compatta, adatta a tabelle e form fitti |
| Aspetto di Metronic | **ReUI**, registry `@reui` della CLI di shadcn/ui | Stessi autori di Metronic, licenza MIT: dà quell'aspetto senza il codice di Metronic. Si prendono solo i componenti che servono (per ora `badge`); nessuna dipendenza npm in più |
| Supporto ai componenti | radix-ui, class-variance-authority, cn, tw-animate-css | Quelli che shadcn/ui richiede: componenti accessibili, varianti, unione delle classi, animazioni |
| Carattere | Quello di sistema (`ui-sans-serif, system-ui`) | È quello della demo di Metronic. Nessun file da scaricare e nessun Google Fonts, quindi la CSP può restare limitata al proprio dominio |
| Routing | **React Router 8**, modalità "data" (senza il framework) | Route annidate: layout, azienda nell'URL, schede del cantiere. I controlli di accesso e di azienda girano prima che la pagina si apra. La 8 è la versione attuale; il piano iniziale diceva 7 |
| Dati dal server | **TanStack Query** | Cache, stati di caricamento, aggiornamento dopo le modifiche |
| Tabelle | **TanStack Table 9** | Paginazione, ordinamento e filtri lato server. È anche la base della tabella di shadcn/ui. La 9 ha un'API diversa dalla 8, usata negli esempi di shadcn/ui |
| Form | **React Hook Form + Zod**, collegati da @hookform/resolvers | Validazione immediata; gli errori del server finiscono sui campi. Sono gli stessi dei form di shadcn/ui. @hookform/resolvers è alla 5: la 6 va in conflitto con una dipendenza opzionale già presente |
| Client API | **openapi-typescript + openapi-fetch** | Tipi generati dal contratto con il backend: se il backend cambia un campo, il frontend non compila finché non si allinea |
| Sviluppo senza backend | **MSW** (Mock Service Worker) | Risposte finte basate sul contratto, così frontend e backend procedono in parallelo. Le stesse risposte servono ai test. Il plugin per Vite serve il worker solo in sviluppo |
| Traduzioni | react-intl | Solo italiano per ora, ma nessun testo scritto direttamente nei componenti |
| Date | date-fns con locale `it` | Calcoli sulle scadenze (giorni mancanti, rinnovi), che `Intl` non fa |
| Calcoli in anteprima | big.js | Solo per le anteprime nei form; i totali ufficiali arrivano dal backend |
| Grafici | Recharts, tramite i componenti Chart di shadcn/ui | Dashboard: costi, avanzamento dei cantieri |
| Icone e avvisi | lucide-react, sonner | Quelli previsti da shadcn/ui. Il componente degli avvisi è senza next-themes, perché l'app non cambia tema |
| Mappe | react-leaflet + OpenStreetMap | Posizione dei cantieri |
| Gantt (fase 2) | SVAR React Gantt | Open source |
| App installabile | vite-plugin-pwa | Icona sul telefono per i capi cantiere |
| Test | Vitest + Testing Library (con jsdom), Playwright | Vedi la sezione Test. jsdom simula il browser per i test delle pagine |

**Punto di partenza:** il progetto si crea con Vite e la CLI di shadcn/ui; i componenti si aggiungono uno alla volta, quando servono. I blocchi già pronti di shadcn/ui (barra laterale, pagina di accesso, dashboard) sono la base dei layout **[da verificare: quali blocchi]**. Il tema (colori, caratteri, angoli) sta in un solo file CSS con le variabili di shadcn/ui, più i colori aggiuntivi di ReUI (`info`, `success`, `warning`, `invert`): i colori dell'azienda si cambiano lì.

## Layout

| Uso | Layout | Da dove si parte |
|---|---|---|
| Tutta l'applicazione | **AppLayout**: barra laterale a sinistra con azienda attiva e utente (si riduce a icone, su telefono diventa un menu a scomparsa) + intestazione con le briciole di pane. Adatto a molti moduli | Blocco Sidebar di shadcn/ui |
| Accesso, password dimenticata, inviti | **AuthLayout**: con logo e colori dell'azienda | Blocco Login di shadcn/ui |
| Pagine di errore (404, 500) | **ErrorLayout** | Da costruire: una pagina semplice |

I layout sono route padre di React Router: le pagine dei moduli si inseriscono come route figlie.

Le briciole di pane seguono le route: ogni route che è un passo del percorso dichiara `handle: { crumb }` (`RouteHandle`, in `src/app/route-handle.ts`). `crumb` è un id di `src/i18n/it.ts`, oppure un componente quando il nome viene dai dati, come il nome del cliente. Per questo le route di un modulo sono annidate come il percorso: elenco › scheda › modifica. Anche sulle pagine di errore le briciole seguono l'indirizzo; un indirizzo che non esiste finisce con "Non trovato". Su telefono le briciole non ci sono e `PageHeader` mostra il link indietro.

### Accesso e sessione
- Prima di ogni pagina protetta un middleware carica `/api/me`. Senza sessione si va su `/accedi?da=<pagina>`, e dopo l'accesso si torna lì. Il parametro `da` è accettato solo se punta a una pagina dell'app, mai a un altro sito.
- Se l'utente non fa parte dell'azienda nell'URL vede la pagina "non trovato o non accessibile", come per i dati di un'altra azienda. Anche un indirizzo sbagliato richiede prima l'accesso, così non rivela nulla a chi non è collegato.
- Un `401` arrivato a pagina aperta riporta all'accesso.
- Entrando nelle pagine di accesso si svuota la cache delle risposte: dopo l'uscita, nemmeno il tasto "indietro" mostra i dati dell'utente precedente.

## Mappa delle schermate

L'azienda è sempre nell'URL, così un utente che lavora per più aziende può aprirle in schede diverse. Gli URL sono in italiano; il codice è in inglese.

```
/accedi  /password-dimenticata  /invito/:token          AuthLayout
/profilo                                                 dati personali, password
/:azienda/                                               Dashboard

/:azienda/cantieri                                       elenco
/:azienda/cantieri/nuovo
/:azienda/cantieri/:id                                   dettaglio a schede:
    /panoramica  /rapportini  /documenti  /costi  /foto  /squadra
    (fase 2)  /computo  /cronoprogramma  /sal

/:azienda/rapportini                                     elenco con filtri (cantiere, data, stato)
/:azienda/rapportini/oggi                                versione per telefono
/:azienda/rapportini/:id

/:azienda/scadenze                                       elenco + calendario
/:azienda/costi

/:azienda/anagrafiche/clienti          /:id
/:azienda/anagrafiche/fornitori        /:id              include i subappaltatori
/:azienda/anagrafiche/dipendenti       /:id
/:azienda/anagrafiche/mezzi            /:id

/:azienda/impostazioni/azienda                           dati fiscali, logo, numerazioni
/:azienda/impostazioni/utenti                            inviti, ruolo per utente
/:azienda/impostazioni/ruoli                             permessi per ruolo

(fase 2)  /:azienda/preventivi  /:azienda/prezzari
(fase 3)  /:azienda/acquisti  /:azienda/magazzino  /:azienda/fatture
```

### Menu laterale
```
Dashboard
Cantieri
Rapportini
Scadenze
Costi
Anagrafiche ▸ Clienti · Fornitori e subappaltatori · Dipendenti · Mezzi
Impostazioni                (solo titolare)
```
Le voci compaiono solo se l'utente ha il permesso. Il menu è un unico elenco in `src/app/menu.ts` (voce, icona, percorso, permesso richiesto): un modulo nuovo è una riga in più.

## Cinque schermate tipo

Tutte le pagine del gestionale sono una di queste cinque. Si costruiscono una volta come componenti comuni e poi si riusano.

| Tipo | Contenuto | Esempi | Da dove si parte **[da verificare]** |
|---|---|---|---|
| **A. Elenco** | Titolo e pulsante "Nuovo"; barra filtri (ricerca, stato, date) salvata nell'URL; tabella con paginazione lato server; azioni per riga; esportazione. Su telefono le righe diventano schede | Cantieri, anagrafiche, costi, scadenze | Esempio "Tasks" e guida "Data Table" di shadcn/ui |
| **B. Dettaglio a schede** | Intestazione con dati chiave, stato e azioni; ogni scheda è un URL proprio, così si può linkare | Cantiere, dipendente, mezzo | Componenti Tabs e Card |
| **C. Form** | Pannello laterale per entità brevi (es. mezzo); pagina intera per quelle lunghe (es. cantiere); procedura a passi per i preventivi (fase 2) | Tutti i "Nuovo" e "Modifica" | Componenti Sheet e Form |
| **D. Dashboard** | Indicatori, grafici, elenchi "in scadenza" e "cantieri sopra budget" | Dashboard azienda, panoramica cantiere | Blocco Dashboard e componenti Chart |
| **E. Telefono** | Una colonna, campi grandi, foto dalla fotocamera, bozza salvata in automatico | Rapportino di oggi | Nessuno: da progettare |

### Elenchi

Il primo esempio è l'elenco Clienti (`src/features/clients/`).

- **Stato nell'URL.** Pagina, righe per pagina, ordinamento, ricerca e filtri stanno nell'indirizzo (`?pagina=2&per_pagina=50&ordine=-created_at&cerca=rossi&tipo=company`), così un elenco filtrato si salva nei preferiti e si condivide. Se ne occupa `useListParams`. I valori che il backend rifiuterebbe tornano al predefinito. Cambiare ordinamento, righe per pagina, ricerca o un filtro riporta alla prima pagina. Le righe per pagina sono 10, 25 (predefinito del contratto), 50 o 100.
- **Aspetto.** Come in Metronic, l'elenco sta in una card: nell'intestazione il numero di risultati e i filtri (`filters` di `DataTable`), nel piè "Righe per pagina", l'intervallo mostrato ("1–25 di 60") e le pagine numerate.
- **Lavoro del backend.** `DataTable` mostra una pagina già filtrata, ordinata e paginata dal backend. Una colonna è ordinabile solo se il suo id è un valore di `sort` del contratto.
- **Stati.** `DataTable` gestisce caricamento, elenco vuoto, errore e paginazione. Per l'errore mostra "Riprova"; per il 403 solo il messaggio. Mentre arriva un'altra pagina resta visibile quella di prima, attenuata.
- **Ricerca.** `SearchFilter` applica il testo dopo una breve pausa nella digitazione e non aggiunge una voce alla cronologia per ogni lettera.
- **Telefono.** Ogni riga diventa una scheda (`renderCard`), separata dalle altre da una linea dentro la card dell'elenco. Non c'è ancora un comando per cambiare l'ordinamento.

### Form e schede

Il primo esempio è il cliente: `src/features/clients/` (scheda, nuovo, modifica).

- **Regole in `schemas.ts`.** Lo schema Zod ripete le regole del backend (obbligatori, lunghezze, email), così la maggior parte degli errori si vede prima di salvare. I messaggi dello schema sono id di `src/i18n/it.ts`: il campo li traduce. Il backend controlla di nuovo.
- **`EntityForm`** (`src/components/common/`) gestisce il salvataggio:
  - un 422 mette i messaggi del backend sotto i campi e porta il cursore sul primo;
  - i messaggi per campi che il form non ha, un 403 e ogni altro errore compaiono sopra i pulsanti, senza cambiare pagina e senza perdere quello che si è scritto.
- **Campi.** `TextField` e `SelectField` collegano etichetta, descrizione ed errore per i lettori di schermo. I campi vuoti si inviano come `null`, come chiede il contratto.
- **Aspetto.** Come in Metronic: ogni `FormSection` è una card con il titolo nell'intestazione; dove la card è abbastanza larga l'etichetta sta a sinistra del campo, su telefono sopra. Il form è largo al massimo 620px e i pulsanti stanno in fondo a destra. Nella scheda ogni sezione è una card.
- **Dopo il salvataggio** un avviso (sonner) conferma e si apre la scheda. La scheda prende la risposta del backend, e gli elenchi si ricaricano.
- **Scheda e modifica** caricano il record nel loader della route, prima di aprirsi. Se l'API risponde 404 (record di un'altra azienda o inesistente), compare la pagina "non trovato o non accessibile" dentro il layout. Per questo `routes.ts` del modulo è una funzione che riceve il `queryClient`.
- **Limiti attuali:** si esce da un form con modifiche non salvate senza nessun avviso, e non c'è controllo di modifiche fatte nel frattempo da altri.

## Struttura del codice

```
src/
  app/                  App.tsx (provider di Query e Intl), routes.tsx, pagine di errore, menu.ts
  index.css             tema: colori, caratteri e angoli (variabili di shadcn/ui)
  layouts/              AppLayout, AuthLayout, ErrorLayout
  components/ui/        componenti shadcn/ui, aggiunti con la CLI
  components/reui/      componenti ReUI (aspetto di Metronic), aggiunti con la CLI: npx shadcn add @reui/<nome>
  components/common/    componenti del gestionale costruiti sui precedenti:
                          DataTable, FilterBar, PageHeader, EntityForm, MoneyInput,
                          QuantityInput, StatusBadge, FileUploader, PermissionGate
  features/             un modulo per area, sempre con la stessa forma:
    sites/                api.ts (query e modifiche)  routes.ts  schemas.ts  paths.ts
                          pages/  components/
    daily-reports/
    clients/  suppliers/  employees/  equipment/
    documents/  costs/  dashboard/  settings/
  api/                  schema.d.ts generato dal contratto + client (autenticazione, azienda, errori)
  auth/                 utente collegato (/api/me), accesso e uscita, controlli prima delle pagine, hook dei permessi
  i18n/                 testi in italiano
  lib/                  formattazione di importi, quantità e date
  mocks/                risposte finte per sviluppare senza backend (dati di prova in data.ts)
  test/                 avvio di MSW nei test, client di prova con i cookie
```

Regole:
- Un modulo non importa i file interni di un altro modulo.
- I moduli usano `components/common/` e `components/ui/`, mai Radix o altre librerie di interfaccia direttamente. Così l'aspetto si cambia in un posto solo.
- I file in `components/ui/` sono codice del progetto e si possono modificare, ma la modifica vale per tutta l'app: si fa lì, non con copie nei moduli.

## Contratto con il backend **[da concordare con il team backend]**

È la parte che permette di lavorare in parallelo. Il dettaglio della proposta è in [ADR-0003](adr/0003-contratto-api-e-sessione.md).

- **Un file OpenAPI** (`api/openapi.yaml`) è l'unica fonte: il backend lo implementa, il frontend ne genera i tipi e le risposte finte. Si scrive prima delle schermate, modulo per modulo. I tipi si rigenerano con `npm run api:types` e la CI fallisce se non sono aggiornati. Il primo pezzo copre accesso, `/api/me` e Clienti.
- **Dove vive il file [da concordare]:** per ora in questo repository. Se i repository di frontend e backend sono separati, il contratto sta in uno dei due e l'altro lo prende da lì.
- **Accesso:** cookie di sessione sullo stesso dominio, con protezione CSRF. È più sicuro di un token salvato nel browser, che qualunque script nella pagina potrebbe leggere. Per la CSRF il backend imposta un cookie `XSRF-TOKEN` leggibile dalla pagina, e il frontend lo ricopia nell'header `X-XSRF-TOKEN` delle richieste che modificano dati.
- **Azienda nel percorso:** `/api/companies/{company}/sites`.
- **`GET /api/me`** restituisce l'utente, le sue aziende e, per ognuna, ruolo e permessi. L'interfaccia lo usa per il menu e per nascondere azioni.
- **Elenchi:** `?page=1&per_page=25&sort=-created_at&filter[status]=active&search=...`. La risposta è `{ data: [...], meta: { total, page, per_page } }`.
- **Errori:**
  - `422` con `{ message, errors: { campo: ["messaggio"] } }`: gli errori si mostrano sotto i campi;
  - `401`: si torna al login;
  - `403`: azione non permessa dal ruolo (es. un capo cantiere che prova ad approvare un SAL): messaggio, senza cambiare pagina;
  - `404`: pagina "non trovato o non accessibile". Il backend risponde 404 anche quando il record esiste ma appartiene a un'altra azienda o l'utente non può vederlo, per non confermarne l'esistenza.
- **Numeri e date:** importi e quantità come **stringhe** (`"1234.50"`), mai numeri decimali JSON; date in ISO 8601.
- **File:** il backend restituisce un indirizzo di caricamento diretto (o un endpoint multipart). Il frontend carica il file e poi invia l'id ottenuto.

## Permessi nell'interfaccia

- I permessi vengono da `/api/me`, per l'azienda nell'URL.
- `useCan('clients.create')` dice se il ruolo lo permette. `<PermissionGate permission="…">` nasconde pulsanti e sezioni.
- Le voci del menu con un permesso compaiono solo a chi ce l'ha.
- Una route che richiede un permesso usa `loader: requirePermission('…')`: senza permesso, l'utente vede la pagina "non trovato o non accessibile" dentro il layout. È un loader e non un middleware perché, alla prima apertura della pagina, l'errore di un middleware sostituirebbe tutto il layout.
- L'interfaccia **nasconde**, ma è il backend che **blocca**: ogni controllo va ripetuto lato server.

## Formati

- Importi: `Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })`. Date: `gg/mm/aaaa`.
- Nessun calcolo con numeri decimali JavaScript sugli importi: anteprime con big.js, totali dal backend.

## Telefono e cantiere

- Tutte le pagine funzionano da telefono. Il **Rapportino di oggi** è pensato prima di tutto per il telefono.
- In fase 1 l'app è installabile (PWA) e salva la bozza del rapportino sul telefono mentre la si compila.
- **[da confermare]** Funzionamento completamente senza rete: invio automatico quando torna la connessione. Si aggiunge solo se in cantiere manca davvero la rete.

## Sicurezza nel browser

- **Content-Security-Policy restrittiva** (script solo dal proprio dominio, niente script inline), più `X-Content-Type-Options: nosniff`, `Referrer-Policy` e `frame-ancestors 'none'`. Le imposta il server che ospita i file del frontend **[da concordare: dove si pubblica il frontend]**.
- **Mai `dangerouslySetInnerHTML`** su contenuti scritti dagli utenti (note, descrizioni). Se un giorno servisse testo formattato, si sanifica con una libreria dedicata.
- **Nessun segreto nel codice del frontend:** tutto ciò che passa da `import.meta.env` finisce nel browser ed è pubblico. Le chiavi di servizi esterni restano sul backend.
- **La sessione non si salva nel browser:** niente token in `localStorage`, solo il cookie HttpOnly gestito dal backend.
- I limiti sui file (dimensione, tipo) nel browser servono a dare subito un messaggio chiaro. Il controllo vero lo fa il backend.

## Test

- **Logica, con Vitest:** si testa ciò che, se sbaglia, nessuno nota a occhio. Formattazione e lettura di importi e quantità, anteprime dei calcoli, `useCan` e la visibilità delle azioni, gli errori 422 mostrati sui campi giusti, i filtri salvati nell'URL.
- **Flussi, con Playwright**, contro le risposte finte:
  - accesso e cambio di azienda;
  - creazione di un cantiere;
  - rapportino compilato da telefono (schermo piccolo);
  - errore di validazione dal server;
  - record non accessibile, che deve portare alla pagina 404.
- **Nessuna soglia di copertura.** Ogni bug corretto lascia un test che fallirebbe senza la correzione.
- **I test non li scrive la stessa sessione che ha scritto il codice:** prima si elenca cosa deve essere vero, poi si scrivono i test.
- Che un utente non veda i dati di un'altra azienda è un test **del backend**. Il frontend verifica solo di gestire bene il 404.

## Fasi del frontend

| Fase | Contenuto |
|---|---|
| **0, fondamenta** | Progetto Vite con shadcn/ui, tema, layout dell'app e dell'accesso, autenticazione, menu, routing con l'azienda, client API generato, risposte finte, componenti comuni (tabella, filtri, form, caricamento file) |
| **1, base operativa** | Anagrafiche, cantieri, rapportini (con la versione per telefono), documenti e scadenze, costi, dashboard, impostazioni (azienda, utenti, ruoli) |
| **2, parte tecnica** | Preventivi e computo (tabella ad albero modificabile, sempre con TanStack Table), cronoprogramma Gantt, SAL |
| **3, amministrazione** | Acquisti, magazzino, fatture |
