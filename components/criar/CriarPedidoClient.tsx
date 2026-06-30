"use client";

import {
  computeTotalDiamondCost,
  fileAcceptForTab,
  GENERATION_COST_AUDIO,
  GENERATION_COST_BASE,
  GENERATION_COST_EXTENDED,
  type GenerationClientTab,
} from "@/lib/generationInsert";
import { getItemTitle, getStreamUrl, type MediaItem } from "@/lib/mirageMedia";
import { submitGeneration } from "@/lib/submitGeneration";
import {
  ArrowLeft,
  Gem,
  LoaderCircle,
  Sparkles,
  UploadCloud,
  Volume2,
  VolumeX,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

type Props = {
  model: MediaItem;
};

function CriarPedidoSkeleton({ title }: { title: string }) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[108px] sm:pt-[100px]">
      <div
        aria-hidden
        className="mb-5 h-10 w-24 animate-pulse rounded-lg bg-[rgba(147,112,219,0.15)]"
      />
      <header className="mb-6 space-y-2">
        <div className="h-3 w-28 animate-pulse rounded bg-violet-400/20" />
        <div className="h-8 w-2/3 max-w-md animate-pulse rounded bg-white/10" />
      </header>
      <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-2">
        <article className="flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[rgba(147,112,219,0.12)] bg-[rgba(25,12,38,0.9)]">
          <div className="aspect-[9/16] w-full animate-pulse bg-[rgba(20,10,30,0.95)]" />
          <div className="space-y-2 px-3 py-3">
            <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-white/5" />
          </div>
        </article>
        <div className="flex min-w-0 flex-col gap-5">
          <div className="aspect-[16/9] max-h-48 animate-pulse rounded-2xl bg-[rgba(20,10,30,0.95)]" />
          <div className="h-28 animate-pulse rounded-xl bg-[rgba(25,12,38,0.9)]" />
          <div className="h-20 animate-pulse rounded-xl bg-[rgba(25,12,38,0.9)]" />
          <div className="h-14 animate-pulse rounded-2xl bg-violet-600/30" />
        </div>
      </div>
      <span className="sr-only">Carregando criação: {title}</span>
    </main>
  );
}

