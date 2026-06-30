import { AdminPainelClient, type PendingGeneration } from "@/app/admin/painel/AdminPainelClient";
import { isStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPainelPage() {
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
    .select(
      "id, status, card_name, image_url, url_resultado, created_at, user_id",
    )
    .or("status.eq.pendente,status.is.null")
    .order("created_at", { ascending: true });

  const generations = ((data ?? []) as unknown as PendingGeneration[]).filter(
    (generation) => generation.status === "pendente" || generation.status == null,
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(147,51,234,0.22),transparent_32%),linear-gradient(135deg,#0b0611_0%,#13091c_45%,#08050d_100%)] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 backdrop-blur sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/admin" className="text-sm font-semibold text-violet-300 transition hover:text-violet-200">
              ← Voltar ao Admin
            </Link>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-violet-300">
              Central de Atendimento
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Entrega de Gerações Miragem
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              Selecione um pedido pendente, confira a imagem original e envie o vídeo final para liberar o botão de download do usuário.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center sm:min-w-[260px]">
            <div className="rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-4">
              <div className="text-2xl font-bold text-yellow-100">{generations.length}</div>
              <div className="text-xs text-yellow-200/75">pendentes</div>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
              <div className="text-2xl font-bold text-emerald-100">.mp4</div>
              <div className="text-xs text-emerald-200/75">entrega</div>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-4 text-sm text-rose-200">
            Erro ao carregar pedidos: {error.message}
          </div>
        ) : null}

        <AdminPainelClient generations={generations} />
      </div>
    </main>
  );
}
