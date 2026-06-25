"use server";

import { isAdminStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { revalidatePath } from "next/cache";

export type DeliverVideoActionState = {
  ok: boolean;
  message: string;
};

async function requireAdminSession() {
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase não configurado no servidor.");

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("Usuário não autenticado.");
  if (!isAdminStaff(user)) throw new Error("Acesso negado.");

  return { user, supabase };
}

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

export async function deliverVideoAction(
  _prevState: DeliverVideoActionState,
  formData: FormData,
): Promise<DeliverVideoActionState> {
  try {
    await requireAdminSession();

    const generationId = String(formData.get("generationId") ?? "").trim();
    const file = formData.get("videoFile");

    if (!generationId) {
      return { ok: false, message: "Pedido inválido." };
    }

    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: "Selecione um vídeo .mp4." };
    }

    const fileName = safeFileName(file.name);
    const isMp4 = file.type === "video/mp4" || fileName.endsWith(".mp4");
    if (!isMp4) {
      return { ok: false, message: "O arquivo precisa ser um vídeo .mp4." };
    }

    const service = createServiceRoleClient();
    if (!service) {
      return { ok: false, message: "Service Role do Supabase não configurada." };
    }

    const bucket = "videos_gerados";
    const path = `${generationId}/${Date.now()}-${fileName || "resultado.mp4"}`;

    const { error: uploadError } = await service.storage.from(bucket).upload(path, file, {
      contentType: "video/mp4",
      upsert: true,
    });

    if (uploadError) {
      return { ok: false, message: `Erro ao salvar vídeo: ${uploadError.message}` };
    }

    const {
      data: { publicUrl },
    } = service.storage.from(bucket).getPublicUrl(path);

    const { error: updateError } = await service
      .from("generations" as never)
      .update({
        status: "concluido",
        url_resultado: publicUrl,
      } as never)
      .eq("id", generationId);

    if (updateError) {
      return { ok: false, message: `Vídeo enviado, mas erro ao atualizar pedido: ${updateError.message}` };
    }

    revalidatePath("/admin/painel");
    revalidatePath("/admin/geracoes");
    revalidatePath("/minhas-geracoes");

    return { ok: true, message: "Vídeo entregue com sucesso." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Erro ao entregar vídeo.",
    };
  }
}
