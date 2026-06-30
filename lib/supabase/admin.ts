import "server-only";
import type { Database } from "@/lib/database.types";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service Role — só em Server Actions / Route Handlers / Server Components.
 * Nunca importe isto em arquivos `"use client"`.
 * Nunca exponha SUPABASE_SERVICE_ROLE_KEY ao browser (não use NEXT_PUBLIC_).
 */
export function createAdminClient(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Helper que lança um erro claro se a Service Role não estiver configurada.
 * Use em Server Actions onde o admin é obrigatório (ex.: ajustar diamantes,
 * concluir pedidos). Garante que o caller recebe `Error` com mensagem útil.
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  const client = createAdminClient();
  if (!client) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor. Defina a variável de ambiente em produção (Vercel) e em .env.local para que as Server Actions de admin funcionem.",
    );
  }
  return client;
}

/**
 * Singleton lazy para uso direto: `supabaseAdmin.from('profiles')...`
 * Apenas em código de servidor (este arquivo é `server-only`).
 */
let _cached: SupabaseClient<Database> | null = null;
export const supabaseAdmin: SupabaseClient<Database> = new Proxy(
  {} as SupabaseClient<Database>,
  {
    get(_target, prop, receiver) {
      if (!_cached) _cached = getSupabaseAdmin();
      const value = Reflect.get(_cached, prop, receiver);
      return typeof value === "function" ? value.bind(_cached) : value;
    },
  },
);
