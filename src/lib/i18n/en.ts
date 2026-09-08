import type { Dictionary } from './es'

/**
 * Diccionario inglés, tipado contra el español: si falta una clave, no
 * compila. Los nombres propios de los juegos no se traducen.
 */
export const en: Dictionary = {
  nav: {
    hoy: 'Hoy',
    juegos: 'Juegos',
    semanales: 'Semanales',
    cuenta: 'Cuenta',
    ajustes: 'Ajustes',
    aria: 'Navegación principal',
  },

  landing: {
    headlineBefore: 'It ends',
    headlineAfter: "and you didn't know.",
    intro:
      'GachaEvent gathers the limited-time events of Honkai: Star Rail, Wuthering Waves, Zenless Zone Zero and Arknights: Endfield into a single list, sorted by whatever expires first.',
    feature1Term: 'One list, not four',
    feature1Detail:
      'Events from all four games, sorted by urgency rather than by franchise.',
    feature2Term: 'Endgame checklist',
    feature2Detail:
      'Tick off what you have already farmed. It saves to your account and follows you across devices.',
    feature3Term: 'It updates itself',
    feature3Detail: 'A scraper reads the wikis every morning. You maintain nothing.',
    createAccount: 'Create account',
    browseAnonymously: 'Browse without an account',
  },

  hoy: {
    title: 'Today',
    endsToday: 'Ends today',
    nothingSoon: 'Nothing expires in the next 12 hours.',
    thisWeek: 'This week',
    later: 'Later',
    upcoming: 'Coming up',
    upcomingNote: 'Announced but not live yet.',
    activeEvent: 'active event',
    activeEvents: 'active events',
    emptyTitle: 'No active events',
    emptyBody:
      'The scrapers run every morning. In the meantime you can get ahead on the endgame checklist.',
    seeGames: 'See games',
  },

  juegos: {
    title: 'Games',
    tracked: 'tracked',
    noActiveEvents: 'no active events',
    // En inglés no cambia con el número; se repite para no partir el tipo.
    upcomingCountOne: '{n} coming up',
    upcomingCount: '{n} coming up',
    nextClosing: 'Next closing',
  },

  game: {
    notFound: 'Game not found',
    metaDescription: 'Active events and endgame checklist for {game}.',
    eventsHeading: 'Events',
    upcomingHeading: 'Coming up',
    upcomingNote: 'Announced but not live yet.',
    activeOne: 'active',
    activeMany: 'active',
    noEvents: 'No active events right now. The scraper checks the wiki every morning.',
    checklistEmpty: 'There are no endgame tasks for this game yet.',
    signInLink: 'Sign in',
    signInRest: 'to save your progress across sessions.',
    checklistHeading: 'Endgame',
    progressAria: 'Endgame progress',
    saveFailed: 'Could not save',
    categories: {
      other: 'routine',
      character: 'character',
      weapon: 'weapon',
      artifact: 'artifact',
      story: 'story',
      achievement: 'challenge',
    },
    // In-game segment sub-nav (events | banners)
    eventsTab: 'Events',
    bannersTab: 'Banners',
    bannersTitle: 'Banners',
    bannersNote: 'Current and upcoming gacha banners.',
    noBanners: 'No active banners right now.',
    weeklyHeading: 'Weekly',
  },

  // Games on pause (game-status.ts): placeholder with the game's identity.
  paused: {
    comingSoon: 'Coming soon',
    note: 'Event tracking for this game is not available yet.',
  },

  event: {
    andMore: 'and {n} more',
  },

  cuenta: {
    title: 'Account',
    email: 'Email',
    tasksDone: 'Tasks completed',
    createdAt: 'Account created',
    signOut: 'Sign out',
    signingOut: 'Signing out…',
    signOutFailed: 'Could not sign out',
    signedOutTitle: 'You are not signed in',
    signedOutBody:
      'Your endgame progress is saved to your account and follows you across devices.',
    signIn: 'Sign in',
  },

  auth: {
    loginTitle: 'Sign in',
    loginSubtitle: 'Your endgame progress is waiting for you.',
    registerTitle: 'Create account',
    registerSubtitle: 'So what you tick off is still there tomorrow.',
    email: 'Email',
    password: 'Password',
    passwordMismatch: 'The passwords do not match',
    accountCreatedConfirm: 'Account created. Confirm your email to sign in.',
    accountCreated: 'Account created',
    badCredentials: 'Wrong email or password.',
    googleFailed: 'Could not open Google sign-in',
    emailPlaceholder: 'you@email.com',
    passwordPlaceholder: 'At least 6 characters',
    confirmPassword: 'Repeat the password',
    submitting: 'One moment…',
    submitRegister: 'Create account',
    submitLogin: 'Sign in',
    or: 'or',
    google: 'Continue with Google',
    haveAccount: 'Already have an account? ',
    noAccount: "Don't have an account yet? ",
    goSignIn: 'Sign in',
    goRegister: 'Create one',
  },

  ajustes: {
    title: 'Settings',
    languageLabel: 'Language',
    languageHelp: 'Changes the interface language and the event descriptions.',
    spanish: 'Español',
    english: 'English',
  },

  error: {
    eyebrow: 'Error',
    title: 'Something broke while loading',
    body: 'We could not prepare this screen. Try again; if it keeps happening, it is on us.',
    ref: 'ref',
    retry: 'Retry',
    backHome: 'Back to Today',
  },

  offline: {
    banner: 'Offline · showing saved data',
  },

  urgency: {
    ended: 'Ended',
    withDays: '{d} {dayWord} and {h} h left',
    withHours: '{h} h left',
    lessThanHour: 'Less than an hour left',
    day: 'day',
    days: 'days',
    startsInDays: 'Starts in {d} {dayWord} and {h} h',
    startsInHours: 'Starts in {h} h',
    startsInSoon: 'Starts in less than an hour',
  },
}
