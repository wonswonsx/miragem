"use client";

import {
  buildGenerationRow,
  computeTotalDiamondCost,
  insertGenerationRow,
  type GenerationClientTab,
} from "@/lib/generationInsert";
import { getItemTitle, type MediaItem } from "@/lib/mirageMedia";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

export type SubmitGenerationResult =
  | { ok: true; diamondsAfter?: number }
  | { ok: false; error: string; code?: string };

const CLIENT_UPLOAD_BUCKET = "imagens";

function safeFileName(name: string): string {
  const base = name.replace(/[/\\]/g, "_").trim();
  return base || "arquivo";
}

/** Caminho no bucket `imagens`: `{userId}/{timestamp}-{file.name}`. */
function buildStorageObjectPath(userId: string, file: File): string {
  return `${userId}/${Date.now()}-${safeFileName(file.name)}`;
}

/**
 * Garante cliente browser com sessão JWT ativa (necessário para RLS do Storage).
 */
async function getAuthenticatedSupabase() {
  if (!isSupabaseConfigured()) {
    return {
      ok: false as const,
      error: "Supabase não configurado.",
      code: "config",
    };
  }

  let {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    const { data: refreshData, error: refreshError } =
      await supabase.auth.refreshSession();
    if (refreshError) {
      console.error("[submitGeneration] refreshSession:", refreshError);
    }
    session = refreshData.session ?? null;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.id) {
    return {
      ok: false as const,
      error: "Faça login para continuar.",
      code: "auth",
    };
  }

  if (!session?.access_token) {
    return {
      ok: false as const,
      error: "Sessão expirada. Faça login novamente.",
      code: "auth",
    };
  }

  if (session.user.id !== user.id) {
    return {
      ok: false as const,
      error: "Sessão inválida. Faça login novamente.",
      code: "auth",
    };
  }

  return { ok: true as const, user, session };
}

export async function submitGeneration(params: {
  item: MediaItem;
  tab: GenerationClientTab;
  hasAudio: boolean;
  file: File | null;
  totalCost?: number;
}): Promise<SubmitGenerationResult> {
  const { item, tab, hasAudio, file } = params;
  const cost =
    params.totalCost ?? computeTotalDiamondCost(tab, hasAudio);

  const auth = await getAuthenticatedSupabase();
  if (!auth.ok) {
    return { ok: false, error: auth.error, code: auth.code };
  }

  const { user } = auth;

  let uploadedUrl: string | null = null;
  if (file) {
    const objectPath = buildStorageObjectPath(user.id, file);

    // 1) Upload autenticado primeiro — sem débito nem insert se falhar.
    try {
      const { error: uploadError } = await supabase.storage
        .from(CLIENT_UPLOAD_BUCKET)
        .upload(objectPath, file, {
          contentType: file.type || undefined,
          upsert: false,
        });

      if (uploadError) {
        console.error("[submitGeneration] upload:", uploadError);
        const isRls =
          uploadError.message?.toLowerCase().includes("row-level security") ||
          uploadError.message?.toLowerCase().includes("policy");
        return {
          ok: false,
          error: isRls
            ? "Sem permissão para enviar arquivo. Verifique se está logado e tente de novo."
            : "Falha ao enviar arquivo. Tente novamente.",
          code: isRls ? "storage_rls" : "upload",
        };
      }

      uploadedUrl = supabase.storage
        .from(CLIENT_UPLOAD_BUCKET)
        .getPublicUrl(objectPath).data.publicUrl;
    } catch (uploadErr) {
      console.error("[submitGeneration] upload:", uploadErr);
      return {
        ok: false,
        error: "Falha ao enviar arquivo. Tente novamente.",
        code: "upload",
      };
    }
  }

  // 2) Débito só após upload bem-sucedido (ou fluxo sem arquivo).
  const { data: debitResult, error: debitError } = await supabase.rpc(
    "check_and_debit_diamonds" as never,
    {
      user_id_param: user.id,
      cost_param: cost,
    } as never,
  );

  if (debitError) {
    console.error("[submitGeneration] debit:", debitError);
    return {
      ok: false,
      error: "Erro ao processar diamantes. Tente novamente.",
    };
  }

  const debit = Array.isArray(debitResult) ? debitResult[0] : debitResult;
  const debitRow = debit as {
    success?: boolean;
    message?: string;
    diamonds_after?: number;
  };

  if (!debitRow?.success) {
    const msg = debitRow?.message ?? "Saldo insuficiente";
    return {
      ok: false,
      error:
        msg === "Saldo insuficiente"
          ? `Diamantes insuficientes. Você precisa de ${cost} 💎.`
          : msg,
    };
  }

  // 3) Insert em `generations` só após débito confirmado.
  if (!uploadedUrl) {
    return {
      ok: false,
      error: "Envie um arquivo antes de gerar.",
      code: "upload",
    };
  }

  const row = buildGenerationRow({
    userId: user.id,
    cardName: getItemTitle(item),
    imageUrl: uploadedUrl,
    tab,
    audioEnabled: hasAudio,
    status: "pendente",
  });

  const { error: insertError } = await insertGenerationRow(
    supabase as never,
    row,
  );

  if (insertError) {
    console.error("[submitGeneration] insert:", insertError);
    return {
      ok: false,
      error:
        insertError.code === "PGRST204"
          ? "Coluna ausente no banco. Aplique a migration type/mode/audio_enabled."
          : "Erro ao criar pedido. Tente novamente.",
      code: insertError.code,
    };
  }

  return { ok: true, diamondsAfter: debitRow.diamonds_after };
}
