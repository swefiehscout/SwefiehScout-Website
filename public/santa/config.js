// ============================================================
// Santa Booking settings (see santa-booking/README.md).
// The publishable key is safe to be public: the database only lets the
// public call the four website functions (free times, book, settings, message).
// ============================================================
window.SANTA_CONFIG = {
  SUPABASE_URL: "https://rbppkcqeomvfgvxmwonh.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_htwV1jrwBw_NbMSlx8nCgA_vz8FH4TR",

  // Team logins: a username like "sara" signs in as sara@santa.team.
  // Typing a full email also works (the owner signs in as santa@swefieh-orthodox-scout.com).
  TEAM_DOMAIN: "santa.team",

  // Shown in the footer and in the WhatsApp confirmation message.
  ORG_NAME_EN: "Greek Orthodox Scouts & Guides – Swefieh",

  // Contact page links. Remove a line to hide it.
  CONTACT: {
    instagram: "https://www.instagram.com/theorthodoxscout",
    facebook: "https://www.facebook.com/share/1Eh8bqpyn2/",
    website: "https://www.swefieh-orthodox-scout.com/",
  },
};
