"use server";

import { isAdminStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getSupabaseVideoStorageBucket } from "@/lib/supabase/storagePaths";
import { revalidatePath } from "next/cache";

export type AdminGenerationActionState = {
  ok: boolean;
  message: string;
};

async function requireAdmin() {
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase não configurado no servidor.");

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("Usuário não autenticado.");
  if (!isAdminStaff(user)) throw new Error("Acesso negado.");

  return { supabase, user };
}

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

export async function uploadGenerationResultAction(
  _prevState: AdminGenerationActionState,
  formData: FormData,
): Promise<AdminGenerationActionState> {
  try {
    await requireAdmin();

    const generationId = String(formData.get("generationId") ?? "").trim();
    const file = formData.get("resultFile");

    if (!generationId) {
      return { ok: false, message: "Geração inválida." };
    }

    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: "Selecione a imagem final." };
    }

    if (!file.type.startsWith("image/")) {
      return { ok: false, message: "Envie um arquivo de imagem válido." };
    }

    const service = createServiceRoleClient();
    if (!service) {
      return { ok: false, message: "Service Role do Supabase não configurada." };
    }

    const bucket = getSupabaseVideoStorageBucket();
    const extension = safeFileName(file.name).split(".").pop() || "jpg";
    const objectPath = `resultados/${generationId}/${Date.now()}.${extension}`;

    const { error: uploadError } = await service.storage
      .from(bucket)
      .upload(objectPath, file, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return { ok: false, message: `Erro no upload: ${uploadError.message}` };
    }

    const {
      data: { publicUrl },
    } = service.storage.from(bucket).getPublicUrl(objectPath);

    const { error: updateError } = await service
      .from("generations" as never)
      .update({
        url_final: publicUrl,
        status: "concluido",
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", generationId);

    if (updateError) {
      return { ok: false, message: `Upload feito, mas erro ao atualizar: ${updateError.message}` };
    }

    revalidatePath("/admin/geracoes");
    revalidatePath("/minhas-geracoes");

    return { ok: true, message: "Imagem final enviada e geração concluída." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Erro ao concluir geração.",
    };
  }
}
