# Gestionale edile — frontend

## Cos'è
L'interfaccia web di un gestionale per imprese edili. Copre cantieri, rapportini giornalieri, documenti e scadenze, costi e anagrafiche. È un'app React separata dal backend, con cui parla solo via API.

Il progetto è all'inizio: per ora ci sono la struttura e le decisioni, non ancora il codice.
- Struttura, schermate e contratto con il backend: [docs/frontend.md](docs/frontend.md)
- Decisioni e motivi: [docs/adr/](docs/adr/)

## Avvio in locale
**[da completare con la fase 0]** I comandi previsti:

```bash
npm install
npm run dev
```

Senza backend, l'app usa le risposte finte (MSW) costruite sul contratto API.

## Variabili d'ambiente
Per ora nessuna. Quando ci saranno, l'elenco sarà in `.env.example`.

Tutto ciò che il frontend legge da `import.meta.env` finisce nel browser ed è pubblico: mai segreti.

## Deploy
**[da decidere con il team backend]** Il frontend sono file statici. Vanno pubblicati sullo stesso dominio delle API, perché la sessione è un cookie ([ADR-0003](docs/adr/0003-contratto-api-e-sessione.md)).

## Prima di metterci le mani
- **Il repository è pubblico.** Niente template ThemeForest, né altro materiale con una licenza che ne vieti la pubblicazione ([ADR-0001](docs/adr/0001-template-ui-e-repository-pubblico.md)). Niente segreti, né nomi di sistemi interni.
- **L'interfaccia nasconde, il backend blocca.** Ogni permesso va controllato anche lato server.
- **Importi e quantità arrivano come stringhe.** Non si calcolano con i numeri decimali di JavaScript.
- **Il contratto API si cambia prima nel file OpenAPI**, poi nel codice.
