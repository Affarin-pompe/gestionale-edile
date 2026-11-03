// Every text the interface shows. Components refer to them by id, never by the text itself.
export const messages = {
  'app.name': 'Gestionale edile',
  'app.loading': 'Caricamento…',

  'login.title': 'Accedi',
  'login.description': 'Inserisci email e password del tuo account.',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.submit': 'Accedi',
  'login.submitting': 'Accesso in corso…',
  'login.tooManyAttempts': 'Troppi tentativi. Aspetta qualche minuto e riprova.',
  'login.failed': 'Accesso non riuscito. Ricarica la pagina e riprova.',
  'logout.submit': 'Esci',

  'menu.dashboard': 'Dashboard',
  'menu.registry': 'Anagrafiche',
  'menu.clients': 'Clienti',
  'layout.companies': 'Le tue aziende',

  'ui.close': 'Chiudi',
  'ui.sidebar.title': 'Menu',
  'ui.sidebar.description': 'Le sezioni del gestionale.',
  'ui.sidebar.toggle': 'Apri o chiudi il menu',

  'list.results': '{total, plural, one {# risultato} other {# risultati}}',
  'list.page': 'pagina {page} di {pages}',
  'list.pagination': "Pagine dell'elenco",
  'list.previous': 'Precedente',
  'list.next': 'Successiva',
  'list.noResults': 'Nessun risultato con questi filtri.',
  'list.loadFailed': "Non è stato possibile caricare l'elenco.",
  'list.retry': 'Riprova',
  'list.all': 'Tutti',

  'clients.title': 'Clienti',
  'clients.empty': 'Non ci sono ancora clienti.',
  'clients.search': 'Cerca per nome, P.IVA, C.F. o città',
  'clients.kind': 'Tipo',
  'clients.kind.company': 'Impresa',
  'clients.kind.person': 'Privato',
  'clients.name': 'Nome',
  'clients.taxId': 'P.IVA o C.F.',
  'clients.city': 'Città',
  'clients.createdAt': 'Aggiunto il',
  'clients.new': 'Nuovo cliente',
  'clients.edit': 'Modifica',
  'clients.editTitle': 'Modifica cliente',
  'clients.created': 'Cliente aggiunto.',
  'clients.updated': 'Modifiche salvate.',
  'clients.section.main': 'Cliente',
  'clients.section.tax': 'Dati fiscali',
  'clients.section.contacts': 'Contatti',
  'clients.section.address': 'Indirizzo',
  'clients.name.hint': 'Ragione sociale, oppure nome e cognome.',
  'clients.vatNumber': 'Partita IVA',
  'clients.taxCode': 'Codice fiscale',
  'clients.sdiCode': 'Codice destinatario SDI',
  'clients.email': 'Email',
  'clients.pec': 'PEC',
  'clients.phone': 'Telefono',
  'clients.street': 'Via e numero civico',
  'clients.postalCode': 'CAP',
  'clients.province': 'Provincia',
  'clients.province.hint': 'La sigla, ad esempio TO.',
  'clients.notes': 'Note',
  'clients.vatRequired': 'La partita IVA è obbligatoria per le imprese.',
  'clients.taxCodeRequired': 'Il codice fiscale è obbligatorio per i privati.',

  'form.requiredNote': 'I campi con * sono obbligatori.',
  'form.save': 'Salva',
  'form.saving': 'Salvataggio…',
  'form.cancel': 'Annulla',
  'form.invalid': 'Controlla i dati inseriti.',
  'form.forbidden': 'Il tuo ruolo non permette questa modifica.',
  'form.failed': 'Non è stato possibile salvare. Riprova.',
  'validation.required': 'Campo obbligatorio.',
  'validation.email': 'Indirizzo email non valido.',
  'validation.tooLong': 'Testo troppo lungo.',
  'detail.empty': 'Non indicato',

  'home.greeting': 'Ciao, {name}',
  'home.membership': '{company}, come {role}',

  'noCompany.title': 'Nessuna azienda',
  'noCompany.text':
    'Il tuo account non è ancora collegato a nessuna azienda. Chiedi al titolare di invitarti.',

  'error.notFound.title': 'Pagina non trovata o non accessibile',
  'error.notFound.text': 'La pagina non esiste, oppure non hai il permesso di vederla.',
  'error.forbidden.title': 'Azione non permessa',
  'error.forbidden.text': 'Il tuo ruolo non permette di vedere questa pagina.',
  'error.generic.title': 'Qualcosa è andato storto',
  'error.generic.text':
    'Riprova tra poco. Se il problema continua, avvisa chi gestisce il gestionale.',
  'error.reload': 'Ricarica la pagina',
  'error.home': "Torna all'inizio",
} as const

export type MessageId = keyof typeof messages

/** For texts that may be an id (validation messages) or a text from the server (422 errors). */
export function isMessageId(value: string): value is MessageId {
  return Object.hasOwn(messages, value)
}

// Makes a missing or misspelled id a type error
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- the shape react-intl reads
  namespace FormatjsIntl {
    interface Message {
      ids: MessageId
    }
  }
}
