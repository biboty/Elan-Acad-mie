// Réglages de l'application Élan Académie.
// Les deux valeurs se trouvent dans Supabase : Project Settings > API (Project URL et clé "anon public").
// La clé anon est publique par conception : la sécurité est assurée par les règles de la base (RLS), pas par le secret de cette clé.
window.ELAN_CONFIG = {
  supabaseUrl: "",          // ex. "https://abcdefghijklmnop.supabase.co"
  supabaseAnonKey: "",      // ex. "eyJhbGciOi..."
  siteName: "Élan Académie",
  sessionsPlanned: 32
};
