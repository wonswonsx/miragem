"use server";

import { createClient } from "@/lib/supabase/server";
import type { GenerationType, GenerationInsert, TransactionInsert } from "@/types";

type GenerationResult =
  | { ok: true; newBalance: number }
  | { ok: false; error: string };

/**
 * Server action: verifica saldo, debita diamantes, registra transação
 * e cria o registro em `generations`.
 *
 * O upload do ficheiro continua no cliente (precisa do File object),
 * mas toda a lógica de banco fica aqui no servidor.
 */
export async function createGenerationAction(params: {
  imageUrl: string;
  type: GenerationType;
  cost: number;
}): Promise<GenerationResult> {
  const { imageUrl, type, cost } = params;

  const sb = await createClient();
  if (!sb) {
    return { ok: false, error: "Supabase não configurado." };
  }

  // Autenticar utilizador
  const {
    data: { user },
    error: authErr,
  } = await sb.auth.getUser();

  if (authErr || !user) {
    return { ok: false, error: "Usuário não autenticado." };
  }

  const userId = user.id;

  // 1. Buscar saldo actual
  const { data: profile, error: profileErr } = await sb
    .from("profiles")
    .select("diamonds")
    .eq("id", userId)
    .single();

  if (profileErr) {
    console.error("[generation-action] Erro ao buscar perfil:", profileErr);
    return { ok: false, error: "Erro ao verificar saldo: " + profileErr.message };
  }

  const currentDiamonds = (profile as { diamonds: number | null })?.diamonds ?? 0;

  if (currentDiamonds < cost) {
    return {
      ok: false,
      error: `Diamantes insuficientes. Você tem ${currentDiamonds} 💎 e precisa de ${cost} 💎.`,
    };
  }

  // 2. Debitar diamantes
  const newBalance = currentDiamonds - cost;
  const { error: debitErr } = await sb
    .from("profiles")
    .update({ diamonds: newBalance } as Record<string, unknown>)
    .eq("id", userId);

  if (debitErr) {
    console.error("[generation-action] Erro no débito:", debitErr);
    return { ok: false, error: "Falha ao debitar: " + debitErr.message };
  }

  // 3. Registrar transação (fire-and-forget no servidor também)
  const tx: TransactionInsert = {
    user_id: userId,
    amount: -cost,
    type: type === "estendido" ? "generation_extended" : "generation",
    description: `Geração de vídeo ${type === "estendido" ? "estendida" : "padrão"} (${cost} 💎)`,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb.from("transactions" as any)
    .insert(tx as any)
    .then(({ error: txErr }) => {
      if (txErr) console.error("[generation-action] Erro transactions:", txErr);
    });

  // 4. Criar registro em generations
  const gen: GenerationInsert = {
    user_id: userId,
    image_url: imageUrl,
    type,
    diamond_cost: cost,
    status: "processing",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: genErr } = await sb
    .from("generations" as any)
    .insert(gen as any);

  if (genErr) {
    console.error("[generation-action] Erro ao criar geração:", genErr);
    return { ok: false, error: "Erro ao registrar geração: " + genErr.message };
  }

  console.log("[generation-action] Geração criada:", { type, cost, newBalance });
  return { ok: true, newBalance };
}