export function CriarPedidoClient({ model }: Props) {
  const router = useRouter();
  const uploadId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<GenerationClientTab>("image");
  const [hasAudio, setHasAudio] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const custoBase = GENERATION_COST_BASE;
  const custoEstendido = GENERATION_COST_EXTENDED;
  const custoAudio = GENERATION_COST_AUDIO;
  const custoModo = activeTab === "extend" ? custoEstendido : custoBase;
  const custoTotal = computeTotalDiamondCost(activeTab, hasAudio);

  const accept = fileAcceptForTab(activeTab);
  const isVideoPreview =
    uploadFile?.type.startsWith("video/") || uploadFile?.type === "image/gif";
  const modelTitle = getItemTitle(model);
  const modelStreamUrl = getStreamUrl(model);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!uploadFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(uploadFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [uploadFile]);

  const resetFile = () => {
    setUploadFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleTabChange = (tab: GenerationClientTab) => {
    setActiveTab(tab);
    resetFile();
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const result = await submitGeneration({
        item: model,
        tab: activeTab,
        hasAudio,
        file: uploadFile,
        totalCost: custoTotal,
      });

      if (!result.ok) {
        if (result.code === "auth") {
          router.push(
            `/login?next=${encodeURIComponent(`/criar/${model.id}`)}`,
          );
          return;
        }
        setError(result.error);
        return;
      }

      router.push("/minhas-geracoes");
    } catch (err) {
      console.error("[CriarPedido] erro:", err);
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isMounted) {
    return <CriarPedidoSkeleton title={modelTitle} />;
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[108px] sm:pt-[100px]">
      <Link
        href="/"
        className="mb-5 inline-flex min-h-10 w-fit touch-manipulation items-center gap-1.5 rounded-lg border border-[rgba(147,112,219,0.25)] bg-[rgba(15,10,24,0.6)] px-3 py-2 text-sm text-zinc-400 backdrop-blur transition hover:border-violet-500/50 hover:text-zinc-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </Link>

      <header className="mb-6 space-y-1">
        <div className="text-xs font-medium uppercase tracking-wide text-violet-400/80">
          Criar geração
        </div>
        <h1 className="text-xl font-bold leading-tight text-white sm:text-2xl md:text-3xl">
          {modelTitle}
        </h1>
      </header>

      <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-2">
        {/* Esquerda — modelo de referência (card grande, estilo Home) */}
        <article className="mirage-explore-card flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[rgba(147,112,219,0.12)] bg-[rgba(25,12,38,0.9)] shadow-none">
          <div className="relative aspect-[9/16] w-full overflow-hidden bg-[rgba(20,10,30,0.95)]">
            {modelStreamUrl ? (
              <video
                src={modelStreamUrl}
                poster={model.absolutePosterUrl?.trim() || undefined}
                className="absolute inset-0 h-full w-full object-cover"
                muted
                loop
                playsInline
                autoPlay
                preload="metadata"
              />
            ) : (
              <div className="absolute inset-0 bg-[rgba(20,10,30,0.95)]" />
            )}
            <span className="absolute left-2 top-2 z-10 rounded-md bg-black/70 px-2 py-0.5 text-[10px] text-zinc-300">
              Modelo de referência
            </span>
          </div>
          <div className="flex min-h-0 flex-col px-3 py-3 max-sm:px-2.5 max-sm:py-2.5">
            <h3 className="mb-1 line-clamp-2 text-[0.95rem] font-semibold leading-snug text-[#e8e0f0]">
              {modelTitle}
            </h3>
            <div className="text-[0.8rem] text-[rgba(232,224,240,0.6)]">
              @MirageFantasy
            </div>
          </div>
        </article>

        {/* Direita — upload compacto + controles */}
        <div className="flex min-w-0 flex-col gap-5">
          <div className="overflow-hidden rounded-2xl border border-[rgba(147,112,219,0.12)] bg-[rgba(25,12,38,0.9)]">
            <label
              htmlFor={uploadId}
              className="group/upload relative block aspect-[16/9] max-h-40 w-full cursor-pointer overflow-hidden bg-[rgba(20,10,30,0.95)] sm:max-h-48"
            >
              {previewUrl ? (
                isVideoPreview ? (
                  <video
                    src={previewUrl}
                    className="absolute inset-0 h-full w-full object-cover"
                    muted
                    loop
                    playsInline
                    autoPlay
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Preview do seu arquivo"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
                  <UploadCloud className="h-8 w-8 text-violet-400/80 transition group-hover/upload:scale-105" />
                  <div className="text-xs font-semibold text-[#e8e0f0] sm:text-sm">
                    {activeTab === "extend"
                      ? "Toque para enviar vídeo ou GIF"
                      : "Toque para enviar sua imagem"}
                  </div>
                </div>
              )}

              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-6">
                <div className="truncate text-xs font-semibold text-white">
                  {uploadFile
                    ? uploadFile.name
                    : activeTab === "extend"
                      ? "Enviar vídeo ou GIF"
                      : "Enviar imagem"}
                </div>
              </div>

              <input
                id={uploadId}
                key={activeTab}
                ref={fileInputRef}
                type="file"
                accept={accept}
                className="sr-only"
                onChange={(e) => {
                  setUploadFile(e.target.files?.[0] ?? null);
                  setError(null);
                }}
              />
            </label>

            <div className="flex items-center justify-between gap-2 border-t border-[rgba(147,112,219,0.12)] px-3 py-2.5">
              <div className="truncate text-[0.75rem] text-[rgba(232,224,240,0.6)]">
                {uploadFile ? "Arquivo selecionado" : "Seu arquivo"}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 touch-manipulation rounded-lg border border-[rgba(147,112,219,0.35)] bg-[rgba(147,112,219,0.2)] px-3 py-1.5 text-[0.75rem] font-semibold text-[#e8e0f0] transition hover:bg-[rgba(147,112,219,0.35)]"
              >
                Escolher
              </button>
            </div>
          </div>

          <div>
            <div className="mb-3 text-sm font-medium text-zinc-300">
              Modo de geração
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleTabChange("image")}
                className={`min-h-12 touch-manipulation rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                  activeTab === "image"
                    ? "bg-white text-black shadow"
                    : "border border-[rgba(147,112,219,0.25)] bg-[rgba(25,12,38,0.9)] text-[#e8e0f0]"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  Geração Normal (Imagem)
                </span>
                <span className="mt-0.5 block text-xs font-normal opacity-80">
                  {custoBase} 💎 · aceita imagens
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("extend")}
                className={`min-h-12 touch-manipulation rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                  activeTab === "extend"
                    ? "bg-white text-black shadow"
                    : "border border-[rgba(147,112,219,0.25)] bg-[rgba(25,12,38,0.9)] text-[#e8e0f0]"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Gem className="h-4 w-4 shrink-0" />
                  Geração Estendida (Vídeo/GIF)
                </span>
                <span className="mt-0.5 block text-xs font-normal opacity-80">
                  {custoEstendido} 💎 · aceita vídeo ou GIF
                </span>
              </button>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={hasAudio}
            onClick={() => setHasAudio((v) => !v)}
            className={`flex min-h-[4.5rem] w-full touch-manipulation items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
              hasAudio
                ? "border-amber-400/50 bg-amber-500/10"
                : "border-[rgba(147,112,219,0.25)] bg-[rgba(15,10,24,0.55)]"
            }`}
          >
            <span className="min-w-0 flex-1">
              <span
                className={`block text-sm font-semibold ${hasAudio ? "text-amber-100" : "text-white"}`}
              >
                🔊 Adicionar Som (+{custoAudio} diamantes)
              </span>
              <span className="mt-0.5 block text-xs text-zinc-400">
                {hasAudio
                  ? "Som ativado — custo extra incluído no total"
                  : "Toque para incluir áudio no vídeo final"}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span
                className={`relative inline-block h-8 w-14 rounded-full transition ${hasAudio ? "bg-amber-500" : "bg-zinc-700"}`}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${hasAudio ? "left-7" : "left-1"}`}
                />
              </span>
              {hasAudio ? (
                <Volume2 className="h-5 w-5 text-amber-300" />
              ) : (
                <VolumeX className="h-5 w-5 text-zinc-500" />
              )}
            </span>
          </button>

          <div className="rounded-xl border border-[rgba(147,112,219,0.25)] bg-[rgba(15,10,24,0.55)] px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-zinc-400">Custo total</span>
              <span className="text-lg font-bold text-violet-300">
                {custoTotal} 💎
              </span>
            </div>
            <div className="mt-2 space-y-1 text-xs text-zinc-500">
              <div>
                {activeTab === "extend" ? "Estendida" : "Normal"}: {custoModo}{" "}
                💎
              </div>
              {hasAudio ? <div>Som: +{custoAudio} 💎</div> : null}
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmit()}
            className="flex min-h-14 w-full touch-manipulation items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-base font-bold text-white shadow-[0_4px_14px_rgba(233,30,140,0.35)] transition hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <LoaderCircle className="h-5 w-5 animate-spin" />
                Processando…
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Gerar ({custoTotal} 💎)
              </>
            )}
          </button>
        </div>
      </div>
    </main>
  );
}
