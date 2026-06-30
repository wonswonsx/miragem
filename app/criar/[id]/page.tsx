import { CriarPedidoClient } from "@/components/criar/CriarPedidoClient";
import { DarkAppHeader } from "@/components/DarkAppHeader";
import { createClient } from "@/lib/supabase/server";
import { videoRowToMediaItem } from "@/lib/videoRowToMediaItem";
import type { VideoRow } from "@/types/database";
import { notFound, redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CriarPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  if (!supabase) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/criar/${id}`)}`);
  }

  const { data: video, error } = await supabase
    .from("videos")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !video) notFound();

  const model = videoRowToMediaItem(video as VideoRow);
  if (!model) notFound();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0614] via-[#1a0a24] to-[#120818] text-[#e8e0f0]">
      <DarkAppHeader />
      <CriarPedidoClient model={model} />
    </div>
  );
}
