"use client";

import type { DeliverPedidoVideoState } from "@/app/admin/pedidos/actions";
import type { AdminPedido } from "@/app/admin/pedidos/AdminPedidosTicketClient";
import {
  AudioBadge,
  GenerationTypeBadge,
  StatusBadge,
} from "@/components/admin/AdminPedidoBadges";
import { AssignedToCell } from "@/components/admin/AssignedToCell";
import { getGenerationTypeLabel } from "@/lib/adminStaffDisplay";
import { createClient } from "@/lib/supabase/client";
import {
  CheckCircle2,
  Download,
  ImageIcon,
  Link2,
  LoaderCircle,
  Settings,
  UploadCloud,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useId, useRef, useState } from "react";

export type TicketCardPanelProps = {
  pedido: AdminPedido;
  onSubmit: (event: FormEvent<HTMLFormElement>, pedido: AdminPedido) => void;
  isSubmitting: boolean;
  feedback?: DeliverPedidoVideoState | null;
  onClose?: () => void;
  /** true = dentro do modal; false = card inline na lista */
  modal?: boolean;
  assigning?: boolean;
  onAssign?: (pedidoId: string) => void;
};

function getPedidoTitle(pedido: AdminPedido) {
  return pedido.card_name?.trim() || "Pedido sem nome";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function TicketCardPanel({
  pedido,
  onSubmit,
  isSubmitting,
  feedback,
  onClose,
  modal = false,
  assigning = false,
  onAssign,
}: TicketCardPanelProps) {
  const uploadId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cardPreviewUrl, setCardPreviewUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"video" | "extend">("video");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const clientImage = pedido.image_url;
  const title = getPedidoTitle(pedido);
  const costLabel =
    pedido.diamond_cost != null && pedido.diamond_cost > 0
      ? `${pedido.diamond_cost} créditos`
      : "Entrega admin";

  const badges = [
    pedido.user_id ? `@${pedido.user_id.slice(0, 8)}` : null,
    `#${pedido.id.slice(0, 8)}`,
  ].filter(Boolean) as string[];

  useEffect(() => {
    let cancelled = false;
    const name = pedido.card_name?.trim();
    if (!name) {
      setCardPreviewUrl(null);
      return;
    }

    (async () => {
      try {
        const sb = createClient();
        const { data } = await sb
          .from("videos" as never)
          .select("thumbnail_url")
          .ilike("title", `%${name}%`)
          .limit(1)
          .maybeSingle();

        if (cancelled) return;
        const row = data as { thumbnail_url?: string | null } | null;
        setCardPreviewUrl(row?.thumbnail_url ?? null);
      } catch {
        if (!cancelled) setCardPreviewUrl(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pedido.card_name]);

  return (
    <form
      onSubmit={(e) => onSubmit(e, pedido)}
      className={`flex w-full max-w-full flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#0b0f19] text-white shadow-2xl ${
        modal ? "max-h-[min(92dvh,100%)]" : ""
      }`}
    >
      {/* Cabeçalho fixo no topo do card */}
      <div className="shrink-0 border-b border-zinc-800/80 p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-lg font-bold tracking-wide sm:text-xl">{title}</h3>
              <Link2 className="h-4 w-4 shrink-0 text-blue-400" aria-hidden />
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">{formatDate(pedido.created_at)}</p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-300"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <GenerationTypeBadge type={pedido.type} mode={pedido.mode} />
          <AudioBadge enabled={pedido.audio_enabled} />
          <StatusBadge status={pedido.status} />
          {badges.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-300"
            >
              {tag}
            </span>
          ))}
        </div>

        {onAssign ? (
          <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
            <AssignedToCell
              pedido={pedido}
              assigning={assigning}
              onAssign={onAssign}
            />
          </div>
        ) : null}

        <p className="mt-2 text-[11px] text-zinc-500">
          {getGenerationTypeLabel(pedido.type, pedido.mode)}
          {pedido.audio_enabled ? " · com áudio solicitado" : ""}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("video")}
            className={`min-h-10 touch-manipulation rounded-full px-3 py-2 text-xs font-semibold ${
              activeTab === "video" ? "bg-white text-black shadow" : "bg-zinc-800 text-zinc-300"
            }`}
          >
            <span className="flex items-center gap-1">
              <UploadCloud className="h-3.5 w-3.5" />
              Vídeo final
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("extend")}
            className={`min-h-10 touch-manipulation rounded-full px-3 py-2 text-xs font-semibold ${
              activeTab === "extend" ? "bg-white text-black shadow" : "bg-zinc-800 text-zinc-300"
            }`}
          >
            ▶ Estender vídeo
          </button>
        </div>
      </div>

      {/* Corpo com scroll quando modal */}
      <div className={`min-h-0 flex-1 space-y-3 p-4 pt-3 ${modal ? "overflow-y-auto overscroll-contain" : ""}`}>
        {activeTab === "extend" ? (
          <p className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-400">
            Modo estendido: use &quot;Vídeo final&quot; para entregar o resultado deste pedido.
          </p>
        ) : null}

        {/* Grid 2 colunas — altura fixa para caber em qualquer tela */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="relative h-[clamp(7.5rem,38vw,11rem)] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            {cardPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cardPreviewUrl} alt="Preview do card" className="size-full object-cover" />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-[10px] text-zinc-500">
                <ImageIcon className="h-5 w-5" />
                Modelo
              </div>
            )}
            <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] text-zinc-300">
              Modelo
            </span>
          </div>

          <div className="flex h-[clamp(7.5rem,38vw,11rem)] flex-col justify-between gap-2">
            <label
              htmlFor={uploadId}
              className="relative flex min-h-0 flex-1 cursor-pointer flex-col overflow-hidden rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 active:border-violet-400"
            >
              {clientImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={clientImage}
                  alt="Foto do cliente"
                  className="absolute inset-0 size-full object-cover opacity-85"
                />
              ) : null}
              <div className="absolute inset-0 flex items-center justify-center bg-black/45 p-2">
                <span className="rounded-full border border-white/25 bg-white/20 px-3 py-1.5 text-center text-[11px] font-semibold leading-tight text-white">
                  {selectedFileName ? selectedFileName : "Fazer upload"}
                </span>
              </div>
              <input
                id={uploadId}
                ref={fileInputRef}
                type="file"
                name="videoFile"
                accept="video/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setSelectedFileName(f?.name ?? null);
                }}
              />
            </label>

            <div className="flex shrink-0 items-end justify-between gap-1">
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Custo</p>
                <p className="truncate text-xs font-semibold text-white">{costLabel}</p>
              </div>
              {clientImage ? (
                <a
                  href={clientImage}
                  download
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-zinc-300"
                  title="Baixar original"
                >
                  <Download className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </div>
        </div>

        {feedback?.message ? (
          <div
            className={`rounded-xl border p-2.5 text-xs ${
              feedback.ok
                ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                : "border-rose-400/25 bg-rose-500/10 text-rose-200"
            }`}
          >
            {feedback.message}
          </div>
        ) : null}
      </div>

      {/* Rodapé fixo — sempre visível */}
      <div className="shrink-0 border-t border-zinc-800 bg-[#0b0f19] p-4 pt-3">
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSubmitting || activeTab === "extend"}
            className="flex min-h-12 flex-1 touch-manipulation items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black shadow disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Entregando…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Entregar pedido
              </>
            )}
          </button>
          <button
            type="button"
            className="flex h-12 w-12 shrink-0 touch-manipulation items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-zinc-300"
            title="Selecionar vídeo"
            onClick={() => fileInputRef.current?.click()}
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          className="mt-2 flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-violet-500/40 bg-violet-600/20 text-sm font-medium text-violet-100"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadCloud className="h-4 w-4" />
          Escolher arquivo de vídeo
        </button>
      </div>
    </form>
  );
}
