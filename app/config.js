// Réglages de l'application Élan Académie.
// Les deux valeurs se trouvent dans Supabase : Project Settings > API (Project URL et clé "anon public").
// La clé anon est publique par conception : la sécurité est assurée par les règles de la base (RLS), pas par le secret de cette clé.
window.ELAN_CONFIG = {
  supabaseUrl: "https://lvdlivrijyocmdwlimlj.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2ZGxpdnJpanlvY21kd2xpbWxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5NTUwMjUsImV4cCI6MjEwODUzMTAyNX0.v6do7MQhBL_aqx54pntx_z_oOPjZx2S07JtB8m2JgVg",
  siteName: "Élan Académie",
  sessionsPlanned: 32
};
