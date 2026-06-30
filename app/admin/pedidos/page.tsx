import { isStaff } from "@/lib/auth/staff";
import {
  ADMIN_PEDIDOS_FETCH_LIMIT,
  ADMIN_PEDIDOS_SELECT,
  filterAdminQueuePedidos,
  sortPedidosByCreatedAtDesc,
} from "@/lib/adminPedidosQuery";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AdminPedidosTicketClient,
  type AdminPedido,
} from "./AdminPedidosTicketClient";

export const dynamic = "force-dynamic";

export default async function AdminPedidosPage() {
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
    .select(ADMIN_PEDIDOS_SELECT)
    .order("created_at", { ascending: false })
    .limit(ADMIN_PEDIDOS_FETCH_LIMIT);

  const pedidos = sortPedidosByCreatedAtDesc(
    filterAdminQueuePedidos((data ?? []) as unknown as AdminPedido[]),
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(147,51,234,0.24),transparent_34%),linear-gradient(135deg,#09060f_0%,#170b20_48%,#08050d_100%)] px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30 backdrop-blur sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/admin" className="text-sm font-bold text-violet-300 transition hover:text-violet-200">
              ← Voltar ao Admin
            </Link>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.28em] text-violet-300">
              Admin Miragem
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Pedidos
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              Central de trabalho para revisar a foto enviada pelo cliente e subir o vídeo final.
            </p>
          </div>
          <div className="rounded-2xl border border-yellow-400/20 bg-yellow-500/10 px-5 py-4 text-center">
            <div className="text-2xl font-black text-yellow-100">{pedidos.length}</div>
            <div className="text-xs font-medium text-yellow-200/75">pendentes</div>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-4 text-sm text-rose-200">
            Erro ao carregar pedidos: {error.message}
          </div>
        ) : null}

        <AdminPedidosTicketClient pedidos={pedidos} />
      </div>
    </main>
  );
}
