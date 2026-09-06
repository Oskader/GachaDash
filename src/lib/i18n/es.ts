/**
 * Diccionario español.
 *
 * Es la FUENTE DEL TIPO: `en.ts` se tipa contra este, así que una clave que
 * falte allí es un error de compilación y no un hueco en pantalla.
 *
 * Lo que NO vive aquí: nombres de eventos, nombres de juegos y las
 * descripciones, que salen de la base de datos ya en el idioma que toca.
 */
export const es = {
  nav: {
    hoy: 'Hoy',
    juegos: 'Juegos',
    cuenta: 'Cuenta',
    ajustes: 'Ajustes',
    aria: 'Navegación principal',
  },

  landing: {
    headlineBefore: 'Se acaba',
    headlineAfter: 'y no lo sabías.',
    intro:
      'GachaEvent reúne los eventos de tiempo limitado de Honkai: Star Rail, Wuthering Waves, Zenless Zone Zero y Arknights: Endfield en una sola lista, ordenada por lo que vence antes.',
    feature1Term: 'Una lista, no cuatro',
    feature1Detail:
      'Los eventos de los cuatro juegos, ordenados por urgencia y no por franquicia.',
    feature2Term: 'Checklist de endgame',
    feature2Detail:
      'Marca lo que ya has farmeado. Se guarda en tu cuenta y te sigue entre dispositivos.',
    feature3Term: 'Se actualiza sola',
    feature3Detail: 'Un scraper lee las wikis cada mañana. Tú no mantienes nada.',
    createAccount: 'Crear cuenta',
    browseAnonymously: 'Mirar sin cuenta',
  },

  hoy: {
    title: 'Hoy',
    endsToday: 'Se acaba hoy',
    nothingSoon: 'Nada vence en las próximas 12 horas.',
    thisWeek: 'Esta semana',
    later: 'Más adelante',
    upcoming: 'Próximamente',
    upcomingNote: 'Anunciados pero todavía no disponibles.',
    activeEvent: 'evento activo',
    activeEvents: 'eventos activos',
    emptyTitle: 'No hay eventos activos',
    emptyBody:
      'Los scrapers corren cada mañana. Mientras tanto puedes adelantar el checklist de endgame.',
    seeGames: 'Ver juegos',
  },

  juegos: {
    title: 'Juegos',
    tracked: 'seguidos',
    noActiveEvents: 'sin eventos activos',
    upcomingCountOne: '{n} próximo',
    upcomingCount: '{n} próximos',
    nextClosing: 'Próximo cierre',
  },

  game: {
    notFound: 'Juego no encontrado',
    metaDescription: 'Eventos activos y checklist de endgame de {game}.',
    eventsHeading: 'Eventos',
    upcomingHeading: 'Próximamente',
    upcomingNote: 'Anunciados pero todavía no disponibles.',
    activeOne: 'activo',
    activeMany: 'activos',
    noEvents: 'No hay eventos activos ahora mismo. El scraper revisa la wiki cada mañana.',
    checklistEmpty: 'Todavía no hay tareas de endgame para este juego.',
    signInLink: 'Inicia sesión',
    signInRest: 'para guardar tu progreso entre sesiones.',
    checklistHeading: 'Endgame',
    progressAria: 'Progreso endgame',
    saveFailed: 'No se pudo guardar',
    categories: {
      other: 'rutina',
      character: 'personaje',
      weapon: 'arma',
      artifact: 'reliquia',
      story: 'historia',
      achievement: 'reto',
    },
    // SubNav de segmento dentro del juego (eventos | banners)
    eventsTab: 'Eventos',
    bannersTab: 'Banners',
    bannersTitle: 'Banners',
    bannersNote: 'Banners de gacha actuales y próximos.',
    noBanners: 'No hay banners activos ahora mismo.',
    weeklyHeading: 'Semanal',
  },

  // Juegos en pausa (game-status.ts): placeholder con identidad del juego.
  paused: {
    comingSoon: 'Próximamente',
    note: 'El seguimiento de eventos de este juego todavía no está disponible.',
  },

  event: {
    andMore: 'y {n} más',
  },

  cuenta: {
    title: 'Cuenta',
    email: 'Correo',
    tasksDone: 'Tareas completadas',
    createdAt: 'Cuenta creada',
    signOut: 'Cerrar sesión',
    signingOut: 'Cerrando sesión…',
    signOutFailed: 'No se pudo cerrar la sesión',
    signedOutTitle: 'No has iniciado sesión',
    signedOutBody:
      'Tu progreso de endgame se guarda en tu cuenta y te sigue entre dispositivos.',
    signIn: 'Iniciar sesión',
  },

  auth: {
    loginTitle: 'Entrar',
    loginSubtitle: 'Tu progreso de endgame te está esperando.',
    registerTitle: 'Crear cuenta',
    registerSubtitle: 'Para que lo que marques siga ahí mañana.',
    email: 'Correo',
    password: 'Contraseña',
    passwordMismatch: 'Las contraseñas no coinciden',
    accountCreatedConfirm: 'Cuenta creada. Confirma tu correo para entrar.',
    accountCreated: 'Cuenta creada',
    badCredentials: 'Correo o contraseña incorrectos.',
    googleFailed: 'No se pudo abrir el acceso con Google',
    emailPlaceholder: 'tu@correo.com',
    passwordPlaceholder: 'Mínimo 6 caracteres',
    confirmPassword: 'Repite la contraseña',
    submitting: 'Un momento…',
    submitRegister: 'Crear cuenta',
    submitLogin: 'Entrar',
    or: 'o',
    google: 'Continuar con Google',
    haveAccount: '¿Ya tienes cuenta? ',
    noAccount: '¿Todavía no tienes cuenta? ',
    goSignIn: 'Inicia sesión',
    goRegister: 'Créala',
  },

  ajustes: {
    title: 'Ajustes',
    languageLabel: 'Idioma',
    languageHelp:
      'Cambia el idioma de la interfaz y de las descripciones de los eventos.',
    spanish: 'Español',
    english: 'English',
  },

  error: {
    eyebrow: 'Error',
    title: 'Algo se rompió al cargar',
    body: 'No hemos podido preparar esta pantalla. Vuelve a intentarlo; si insiste, es cosa nuestra.',
    ref: 'ref',
    retry: 'Reintentar',
    backHome: 'Volver a Hoy',
  },

  offline: {
    banner: 'Sin conexión · viendo datos guardados',
  },

  /**
   * Solo la etiqueta para lectores de pantalla. El texto visible de la cuenta
   * atrás ("2d 03h", "06h 41m") es neutro y no se traduce.
   *
   * `{d}` y `{h}` se sustituyen; el orden de las palabras cambia entre
   * idiomas, por eso son plantillas enteras y no palabras sueltas.
   */
  urgency: {
    ended: 'Terminado',
    withDays: 'Quedan {d} {dayWord} y {h} h',
    withHours: 'Quedan {h} h',
    lessThanHour: 'Quedan menos de una hora',
    day: 'día',
    days: 'días',
    startsInDays: 'Empieza en {d} {dayWord} y {h} h',
    startsInHours: 'Empieza en {h} h',
    startsInSoon: 'Empieza en menos de una hora',
  },
}

export type Dictionary = typeof es
