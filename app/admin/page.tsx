import { isStaff } from "@/lib/auth/staff";
import {
  ADMIN_PEDIDOS_FETCH_LIMIT,
  ADMIN_PEDIDOS_SELECT,
  filterAdminQueuePedidos,
  sortPedidosByCreatedAtDesc,
} from "@/lib/adminPedidosQuery";
import type { AdminPedido } from "@/app/admin/pedidos/AdminPedidosTicketClient";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { redirect } from "next/navigation";
import { AdminTabs } from "@/app/admin/components/AdminTabs";
import { toAdminProfileRow } from "@/lib/adminProfileRow";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  if (!supabase) {
    redirect("/");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isStaff(user)) {
    redirect("/");
  }

  const service = createServiceRoleClient();
  const sb = service ?? supabase;

  // Buscar dados iniciais
  const [videosRes, profilesRes, generationsRes] = await Promise.all([
    sb
      .from("videos")
       
      .select("id, title, video_url, thumbnail_url, prompt, video_tags!inner(tags!inner(name))")
      .order("id", { ascending: false }),
    sb.from("profiles").select("*").order("created_at", { ascending: false }),
    sb
      .from("generations" as never)
      .select(ADMIN_PEDIDOS_SELECT)
      .order("created_at", { ascending: false })
      .limit(ADMIN_PEDIDOS_FETCH_LIMIT),
  ]);

  const videos = videosRes.data || [];
  const profiles = (profilesRes.data ?? []).map(toAdminProfileRow);
  const generations = sortPedidosByCreatedAtDesc(
    filterAdminQueuePedidos(
      (generationsRes.data ?? []) as unknown as AdminPedido[],
    ),
  );

  return <AdminTabs initialVideos={videos} initialProfiles={profiles} initialGenerations={generations} />;
}
