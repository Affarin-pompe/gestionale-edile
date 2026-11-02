# ADR-0001 — Base dell'interfaccia: shadcn/ui, perché il repository è pubblico

**Data:** 2026-11-02 · **Stato:** accettata
**Decisori:** team del gestionale

## Contesto
Il gestionale ha molte schermate da ufficio (elenchi, schede, form, dashboard) e alcune da telefono (il rapportino). Partire da un template già pronto fa risparmiare settimane. Il primo candidato era **Metronic React**, un template ThemeForest con la stessa base tecnica scelta per il frontend: React 19, TypeScript, Vite, Tailwind 4.

Il codice del gestionale va in un **repository pubblico**. La licenza dei template ThemeForest (Envato) vieta di rendere disponibili ad altri i file sorgente del template. Il sito online va bene; il sorgente in un repository pubblico no. Il divieto vale per qualunque template ThemeForest, non solo per Metronic.

## Opzioni valutate

### A — Metronic React, con repository privato
- Pro: molte pagine già fatte (elenchi, profili, impostazioni, dashboard); layout e menu pronti.
- Contro: il repository non può essere pubblico. Il codice del template va aggiornato seguendo le sue versioni. La licenza costa, e cambia se gli utenti finali pagano. L'autenticazione di esempio (Supabase) va tolta.

### B — shadcn/ui, con repository pubblico
- Pro: licenza MIT, quindi il codice può essere pubblico. I componenti vengono copiati nel progetto e si modificano senza dipendere da un fornitore. Nessun costo. Stessa base tecnica di Metronic React (Radix e Tailwind 4). TanStack Table e React Hook Form, già scelti, sono quelli che usa.
- Contro: meno pagine pronte. Layout e schermate si costruiscono partendo dai blocchi di shadcn/ui, e l'aspetto grafico va curato da noi.

## Decisione
**B.** Il repository pubblico è un requisito, e A non è compatibile con esso.

Il vantaggio di A, le pagine pronte, pesa meno di quanto sembri: il gestionale usa cinque tipi di schermata (vedi [frontend.md](../frontend.md)). Andrebbero adattati comunque. Si costruiscono una volta come componenti comuni e poi si riusano.

## Conseguenze accettate
- La fase 0 del frontend è più lunga. Layout, tabella con filtri, form e dashboard si costruiscono da componenti base.
- Il tema (colori, caratteri) e i componenti comuni vanno progettati prima dei moduli.
- Nessuna parte di un template ThemeForest può entrare nel repository: pagine copiate, icone, illustrazioni. Lo stesso vale per qualunque altro materiale con una licenza che ne vieti la pubblicazione.

## Quando riaprire
- Se il repository diventa privato: un template come Metronic torna un'opzione, e conviene se la fase 0 si allunga troppo.
- Se shadcn/ui smette di essere mantenuto o cambia licenza.
