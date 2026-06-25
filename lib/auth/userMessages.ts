/**
 * Mensagens amigáveis em português para erros de autenticação Supabase.
 * O erro técnico original deve ser logado no console, não exibido ao utilizador.
 */
export function friendlyAuthErrorMessage(
  error: { message?: string; status?: number } | null | undefined,
  fallback = "Não foi possível concluir a operação. Tente novamente.",
): string {
  if (!error?.message) return fallback;

  const msg = error.message.toLowerCase();

  if (msg.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (msg.includes("email not confirmed")) {
    return "Confirme o seu e-mail antes de entrar. Verifique a caixa de entrada.";
  }
  if (msg.includes("user already registered")) {
    return "Este e-mail já está cadastrado. Tente entrar ou recuperar a senha.";
  }
  if (msg.includes("rate limit") || msg.includes("too many requests")) {
    return "Muitas tentativas em sequência. Aguarde alguns minutos e tente novamente.";
  }
  if (msg.includes("redirect") || msg.includes("redirect_uri")) {
    return "Erro de configuração do login social. Entre em contato com o suporte.";
  }
  if (msg.includes("oauth") || msg.includes("provider")) {
    return "Não foi possível iniciar o login com Google. Tente novamente ou use e-mail e senha.";
  }
  if (msg.includes("signup") && msg.includes("disabled")) {
    return "Novos cadastros estão temporariamente indisponíveis.";
  }
  if (msg.includes("password") && msg.includes("weak")) {
    return "A senha é muito fraca. Use pelo menos 6 caracteres.";
  }
  if (msg.includes("email") && msg.includes("invalid")) {
    return "Informe um endereço de e-mail válido.";
  }

  return fallback;
}

export function friendlyPasswordResetErrorMessage(
  error: { message?: string } | null | undefined,
): string {
  return friendlyAuthErrorMessage(
    error,
    "Não foi possível enviar o e-mail de recuperação. Tente novamente em alguns minutos.",
  );
}
