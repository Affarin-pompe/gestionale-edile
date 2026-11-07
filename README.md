# Gestionale edile — frontend

## Cos'è
L'interfaccia web di un gestionale per imprese edili. Copre cantieri, rapportini giornalieri, documenti e scadenze, costi e anagrafiche. È un'app React separata dal backend, con cui parla solo via API.

Il progetto è nella fase 0, le fondamenta: per ora c'è lo scheletro dell'app, non ancora le schermate.
- Struttura, schermate e contratto con il backend: [docs/frontend.md](docs/frontend.md)
- Decisioni e motivi: [docs/adr/](docs/adr/)

## Avvio in locale
Serve Node 24 (la versione è in `.nvmrc`).

```bash
npm install
npm run dev
```

Gli altri comandi:

| Comando | Cosa fa |
|---|---|
| `npm run lint` | ESLint, con le regole che usano i tipi |
| `npm run format` | Formatta il codice con Prettier (`format:check` controlla soltanto) |
| `npm run typecheck` | Controllo dei tipi TypeScript |
| `npm test` | Test con Vitest (`test:watch` li rilancia a ogni modifica) |
| `npm run build` | Build di produzione in `dist/` |
| `npm run api:types` | Rigenera i tipi TypeScript dal contratto `api/openapi.yaml` |

Gli stessi controlli girano su GitHub a ogni pull request. Il titolo della PR deve seguire i Conventional Commits (es. `feat(clienti): elenco con filtri`), perché diventa il commit su `main`.

In sviluppo le API sono simulate con MSW (`src/mocks/`), quindi il backend non serve. Per entrare si usa uno degli utenti di prova: email e password sono in `src/mocks/data.ts`. A ogni ricaricamento della pagina i dati tornano quelli iniziali; la sessione invece resta.

Per provare l'app contro il backend vero (repository `gestionale-edile-backend`, avviato su `http://127.0.0.1:3100` con i dati di sviluppo), senza mock: `npm run preview:backend`, poi http://localhost:5190. Si entra con gli utenti dei dati di sviluppo del backend. Se il browser ha ancora il cookie `session` dei mock, va cancellato: i cookie di `localhost` valgono per tutte le porte.

## Variabili d'ambiente
Per ora nessuna. L'elenco è in `.env.example`.

Tutto ciò che il frontend legge da `import.meta.env` finisce nel browser ed è pubblico: mai segreti.

## Deploy
**[da decidere con il team backend]** Il frontend sono file statici. Vanno pubblicati sullo stesso dominio delle API, perché la sessione è un cookie ([ADR-0003](docs/adr/0003-contratto-api-e-sessione.md)).

## Prima di metterci le mani
- **Il repository è pubblico.** Niente template ThemeForest, né altro materiale con una licenza che ne vieti la pubblicazione ([ADR-0001](docs/adr/0001-template-ui-e-repository-pubblico.md)). Niente segreti, né nomi di sistemi interni.
- **L'interfaccia nasconde, il backend blocca.** Ogni permesso va controllato anche lato server.
- **Importi e quantità arrivano come stringhe.** Non si calcolano con i numeri decimali di JavaScript.
- **Il contratto API si cambia prima nel file OpenAPI** (`api/openapi.yaml`), poi nel codice.
