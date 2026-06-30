function stripTrailingSlash(s: string): string {
  return s.replace(/\/$/, "");
}

/**
 * Domínio público do site em produção.
 * Usado nas preferências Mercado Pago (`back_urls` e `notification_url`) para o MP
 * redirecionar e notificar a URL correta (não localhost nem deploy antigo).
 */
export const MIRAGEM_PUBLIC_SITE_ORIGIN = "https://www.miragemfantasia.com.br";

export function getMercadoPagoPublicOrigin(): string {
  return stripTrailingSlash(MIRAGEM_PUBLIC_SITE_ORIGIN);
}

/**
 * Origem usada em `redirectTo` do Supabase Auth (OAuth, confirmação de e-mail, reset de senha).
 * Preferência: NEXT_PUBLIC_SITE_URL → origin do browser → domínio público de produção.
 */
export function getAuthRedirectOrigin(browserOrigin?: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return stripTrailingSlash(fromEnv);
  if (browserOrigin) return stripTrailingSlash(browserOrigin);
  return stripTrailingSlash(MIRAGEM_PUBLIC_SITE_ORIGIN);
}

export function buildAuthCallbackUrl(
  browserOrigin: string,
  nextPath = "/",
): string {
  const origin = getAuthRedirectOrigin(browserOrigin);
  return `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
}

export function buildPasswordResetRedirectUrl(browserOrigin: string): string {
  const origin = getAuthRedirectOrigin(browserOrigin);
  return `${origin}/auth/reset-password`;
}
