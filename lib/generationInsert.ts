import type { GenerationType } from "@/types";

export type GenerationClientTab = "image" | "extend";

export const GENERATION_COST_BASE = 50;
export const GENERATION_COST_EXTENDED = 100;
export const GENERATION_COST_AUDIO = 5;

export function tabToGenerationType(tab: GenerationClientTab): GenerationType {
  return tab === "extend" ? "estendido" : "padrao";
}

export function tabToDiamondCost(tab: GenerationClientTab): number {
  return tab === "extend" ? GENERATION_COST_EXTENDED : GENERATION_COST_BASE;
}

/** Custo total: modo (base/estendido) + áudio opcional. */
export function computeTotalDiamondCost(
  tab: GenerationClientTab,
  audioEnabled: boolean,
): number {
  return tabToDiamondCost(tab) + (audioEnabled ? GENERATION_COST_AUDIO : 0);
}

export function fileAcceptForTab(tab: GenerationClientTab): string {
  return tab === "extend" ? "video/*,image/gif" : "image/*";
}

export function primaryButtonLabel(tab: GenerationClientTab): string {
  return tab === "extend" ? "Estender Vídeo" : "Gerar Vídeo";
}

/** Payload mínimo do INSERT em `generations` (sem source_url / video_id). */
export type GenerationInsertRow = {
  user_id: string;
  card_name: string;
  image_url: string;
  status: string;
  type: GenerationType;
  mode: GenerationType;
  audio_enabled: boolean;
};

export function buildGenerationRow(params: {
  userId: string;
  cardName: string;
  imageUrl: string;
  tab: GenerationClientTab;
  audioEnabled: boolean;
  status?: string;
}): GenerationInsertRow {
  const type = tabToGenerationType(params.tab);

  return {
    user_id: params.userId,
    card_name: params.cardName,
    image_url: params.imageUrl,
    status: params.status ?? "pendente",
    type,
    mode: type,
    audio_enabled: params.audioEnabled,
  };
}

/** INSERT com fallback se `mode` ou `audio_enabled` ainda não existirem no PostgREST. */
export async function insertGenerationRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  row: GenerationInsertRow,
) {
  let result = await supabase
    .from("generations")
    .insert(row)
    .select("id")
    .single();

  if (result.error?.code === "PGRST204") {
    const { mode: _m, audio_enabled: _a, ...withoutOptional } = row;
    result = await supabase
      .from("generations")
      .insert(withoutOptional)
      .select("id")
      .single();
  }

  return result as { data: { id?: string } | null; error: { code?: string; message?: string } | null };
}
