"use server";

import { isAdminStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { revalidatePath } from "next/cache";

export type DeliverPedidoVideoState = {
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

export async function deliverPedidoVideoAction(params: {
  generationId: string;
  publicUrl?: string | null;
}): Promise<DeliverPedidoVideoState> {
  try {
    await requireAdminSession();

    const generationId = String(params.generationId ?? "").trim();
    const publicUrl = String(params.publicUrl ?? "").trim();

    if (!generationId) {
      return { ok: false, message: "Pedido inválido." };
    }

    const service = createServiceRoleClient();
    if (!service) {
      return { ok: false, message: "Service Role do Supabase não configurada." };
    }

    const updatePayload: { status: string; url_resultado?: string } = { status: "concluido" };
    if (publicUrl) updatePayload.url_resultado = publicUrl;

    const { error: updateError } = await service
      .from("generations" as never)
      .update(updatePayload as never)
      .eq("id", generationId);

    if (updateError) {
      return { ok: false, message: `Erro ao atualizar pedido: ${updateError.message}` };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/pedidos");
    revalidatePath("/minhas-geracoes");

    return {
      ok: true,
      message: publicUrl
        ? "Pedido concluído e vídeo liberado para o cliente."
        : "Pedido marcado como concluído.",
    };
  } catch (error) {
    console.error("[deliverPedidoVideoAction] Erro ao entregar pedido:", error);
    return {
      ok: false,
      message: "Não foi possível finalizar o pedido. Tente novamente ou verifique o vídeo enviado.",
    };
  }
}

export type AssignPedidoState = {
  ok: boolean;
  message: string;
  assignedTo?: string;
};

async function requireStaffSession() {
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase não configurado no servidor.");

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("Usuário não autenticado.");

  const { isStaff } = await import("@/lib/auth/staff");
  if (!isStaff(user)) throw new Error("Acesso negado.");

  return { user, supabase };
}

export async function assignPedidoAction(params: {
  generationId: string;
}): Promise<AssignPedidoState> {
  try {
    const { user } = await requireStaffSession();
    const { getAdminDisplayLabel } = await import("@/lib/adminStaffDisplay");

    const generationId = String(params.generationId ?? "").trim();
    if (!generationId) {
      return { ok: false, message: "Pedido inválido." };
    }

    const adminLabel = getAdminDisplayLabel(user);
    const service = createServiceRoleClient();
    if (!service) {
      return { ok: false, message: "Service Role do Supabase não configurada." };
    }

    const { data: existing, error: fetchError } = await service
      .from("generations" as never)
      .select("id, assigned_to")
      .eq("id", generationId)
      .maybeSingle();

    if (fetchError) {
      return { ok: false, message: fetchError.message };
    }
    if (!existing) {
      return { ok: false, message: "Pedido não encontrado." };
    }

    const row = existing as { assigned_to?: string | null };
    const current = row.assigned_to?.trim();
    if (current && current.toLowerCase() !== adminLabel.toLowerCase()) {
      return {
        ok: false,
        message: `Este pedido já está com ${current}.`,
      };
    }

    const { error: updateError } = await service
      .from("generations" as never)
      .update({ assigned_to: adminLabel } as never)
      .eq("id", generationId);

    if (updateError) {
      return { ok: false, message: updateError.message };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/pedidos");

    return {
      ok: true,
      message: `Pedido assumido por ${adminLabel}.`,
      assignedTo: adminLabel,
    };
  } catch (error) {
    console.error("[assignPedidoAction]", error);
    return { ok: false, message: "Não foi possível assumir o pedido." };
  }
}
