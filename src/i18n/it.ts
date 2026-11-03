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

// Makes a missing or misspelled id a type error
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- the shape react-intl reads
  namespace FormatjsIntl {
    interface Message {
      ids: MessageId
    }
  }
}
