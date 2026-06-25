"use server";

import { createClient } from "@/lib/supabase/server";
import type { GenerationType, GenerationInsert, TransactionInsert } from "@/types";

const IS_DEV = process.env.NODE_ENV === "development";

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
  console.log("[generation-action] Buscando saldo do usuário:", userId);
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
  console.log("[generation-action] Saldo atual:", currentDiamonds, "| Custo:", cost);

  // DEV MODE: pular verificação de saldo se variável estiver setada
  const skipDebit = IS_DEV && process.env.NEXT_PUBLIC_DEV_SKIP_DEBIT === "true";

  if (!skipDebit && currentDiamonds < cost) {
    return {
      ok: false,
      error: `Diamantes insuficientes. Você tem ${currentDiamonds} 💎 e precisa de ${cost} 💎.`,
    };
  }

  // 2. Debitar diamantes
  let newBalance: number;
  if (skipDebit) {
    console.warn("[generation-action][DEV] Débito de diamantes IGNORADO (NEXT_PUBLIC_DEV_SKIP_DEBIT=true)");
    newBalance = currentDiamonds;
  } else {
    newBalance = currentDiamonds - cost;
    const { error: debitErr } = await sb
      .from("profiles")
      .update({ diamonds: newBalance } as Record<string, unknown>)
      .eq("id", userId);

    if (debitErr) {
      console.error("[generation-action] Erro no débito:", debitErr);
      return { ok: false, error: "Falha ao debitar: " + debitErr.message };
    }
    console.log("[generation-action] Diamantes debitados. Novo saldo:", newBalance);
  }

  // 3. Registrar transação
  const tx: TransactionInsert = {
    user_id: userId,
    amount: -cost,
    type: type === "estendido" ? "generation_extended" : "generation",
    description: `Geração de vídeo ${type === "estendido" ? "estendida" : "padrão"} (${cost} 💎)`,
  };

   
  sb.from("transactions" as any)
    .insert(tx as any)
    .then(({ error: txErr }) => {
      if (txErr) console.error("[generation-action] Erro transactions:", txErr);
      else console.log("[generation-action] Transação registrada com sucesso");
    });

  // 4. Criar registro em generations
  const gen: GenerationInsert = {
    user_id: userId,
    image_url: imageUrl,
    type,
    mode: type,
    audio_enabled: false,
    diamond_cost: cost,
    status: "processing",
  };

   
  const { error: genErr } = await sb
    .from("generations" as any)
    .insert(gen as any);

  if (genErr) {
    console.error("[generation-action] Erro ao criar geração:", genErr);
    return { ok: false, error: "Erro ao registrar geração: " + genErr.message };
  }

  console.log("[generation-action] ✅ Linha criada na tabela generations:", { type, cost, newBalance });
  return { ok: true, newBalance };
}

/**
 * DEV ONLY: Adiciona diamantes ao usuário logado.
 * Só funciona em development.
 */
export async function devAddDiamondsAction(
  amount: number = 1000,
): Promise<{ ok: boolean; newBalance?: number; error?: string }> {
  if (!IS_DEV) {
    return { ok: false, error: "Disponível apenas em desenvolvimento." };
  }

  const sb = await createClient();
  if (!sb) return { ok: false, error: "Supabase não configurado." };

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };

  const { data: profile } = await sb
    .from("profiles")
    .select("diamonds")
    .eq("id", user.id)
    .single();

  const current = (profile as { diamonds: number | null })?.diamonds ?? 0;
  const newBalance = current + amount;

  const { error } = await sb
    .from("profiles")
    .update({ diamonds: newBalance } as Record<string, unknown>)
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  console.log(`[DEV] 💎 +${amount} diamantes para ${user.email}. Novo saldo: ${newBalance}`);
  return { ok: true, newBalance };
}
