export type Locale = "en" | "fr" | "pt";

export const LOCALES: Locale[] = ["en", "fr", "pt"];
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  pt: "Português",
};

type Dict = Record<string, string>;

const en: Dict = {
  "nav.dashboard": "Dashboard",
  "nav.travel": "Travel",
  "nav.leave": "Leave",
  "nav.imprest": "Imprest",
  "nav.procurement": "Procurement",
  "nav.approvals": "Approvals",
  "nav.mande": "M&E / Results Monitoring",
  "nav.reports": "Reports",
  "login.title": "Sign in",
  "login.email": "Email",
  "login.password": "Password",
  "login.submit": "Sign in",
  "login.mfa": "Authenticator code",
  "login.forgot": "Forgot password?",
  "login.error": "Login failed. Please try again.",
};

const fr: Dict = {
  "nav.dashboard": "Tableau de bord",
  "nav.travel": "Missions",
  "nav.leave": "Congés",
  "nav.imprest": "Avances",
  "nav.procurement": "Achats",
  "nav.approvals": "Approbations",
  "nav.mande": "S&E / Suivi des résultats",
  "nav.reports": "Rapports",
  "login.title": "Connexion",
  "login.email": "E-mail",
  "login.password": "Mot de passe",
  "login.submit": "Se connecter",
  "login.mfa": "Code d'authentification",
  "login.forgot": "Mot de passe oublié ?",
  "login.error": "Échec de la connexion. Réessayez.",
};

const pt: Dict = {
  "nav.dashboard": "Painel",
  "nav.travel": "Missões",
  "nav.leave": "Licenças",
  "nav.imprest": "Adiantamentos",
  "nav.procurement": "Aquisições",
  "nav.approvals": "Aprovações",
  "nav.mande": "M&A / Monitorização de resultados",
  "nav.reports": "Relatórios",
  "login.title": "Entrar",
  "login.email": "E-mail",
  "login.password": "Palavra-passe",
  "login.submit": "Entrar",
  "login.mfa": "Código de autenticação",
  "login.forgot": "Esqueceu a palavra-passe?",
  "login.error": "Falha no login. Tente novamente.",
};

const TABLES: Record<Locale, Dict> = { en, fr, pt };

export function translate(locale: Locale, key: string): string {
  return TABLES[locale][key] ?? TABLES.en[key] ?? key;
}

export function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const raw = window.localStorage.getItem("sadcpf_locale");
  if (raw === "fr" || raw === "pt" || raw === "en") return raw;
  return "en";
}

export function storeLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("sadcpf_locale", locale);
}
