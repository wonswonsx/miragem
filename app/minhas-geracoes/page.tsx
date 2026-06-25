"use client";

import { DarkAppHeader } from "@/components/DarkAppHeader";
import { supabase } from "@/lib/supabaseClient";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  LoaderCircle,
  Sparkles,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface Generation {
  id: string;
  user_id: string;
  video_id: string;
  status: string;
  created_at: string;
  card_name?: string | null;
  video_url?: string | null;
  url_resultado?: string | null;
  url_final?: string | null;
  result_url?: string | null;
  thumbnail_url?: string | null;
  diamond_cost?: number;
  mode?: string;
  type?: string;
  audio_enabled?: boolean;
}

const GENERATIONS_LIMIT = 100;
const POLL_MS = 10000;

function sortGenerationsDesc(rows: Generation[]): Generation[] {
  return [...rows].sort(
    (a, b) =>
      new Date(b.created_at ?? 0).getTime() -
      new Date(a.created_at ?? 0).getTime(),
  );
}

function statusConfig(status: string) {
  switch (status) {
    case "concluido":
    case "completed":
      return {
        label: "Concluído",
        icon: CheckCircle2,
        color: "text-green-400",
        bg: "bg-green-500/10 border-green-500/30",
      };
    case "processando":
    case "processing":
      return {
        label: "Processando",
        icon: LoaderCircle,
        color: "text-blue-400",
        bg: "bg-blue-500/10 border-blue-500/30",
        spin: true,
      };
    case "falhou":
    case "failed":
      return {
        label: "Falhou",
        icon: AlertTriangle,
        color: "text-red-400",
        bg: "bg-red-500/10 border-red-500/30",
      };
    default:
      return {
        label: "Pendente",
        icon: Clock,
        color: "text-yellow-400",
        bg: "bg-yellow-500/10 border-yellow-500/30",
      };
  }
}

function resultUrl(gen: Generation): string {
  return (
    gen.url_resultado ||
    gen.url_final ||
    gen.result_url ||
    gen.video_url ||
    ""
  );
}

