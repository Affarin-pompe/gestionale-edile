## Perché
<!-- Il problema, non la soluzione. Chi ne soffriva e come. -->

## Cosa cambia
<!-- 3-5 righe. Il dettaglio si legge dal diff. -->

## Come si verifica
<!-- Passi concreti e riproducibili, non "ho provato e funziona". -->

## Sicurezza
<!-- "nessun impatto" oppure le famiglie toccate dello standard di sicurezza.
     Dichiararle quando la PR tocca: autenticazione, permessi, chiamate alle API,
     caricamento di file, contenuti scritti dagli utenti, dipendenze nuove. -->
nessun impatto

---

- [ ] Controlli automatici verdi
- [ ] Test presenti dove servono; se corregge un bug, c'è il test che fallirebbe senza il fix
- [ ] Casi di errore gestiti, non solo il percorso felice
- [ ] Nessun segreto, né nome di sistemi interni, né codice con licenza che ne vieti la pubblicazione
- [ ] README aggiornato se cambiano setup, variabili d'ambiente o comandi
- [ ] Lo scope è quello della issue, non è cresciuto per strada
