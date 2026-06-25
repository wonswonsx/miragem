import { SubmitResultForm } from "@/app/admin/geracoes/SubmitResultForm";
import { isStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { Clock3, ImageOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PendingGeneration = {
  id: string;
  status: string | null;
  card_name: string | null;
  image_url: string | null;
  url_resultado: string | null;
  created_at: string | null;
  user_id: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AdminGeracoesPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isStaff(user)) redirect("/");

  const service = createServiceRoleClient();
  const sb = service ?? supabase;

  const { data, error } = await sb
    .from("generations" as never)
    .select("id, status, card_name, image_url, url_resultado, created_at, user_id")
    .eq("status", "pendente")
    .order("created_at", { ascending: true });

  const generations = ((data ?? []) as unknown as PendingGeneration[]).filter(
    (generation) => generation.status === "pendente",
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0f0614] via-[#1a0a24] to-[#120818] px-4 py-10 text-[#e8e0f0]">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/admin" className="text-sm font-medium text-violet-300 hover:text-violet-200">
              ← Voltar ao Admin
            </Link>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Gerações pendentes</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Envie a imagem final de cada pedido. Ao concluir, o usuário recebe a atualização em tempo real em Minhas Gerações.
            </p>
          </div>
          <div className="rounded-2xl border border-[rgba(147,112,219,0.25)] bg-black/30 px-4 py-3 text-sm text-violet-100">
            {generations.length} pedido(s) pendente(s)
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-950/30 p-4 text-sm text-rose-200">
            Erro ao carregar gerações: {error.message}
          </div>
        ) : null}

        {!error && generations.length === 0 ? (
          <section className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-[rgba(147,112,219,0.22)] bg-black/30 p-8 text-center shadow-2xl shadow-black/20">
            <div className="mb-5 rounded-full border border-violet-400/20 bg-violet-500/10 p-5">
              <ImageOff className="h-10 w-10 text-violet-200/80" />
            </div>
            <h2 className="text-xl font-semibold text-white">Nenhum pedido pendente</h2>
            <p className="mt-2 max-w-md text-sm text-zinc-400">
              Quando um usuário solicitar uma nova geração, ela aparecerá aqui para receber a imagem final.
            </p>
          </section>
        ) : null}

        {generations.length > 0 ? (
          <section className="grid gap-5 lg:grid-cols-2">
            {generations.map((generation) => {
              const previewUrl = generation.image_url;
              const profileName = generation.user_id || "Usuário";

              return (
                <article
                  key={generation.id}
                  className="overflow-hidden rounded-3xl border border-[rgba(147,112,219,0.22)] bg-[rgba(15,10,24,0.72)] shadow-2xl shadow-black/20 backdrop-blur"
                >
                  <div className="grid gap-0 md:grid-cols-[220px_1fr]">
                    <div className="relative min-h-[220px] bg-black/40">
                      {previewUrl ? (
                        <Image
                          src={previewUrl}
                          alt="Imagem enviada pelo usuário"
                          fill
                          sizes="(max-width: 768px) 100vw, 220px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-zinc-500">
                          Sem imagem
                        </div>
                      )}
                    </div>
                    <div className="space-y-5 p-5">
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full border border-yellow-400/25 bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-200">
                          <Clock3 className="h-3.5 w-3.5" />
                          Pendente
                        </div>
                        <h2 className="text-lg font-semibold text-white">{profileName}</h2>
                        <div className="grid gap-1 text-xs text-zinc-400">
                          <span>ID: {generation.id}</span>
                          <span>Criado em: {formatDate(generation.created_at)}</span>
                          {generation.card_name ? <span>Modelo: {generation.card_name}</span> : null}
                        </div>
                      </div>
                      <SubmitResultForm generationId={generation.id} />
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}
      </div>
    </main>
  );
}