export default function MinhasGeracoesPage() {
  const router = useRouter();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGenerations = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      router.push("/login?next=%2Fminhas-geracoes");
      return null;
    }

    const { data, error } = await supabase
      .from("generations" as never)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(GENERATIONS_LIMIT);

    if (error) {
      console.error("Erro ao buscar gerações:", error);
      return user.id;
    }

    setGenerations(sortGenerationsDesc((data as unknown as Generation[]) ?? []));
    return user.id;
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    let channelRef: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      const userId = await loadGenerations();
      if (cancelled) return;
      setLoading(false);
      if (!userId) return;

      const channel = supabase
        .channel(`my-generations-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "generations",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            if (!cancelled) void loadGenerations();
          },
        )
        .subscribe();

      channelRef = channel;
    };

    void init();

    const pollId = window.setInterval(() => {
      if (!cancelled) void loadGenerations();
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible" && !cancelled) {
        void loadGenerations();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      document.removeEventListener("visibilitychange", onVisible);
      if (channelRef) void supabase.removeChannel(channelRef);
    };
  }, [loadGenerations]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f0614] via-[#1a0a24] to-[#120818]">
        <DarkAppHeader />
        <div className="flex items-center justify-center pt-[200px]">
          <LoaderCircle className="h-10 w-10 animate-spin text-violet-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0614] via-[#1a0a24] to-[#120818] text-[#e8e0f0]">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(147,112,219,0.18), transparent),
            radial-gradient(ellipse 60% 80% at 100% 50%, rgba(138,43,226,0.10), transparent),
            linear-gradient(180deg, #0f0614 0%, #1a0a24 30%, #120818 100%)`,
        }}
        aria-hidden
      />

      <DarkAppHeader />

      <main className="mx-auto flex w-full max-w-lg flex-col px-4 pt-[120px] pb-[max(5rem,env(safe-area-inset-bottom))] sm:max-w-2xl sm:pt-[110px] lg:max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex min-h-10 touch-manipulation items-center gap-1.5 rounded-lg border border-[rgba(147,112,219,0.25)] bg-[rgba(15,10,24,0.6)] px-3 py-2 text-sm text-zinc-400 backdrop-blur transition hover:border-violet-500/50 hover:text-zinc-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Minhas Gerações
          </h1>
        </div>

        {generations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[rgba(147,112,219,0.2)] bg-[rgba(15,10,24,0.5)] px-6 py-16 text-center backdrop-blur-md">
            <Sparkles className="mb-4 h-12 w-12 text-violet-400/60" />
            <h2 className="mb-2 text-lg font-semibold text-white">
              Nenhuma geração ainda
            </h2>
            <p className="mb-6 max-w-sm text-sm text-zinc-400">
              Escolha um modelo na página inicial para criar sua primeira
              geração.
            </p>
            <Link
              href="/"
              className="min-h-11 touch-manipulation rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-sm font-medium text-white transition hover:from-violet-700 hover:to-fuchsia-700"
            >
              Explorar modelos
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {generations.map((gen) => {
              const cfg = statusConfig(gen.status);
              const StatusIcon = cfg.icon;
              const isPending =
                gen.status === "pendente" ||
                gen.status === "pending" ||
                gen.status === "processing" ||
                gen.status === "processando";
              const isCompleted =
                gen.status === "concluido" || gen.status === "completed";
              const url = resultUrl(gen);

              return (
                <article
                  key={gen.id}
                  className="flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[rgba(147,112,219,0.2)] bg-[rgba(15,10,24,0.55)] backdrop-blur-md"
                >
                  <div className="relative aspect-[9/16] max-h-72 w-full overflow-hidden bg-black/40 sm:max-h-none">
                    {isCompleted && url ? (
                      /\.(mp4|webm|mov|avi)(\?|$)/i.test(url) ? (
                        <video
                          src={url}
                          className="h-full w-full object-cover"
                          muted
                          loop
                          playsInline
                          controls
                        />
                      ) : (
                        <img
                          src={url}
                          alt="Resultado"
                          className="h-full w-full object-cover"
                        />
                      )
                    ) : (
                      <div className="flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-violet-900/20 to-fuchsia-900/20 p-5">
                        {isPending ? (
                          <>
                            <LoaderCircle className="h-10 w-10 animate-spin text-violet-400" />
                            <p className="text-center text-sm font-semibold text-violet-100">
                              Aguarde, processando seu vídeo...
                            </p>
                            <p className="text-center text-xs text-zinc-500">
                              Você será avisado quando estiver pronto.
                            </p>
                          </>
                        ) : (
                          <>
                            <StatusIcon
                              className={`h-8 w-8 ${cfg.color} ${cfg.spin ? "animate-spin" : ""}`}
                            />
                            <p className={`text-sm font-medium ${cfg.color}`}>
                              {cfg.label}
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-col gap-3 p-4">
                    {gen.card_name ? (
                      <h2 className="line-clamp-2 text-sm font-semibold text-white">
                        {gen.card_name}
                      </h2>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.color}`}
                      >
                        <StatusIcon
                          className={`h-3 w-3 ${cfg.spin ? "animate-spin" : ""}`}
                        />
                        {cfg.label}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {new Date(gen.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs text-violet-400">
                      {gen.diamond_cost ? (
                        <span>
                          {(gen.type ?? gen.mode) === "estendido"
                            ? "Estendida"
                            : "Padrão"}{" "}
                          · {gen.diamond_cost} 💎
                        </span>
                      ) : null}
                      {gen.audio_enabled ? (
                        <span className="inline-flex items-center gap-1 text-amber-300/90">
                          <Volume2 className="h-3 w-3" />
                          Com som
                        </span>
                      ) : null}
                    </div>

                    {isCompleted && url ? (
                      <div className="flex flex-col gap-2">
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 px-3 py-2.5 text-sm font-medium text-white transition hover:from-violet-600 hover:to-fuchsia-700"
                        >
                          <Eye className="h-4 w-4" />
                          Ver resultado
                        </a>
                        <a
                          href={url}
                          download
                          className="flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20"
                        >
                          <Download className="h-4 w-4" />
                          Baixar
                        </a>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
