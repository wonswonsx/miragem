"use server";

import { mergeTagsIntoPrompt } from "@/lib/mirageMedia";
import { toAdminProfileRow } from "@/lib/adminProfileRow";
import { isAdminStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { TablesInsert } from "@/lib/database.types";
import {
  getSupabaseVideoStorageBucket,
  LEGACY_SUPABASE_STORAGE_MEDIA_BUCKET,
  parseSupabaseStoragePublicUrl,
} from "@/lib/supabase/storagePaths";
import type {
  AdminProfileRow,
  SupportMessageRow,
} from "@/types/database";

export type EconomyUserRow = {
  id: string;
  email: string;
  diamonds: number;
};

async function requireStaffSession() {
  const supabase = await createClient();
  if (!supabase) {
    throw new Error("Supabase não configurado no servidor.");
  }
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Usuário não autenticado.");
  if (!isAdminStaff(user)) throw new Error("Acesso negado.");
  return { user, supabase };
}

function getAdminSupabase() {
  return createServiceRoleClient();
}

function storageBucketName() {
  return getSupabaseVideoStorageBucket();
}

function hintStorageUpload(bucket: string, message: string) {
  return `Storage (${bucket}): ${message}`;
}

export type CreateVideoFromStagingResult =
  | { ok: true; videoId: string }
  | { ok: false; error: string };

export async function createVideoFromStagingAction(
  formData: FormData,
): Promise<CreateVideoFromStagingResult> {
  try {
    await requireStaffSession();
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const tagsJson = String(formData.get("tagsJson") ?? "[]");
    const videoUrl = String(formData.get("videoUrl") ?? "").trim();
    const categoryName = String(formData.get("categoryName") ?? "").trim();
    const posterFile = formData.get("poster");

    if (!title) {
      return { ok: false, error: "Título obrigatório." };
    }
    if (!videoUrl) {
      return { ok: false, error: "URL do vídeo em falta (refaça o upload)." };
    }

    let tagList: string[] = [];
    try {
      const parsed = JSON.parse(tagsJson) as unknown;
      if (Array.isArray(parsed)) {
        tagList = parsed.map((t) => String(t).trim()).filter(Boolean);
      }
    } catch {
      return { ok: false, error: "Tags inválidas." };
    }

    const promptBody = mergeTagsIntoPrompt(description || title, tagList);

    const service = getAdminSupabase();
    const userSb = await createClient();
    const sb = service ?? userSb;
    if (!sb) {
      return { ok: false, error: "Cliente Supabase indisponível." };
    }

    const storageBucket = storageBucketName();

    let posterUrl: string | null = null;
    if (posterFile instanceof File && posterFile.size > 0) {
      const buf = Buffer.from(await posterFile.arrayBuffer());
      const path = `posters/${Date.now()}-${posterFile.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await sb.storage
        .from(storageBucket)
        .upload(path, buf, {
          contentType: posterFile.type || "image/jpeg",
          upsert: false,
        });
      if (upErr) {
        return {
          ok: false,
          error: `Upload poster: ${hintStorageUpload(storageBucket, upErr.message)}`,
        };
      }
      const { data: pub } = sb.storage.from(storageBucket).getPublicUrl(path);
      posterUrl = pub.publicUrl;
    }

    const insertRow: TablesInsert<"videos"> = {
      title,
      prompt: promptBody,
      video_url: videoUrl,
    };
    if (posterUrl) {
      insertRow.thumbnail_url = posterUrl;
    }

    void categoryName;

    // PASSO 1: Salvar/Pegar as tags primeiro
    const tagIds: string[] = [];
    if (tagList.length > 0) {
      console.log('[createVideoFromStagingAction] Processando tags:', tagList);
      
      for (const tagName of tagList) {
        const { data: existingTag, error: tagError } = await sb
           
          .from('tags' as any)
          .select('id')
          .eq('name', tagName)
          .single();
        
        let tagId: string;
        
        if (tagError || !existingTag) {
          // Tag não existe, criar nova
          console.log('[createVideoFromStagingAction] Criando nova tag:', tagName);
          const { data: newTag, error: createError } = await sb
             
            .from('tags' as any)
            .insert({ name: tagName })
            .select('id')
            .single();
          
          if (createError) {
            console.error('[createVideoFromStagingAction] Erro ao criar tag:', createError);
            continue; // Continuar com outras tags
          }
          
           
          tagId = (newTag as any).id;
          console.log('[createVideoFromStagingAction] Tag criada com ID:', tagId);
        } else {
           
          tagId = (existingTag as any).id;
          console.log('[createVideoFromStagingAction] Tag existente com ID:', tagId);
        }
        
        tagIds.push(tagId);
      }
    }

    // PASSO 2: Salvar o vídeo
    const { data: inserted, error: insErr } = await sb
      .from("videos")
      .insert(insertRow)
      .select("id")
      .single();
    if (insErr || !inserted?.id) {
      return {
        ok: false,
        error: insErr?.message ?? "Falha ao inserir vídeo no Supabase.",
        ...(insErr
          ? {
              supabase: {
                message: insErr.message,
                details: (insErr as unknown as { details?: string | null }).details,
                hint: (insErr as unknown as { hint?: string | null }).hint,
                code: (insErr as unknown as { code?: string | null }).code,
              },
            }
          : null),
      };
    }

    console.log('[createVideoFromStagingAction] Vídeo salvo com ID:', inserted.id);

    // PASSO 3: Criar as ligações em video_tags
    if (tagIds.length > 0) {
      console.log('[createVideoFromStagingAction] Criando ligações video_tags:', { videoId: inserted.id, tagIds });
      
      const videoTagRelations = tagIds.map(tagId => ({
        video_id: inserted.id,
        tag_id: tagId
      }));
      
      const { error: relError } = await sb
         
        .from('video_tags' as any)
        .insert(videoTagRelations);
      
      if (relError) {
        console.error('[createVideoFromStagingAction] Erro ao criar relacionamentos video_tags:', relError);
        return {
          ok: false,
          error: `Vídeo salvo, mas erro ao vincular tags: ${relError.message}`,
        };
      } else {
        console.log('[createVideoFromStagingAction] Ligações video_tags criadas com sucesso!');
      }
    }
    
    return { ok: true, videoId: inserted.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro ao gravar vídeo.",
    };
  }
}

export type UpdateVideoTagsResult = { ok: true } | { ok: false; error: string };

export async function updateVideoTagsAction(
  videoId: string,
  tags: string[],
): Promise<UpdateVideoTagsResult> {
  try {
    await requireStaffSession();
    const service = getAdminSupabase();
    const userSb = await createClient();
    const sb = service ?? userSb;
    if (!sb) {
      return { ok: false, error: "Cliente Supabase indisponível." };
    }
    const clean = tags.map((t) => t.trim()).filter(Boolean);
    const { data: cur, error: selErr } = await sb
      .from("videos")
      .select("prompt")
      .eq("id", videoId)
      .maybeSingle();
    if (selErr) {
      return { ok: false, error: selErr.message };
    }
    const nextPrompt = mergeTagsIntoPrompt(cur?.prompt ?? null, clean);
    const { error } = await sb
      .from("videos")
      .update({ prompt: nextPrompt })
      .eq("id", videoId);
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro ao atualizar tags.",
    };
  }
}

export type DeleteVideoResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      supabase?: {
        message: string;
        details?: string | null;
        hint?: string | null;
        code?: string | null;
      };
    };

export async function deleteVideoAdminAction(
  videoId: string,
): Promise<DeleteVideoResult> {
  return await handleDeleteVideoAction(videoId);
}

export async function handleDeleteVideoAction(
  videoId: string,
): Promise<DeleteVideoResult> {
  try {
    await requireStaffSession();
    const service = getAdminSupabase();
    const userSb = await createClient();
    const sb = service ?? userSb;
    if (!sb) {
      return { ok: false, error: "Cliente Supabase indisponível." };
    }
    const { data: row, error: selErr } = await sb
      .from("videos")
      .select("id, video_url, thumbnail_url")
      .eq("id", videoId)
      .maybeSingle();
    if (selErr) {
      return {
        ok: false,
        error: selErr.message,
        supabase: {
          message: selErr.message,
          details: (selErr as unknown as { details?: string | null }).details,
          hint: (selErr as unknown as { hint?: string | null }).hint,
          code: (selErr as unknown as { code?: string | null }).code,
        },
      };
    }
    if (!row) {
      return { ok: false, error: "Vídeo não encontrado." };
    }

    // Prioridade: apaga a linha do banco primeiro.
    const { error: delErr } = await sb.from("videos").delete().eq("id", videoId);
    if (delErr) {
      return {
        ok: false,
        error: delErr.message,
        supabase: {
          message: delErr.message,
          details: (delErr as unknown as { details?: string | null }).details,
          hint: (delErr as unknown as { hint?: string | null }).hint,
          code: (delErr as unknown as { code?: string | null }).code,
        },
      };
    }

    // Depois, tenta limpar ficheiros do Storage (best-effort).
    const pathsToRemove: { bucket: string; path: string }[] = [];
    const vu = parseSupabaseStoragePublicUrl(
      String((row as { video_url?: unknown }).video_url ?? ""),
    );
    if (vu) pathsToRemove.push(vu);
    const pu = parseSupabaseStoragePublicUrl(
      String((row as { thumbnail_url?: unknown }).thumbnail_url ?? ""),
    );
    if (pu) pathsToRemove.push(pu);

    const uniq = new Map<string, { bucket: string; path: string }>();
    for (const p of pathsToRemove) uniq.set(`${p.bucket}:${p.path}`, p);

    const primaryBucket = storageBucketName();
    for (const { bucket, path } of uniq.values()) {
      if (
        bucket !== primaryBucket &&
        bucket !== LEGACY_SUPABASE_STORAGE_MEDIA_BUCKET
      ) {
        continue;
      }
      const { error: rmErr } = await sb.storage.from(bucket).remove([path]);
      if (rmErr) {
        console.warn(
          "[deleteVideoAdmin] falha ao remover objeto do Storage:",
          bucket,
          path,
          rmErr.message,
        );
      }
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro ao excluir vídeo.",
    };
  }
}

export type CategoryRow = { id: string; name: string };

export type ListCategoriesResult =
  | { ok: true; data: CategoryRow[] }
  | { ok: false; error: string };

export async function listCategoriesAction(): Promise<ListCategoriesResult> {
  try {
    await requireStaffSession();
    const service = getAdminSupabase();
    const userSb = await createClient();
    const sb = service ?? userSb;
    if (!sb) return { ok: false, error: "Cliente Supabase indisponível." };

    const { data, error } = await sb
      .from("categories")
      .select("id, name")
      .order("name", { ascending: true });
    if (error) return { ok: false, error: error.message };
    const rows = (data ?? []) as unknown as CategoryRow[];
    return { ok: true, data: rows };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao listar categorias." };
  }
}

export type ListAdminProfilesResult =
  | { ok: true; data: AdminProfileRow[] }
  | { ok: false; error: string };

export async function listAdminProfilesAction(): Promise<ListAdminProfilesResult> {
  try {
    await requireStaffSession();
    const service = getAdminSupabase();
    const userSb = await createClient();
    const sb = service ?? userSb;
    if (!sb) return { ok: false, error: "Cliente Supabase indisponível." };
    const { data, error } = await sb
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []).map(toAdminProfileRow) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao listar perfis." };
  }
}

export async function setProfileBannedAction(
  profileId: string,
  isBanned: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireStaffSession();
    const service = getAdminSupabase();
    const userSb = await createClient();
    const sb = service ?? userSb;
    if (!sb) return { ok: false, error: "Cliente Supabase indisponível." };
    const { error } = await sb
      .from("profiles")
      .update({ is_banned: isBanned })
      .eq("id", profileId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao atualizar perfil." };
  }
}

export async function adminAdjustDiamondsByProfileAction(
  profileId: string,
  delta: number,
): Promise<{ ok: true; newDiamonds: number } | { ok: false; error: string }> {
  try {
    const { user } = await requireStaffSession();
    const service = getAdminSupabase();
    const userSb = await createClient();
    const sb = service ?? userSb;
    if (!sb) return { ok: false, error: "Cliente Supabase indisponível." };
    const { data: profile, error: readError } = await sb
      .from("profiles")
      .select("diamonds")
      .eq("id", profileId)
      .maybeSingle();
    if (readError) return { ok: false, error: readError.message };
    const current = Number(profile?.diamonds ?? 0);
    const amount = Math.trunc(delta);
    const next = Math.max(0, current + amount);
    const { error: updateError } = await sb
      .from("profiles")
      .update({ diamonds: next })
      .eq("id", profileId);
    if (updateError) return { ok: false, error: updateError.message };
    await sb.from("diamond_transactions").insert({
      user_id: profileId,
      delta: amount,
      type: "admin_adjustment",
      created_by: user.id,
      payment_ref: null,
    });
    return { ok: true, newDiamonds: next };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao ajustar diamantes." };
  }
}

export type ListEconomyUsersResult =
  | { ok: true; data: EconomyUserRow[] }
  | { ok: false; error: string };

export async function listEconomyUsersAction(): Promise<ListEconomyUsersResult> {
  try {
    await requireStaffSession();
    const service = getAdminSupabase();
    const userSb = await createClient();
    const sb = service ?? userSb;
    if (!sb) return { ok: false, error: "Cliente Supabase indisponível." };
    const { data, error } = await sb
      .from("profiles")
      .select("id, email, diamonds")
      .order("email", { ascending: true });
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? []).map((row) => ({
        id: row.id,
        email: row.email ?? "",
        diamonds: Number(row.diamonds ?? 0),
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao listar utilizadores." };
  }
}

export async function adminAdjustDiamondsWithTransactionAction(
  profileId: string,
  delta: number,
): Promise<{ ok: true; newDiamonds: number } | { ok: false; error: string }> {
  return adminAdjustDiamondsByProfileAction(profileId, delta);
}

export type ListSupportMessagesResult =
  | { ok: true; data: SupportMessageRow[] }
  | { ok: false; error: string };

export async function listSupportMessagesAction(
  sessionId: string,
): Promise<ListSupportMessagesResult> {
  try {
    await requireStaffSession();
    const service = getAdminSupabase();
    const userSb = await createClient();
    const sb = service ?? userSb;
    if (!sb) return { ok: false, error: "Cliente Supabase indisponível." };
    const { data, error } = await sb
      .from("support_messages")
      .select("id, session_id, sender, body, created_at, is_admin, image_url")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as unknown as SupportMessageRow[] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao listar mensagens." };
  }
}

export async function postAdminSupportReplyAction(
  sessionId: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireStaffSession();
    const service = getAdminSupabase();
    const userSb = await createClient();
    const sb = service ?? userSb;
    if (!sb) return { ok: false, error: "Cliente Supabase indisponível." };
    const text = body.trim();
    if (!text) return { ok: false, error: "Mensagem vazia." };
    const { error } = await sb.from("support_messages").insert({
      session_id: sessionId,
      sender: "admin",
      is_admin: true,
      body: text,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao enviar resposta." };
  }
}
