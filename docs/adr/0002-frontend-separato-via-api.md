# ADR-0002 — Frontend separato, che parla con il backend solo via API

**Data:** 2026-11-02 · **Stato:** accettata
**Decisori:** team del gestionale

## Contesto
Frontend e backend li seguono persone diverse, e il linguaggio del backend non è ancora stato scelto. Si vuole partire subito con l'interfaccia, senza aspettare quella scelta. Il gestionale deve funzionare anche da telefono, in cantiere.

## Opzioni valutate

### A — Interfaccia generata dal backend
Pagine prodotte dal server, o pannello di amministrazione del framework scelto per il backend.
- Pro: un solo progetto da pubblicare. Nessun contratto API da mantenere. Molti framework danno elenchi e form quasi gratis.
- Contro: l'interfaccia si può iniziare solo dopo la scelta del backend, e lo segue in tutto. Chi lavora sul frontend deve lavorare dentro il codice del backend. I pannelli di amministrazione sono rigidi per le schermate su misura, come il rapportino da telefono.

### B — App separata (React) che usa solo le API
- Pro: frontend e backend procedono in parallelo, partendo dal contratto API e dalle risposte finte. Il frontend non dipende dal linguaggio del backend. L'interfaccia è libera, telefono compreso.
- Contro: c'è un contratto da scrivere e tenere aggiornato. Si pubblicano due parti invece di una. Alcune validazioni esistono in due posti: nel browser per dare subito il messaggio, sul server perché lì si decide.

## Decisione
**B.** Il motivo principale è il calendario: con A il frontend aspetterebbe la scelta del backend e poi ne dipenderebbe. Il costo di B, cioè il contratto, serve comunque, perché è anche il modo in cui frontend e backend si accordano su cosa esiste.

## Conseguenze accettate
- Il contratto API diventa un documento vivo. Ogni modifica passa prima dal file OpenAPI (vedi [ADR-0003](0003-contratto-api-e-sessione.md)).
- Frontend e API vanno pubblicati sullo stesso dominio, per usare il cookie di sessione senza CORS.
- L'interfaccia non può essere l'unico controllo: permessi e validazioni si ripetono sul backend.

## Quando riaprire
- Se il backend sceglie un framework con un'interfaccia pronta che copre la gran parte delle schermate, e la stessa persona segue entrambe le parti.
- Se mantenere il contratto rallenta più di quanto faccia guadagnare il lavoro in parallelo.
