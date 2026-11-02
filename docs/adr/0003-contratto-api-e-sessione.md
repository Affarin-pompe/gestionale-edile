# ADR-0003 — Contratto API e sessione

**Data:** 2026-11-02 · **Stato:** proposta, da concordare con il team backend
**Decisori:** frontend e backend insieme

## Contesto
Frontend e backend lavorano in parallelo ([ADR-0002](0002-frontend-separato-via-api.md)). Serve un'unica fonte che dica quali richieste esistono e cosa rispondono, e un modo sicuro di tenere l'utente collegato. Il gestionale gestisce i dati di più aziende: un utente non deve mai vedere quelli di un'azienda a cui non appartiene.

## Opzioni valutate

### A — Token salvato nel browser (es. JWT in `localStorage`), inviato in un header
- Pro: semplice da provare. Funziona anche con un'eventuale app nativa. Le API possono stare su qualunque dominio.
- Contro: qualunque script finito nella pagina legge il token, e una falla XSS diventa furto della sessione. Revocare un accesso prima della scadenza è complicato. Serve CORS.

### B — Cookie di sessione HttpOnly, frontend e API sullo stesso dominio, con protezione CSRF
- Pro: gli script nella pagina non vedono la sessione. Uscita e revoca si fanno sul server. Niente CORS.
- Contro: frontend e API devono stare sullo stesso sito. Il frontend deve gestire il passaggio CSRF. Un'app nativa, se mai servirà, avrà bisogno di un altro meccanismo.

## Decisione proposta
**B.** A è scartata perché lega la sicurezza della sessione all'assenza totale di falle XSS: basta una libreria compromessa o un campo non sanificato. B è anche ciò che chiede lo standard di sicurezza del team per le web app.

Insieme alla sessione si propongono queste regole del contratto:
- **Un file OpenAPI** è l'unica fonte. Si scrive prima delle schermate, modulo per modulo. Il backend lo implementa; il frontend ne genera tipi e risposte finte.
- **Protezione CSRF:** con `GET /api/auth/csrf` il backend imposta un cookie `XSRF-TOKEN` leggibile dalla pagina. Il frontend lo ricopia nell'header `X-XSRF-TOKEN` di ogni richiesta che modifica dati. Il backend verifica il token contro la sessione: non basta che header e cookie coincidano, perché un cookie si può falsificare da un sottodominio. Il cookie di sessione resta HttpOnly. È lo schema "double submit" che molti framework backend offrono già: i nomi di cookie e header si adattano a quello scelto.
- **Accesso:** dopo l'accesso la sessione si rigenera. Con credenziali sbagliate la risposta è `422` con un messaggio generico, senza rivelare se l'email esiste. Con troppi tentativi è `429` con `Retry-After`.
- **Azienda nel percorso:** `/api/companies/{company}/...`. Il backend verifica a ogni richiesta che l'utente appartenga a quell'azienda.
- **`GET /api/me`:** utente, aziende e, per ognuna, ruolo e permessi.
- **Elenchi:** `page`, `per_page`, `sort`, `filter[...]`, `search`. La risposta è `{ data, meta: { total, page, per_page } }`.
- **Errori:**
  - `422` con `{ message, errors: { campo: [...] } }`;
  - `401`, sessione assente;
  - `403`, azione non permessa dal ruolo;
  - `404` anche per i record di altre aziende, per non confermarne l'esistenza.
- **Importi e quantità come stringhe**, date in ISO 8601.
- **File:** caricamento tramite indirizzo firmato a scadenza breve. Il frontend invia poi l'id ottenuto.

**Dove vive il file [da concordare]:** per ora è `api/openapi.yaml` in questo repository, con il primo pezzo (accesso, `/api/me`, Clienti). Spostarlo costa poco.

## Conseguenze accettate
- La pubblicazione è vincolata: frontend e API devono stare sullo stesso sito.
- Ogni cambio di API passa prima dal file OpenAPI. Una modifica fatta solo nel codice del backend rompe la compilazione del frontend, ed è voluto.
- Per un'app nativa si dovrà aggiungere un meccanismo di accesso diverso.

## Quando riaprire
- Se serve un'app nativa o un accesso da sistemi esterni.
- Se frontend e API devono stare su domini diversi.
- Se il framework scelto per il backend offre un meccanismo diverso con le stesse garanzie: sessione invisibile agli script e revocabile dal server.
