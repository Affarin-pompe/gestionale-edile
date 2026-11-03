# ADR-0001 — Base dell'interfaccia: shadcn/ui, perché il repository è pubblico

**Data:** 2026-11-02, aggiornata il 2026-11-03 con l'opzione C · **Stato:** accettata
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

### C — shadcn/ui con ReUI e l'aspetto di Metronic, con repository pubblico
Aggiunta il 2026-11-03: nel primo confronto mancava.

[ReUI](https://github.com/keenthemes/reui) è una raccolta di componenti per shadcn/ui degli stessi autori di Metronic, con licenza **MIT**. Si installa con la CLI di shadcn/ui (registry `@reui`) e ha lo stile di Metronic.
- Pro: tutti i vantaggi di B, più l'aspetto di Metronic, che era quello cercato fin dall'inizio. I componenti ReUI sono codice MIT e possono stare nel repository pubblico.
- Contro: ReUI non contiene le pagine di Metronic. Misure, colori e disposizione si prendono guardando la demo pubblica di Metronic e si rifanno con il nostro codice. Il codice, il CSS, le icone e le immagini di Metronic restano esclusi.

## Decisione
**B, con l'aspetto di Metronic ottenuto come in C.** Il repository pubblico è un requisito, e A non è compatibile con esso.

In pratica:
- Il tema di `src/index.css` riprende i valori della demo di Metronic: blu come colore principale, grigi "zinc", angoli di 0.5rem, carattere di sistema, controlli alti 34px con testo a 13px.
- Dai componenti di ReUI si prendono quelli che servono, uno alla volta (per esempio `badge`). Finiscono in `src/components/reui/`.
- Le misure di menu, intestazione, card e tabelle si rifanno nei componenti di shadcn/ui già presenti.
- La Data Grid di ReUI non si usa per ora: circa 11.500 righe e sei o sette dipendenze, per funzioni che gli elenchi non chiedono. Si rivaluta per la prima pagina che ne ha davvero bisogno (per esempio migliaia di righe, colonne fissate o righe da trascinare).

Il vantaggio di A, le pagine pronte, pesa meno di quanto sembri: il gestionale usa cinque tipi di schermata (vedi [frontend.md](../frontend.md)). Andrebbero adattati comunque. Si costruiscono una volta come componenti comuni e poi si riusano.

## Conseguenze accettate
- La fase 0 del frontend è più lunga. Layout, tabella con filtri, form e dashboard si costruiscono da componenti base.
- Il tema (colori, caratteri) e i componenti comuni vanno progettati prima dei moduli.
- Nessuna parte di un template ThemeForest può entrare nel repository: pagine copiate, icone, illustrazioni. Lo stesso vale per qualunque altro materiale con una licenza che ne vieti la pubblicazione.
- Dove Metronic non raggiunge il contrasto minimo (WCAG AA, 4.5:1), si scosta: il blu principale è blue-600 e non blue-500, perché il testo bianco sui pulsanti resti leggibile.

## Quando riaprire
- Se il repository diventa privato: un template come Metronic torna un'opzione, e conviene se la fase 0 si allunga troppo.
- Se shadcn/ui smette di essere mantenuto o cambia licenza.
