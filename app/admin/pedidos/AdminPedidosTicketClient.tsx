"use client";

import { assignPedidoAction, deliverPedidoVideoAction, type DeliverPedidoVideoState } from "@/app/admin/pedidos/actions";
import { TicketCardPanel } from "@/app/admin/pedidos/TicketCardPanel";
import {
  AudioBadge,
  GenerationTypeBadge,
  StatusBadge,
} from "@/components/admin/AdminPedidoBadges";
import { AssignedToCell } from "@/components/admin/AssignedToCell";
import {
  formatAdminNewOrderMessage,
  isPendingGenerationStatus,
} from "@/lib/adminNewOrderMessage";
import {
  mergeAdminPedidoLists,
  mergePedidoIntoList,
  sortPedidosByCreatedAtDesc,
} from "@/lib/adminPedidosQuery";
import { playNotificationSound } from "@/lib/playNotificationSound";
import {
  type AdminAssignFilter,
  filterPedidosByAssignment,
  getAdminDisplayLabel,
} from "@/lib/adminStaffDisplay";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, Download, ImageIcon, LoaderCircle, Search, UploadCloud } from "lucide-react";
import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

export type AdminPedido = {
  id: string;
  status: string | null;
  card_name: string | null;
  image_url: string | null;
  url_resultado: string | null;
  created_at: string | null;
  user_id: string | null;
  diamond_cost?: number | null;
  type?: string | null;
  mode?: string | null;
  audio_enabled?: boolean | null;
  assigned_to?: string | null;
};

const initialState: DeliverPedidoVideoState = {
  ok: false,
  message: "",
};

function SubmitButton({ pending, mobile }: { pending: boolean; mobile?: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex w-full touch-manipulation items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 font-bold text-white shadow-lg shadow-violet-950/40 transition hover:from-violet-500 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60 ${
        mobile ? "h-10 shrink-0 px-2 text-[11px]" : "h-12 gap-2 px-5 text-sm"
      }`}
    >
      {pending ? (
        <LoaderCircle className={mobile ? "h-3.5 w-3.5 animate-spin" : "h-4 w-4 animate-spin"} />
      ) : (
        <CheckCircle2 className={mobile ? "h-3.5 w-3.5 shrink-0" : "h-4 w-4"} />
      )}
      {pending ? "Enviando…" : mobile ? "Finalizar" : "Finalizar e Entregar"}
    </button>
  );
}

type AssignFilter = AdminAssignFilter;

const ASSIGN_FILTERS: { id: AssignFilter; label: string }[] = [
  { id: "all", label: "Todos os Pedidos" },
  { id: "mine", label: "Meus Pedidos" },
  { id: "unassigned", label: "Pedidos Sem Dono" },
];

function getPedidoTitle(pedido: AdminPedido) {
  return pedido.card_name?.trim() || "Pedido sem nome";
}

function getClienteImage(pedido: AdminPedido) {
  return pedido.image_url || null;
}

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function formatDate(value: string | null) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

type PedidoFormProps = {
  pedido: AdminPedido;
  isSubmitting: boolean;
  feedback?: DeliverPedidoVideoState | null;
  onSubmit: (event: FormEvent<HTMLFormElement>, pedido: AdminPedido) => void;
  compact?: boolean;
  /** Coluna estreita ao lado da miniatura no celular */
  mobile?: boolean;
};

function PedidoDeliveryForm({
  pedido,
  isSubmitting,
  feedback,
  onSubmit,
  compact,
  mobile,
}: PedidoFormProps) {
  const pending = isSubmitting;

  return (
    <form
      onSubmit={(e) => onSubmit(e, pedido)}
      className={mobile ? "flex min-w-0 flex-1 flex-col gap-2" : "space-y-3"}
    >
      <label
        className={`block min-w-0 rounded-xl border border-dashed border-violet-400/30 bg-black/30 ${
          mobile ? "p-2" : compact ? "p-3" : "p-4"
        }`}
      >
        <span
          className={`flex items-center gap-1.5 font-medium text-zinc-300 ${
            mobile ? "text-[10px] leading-tight" : "text-xs"
          }`}
        >
          <UploadCloud className={mobile ? "h-3.5 w-3.5 shrink-0 text-violet-300" : "h-4 w-4 text-violet-300"} />
          {mobile ? "Vídeo (.mp4)" : "Vídeo final (.mp4)"}
        </span>
        <input
          type="file"
          name="videoFile"
          accept="video/*"
          className={
            mobile
              ? "mt-1.5 block w-full max-w-full cursor-pointer rounded-md border border-zinc-700 bg-zinc-950 text-[10px] text-zinc-400 file:mr-1 file:rounded file:border-0 file:bg-violet-600 file:px-2 file:py-1 file:text-[10px] file:font-semibold file:text-white"
              : "mt-3 block w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950 text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white"
          }
        />
      </label>
      <SubmitButton pending={pending} mobile={mobile} />
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
    </form>
  );
}

type Props = {
  pedidos: AdminPedido[];
};

export function AdminPedidosTicketClient({ pedidos }: Props) {
  const [query, setQuery] = useState("");
  const [localPedidos, setLocalPedidos] = useState(() =>
    sortPedidosByCreatedAtDesc(pedidos),
  );
  const [isSubmittingId, setIsSubmittingId] = useState<string | null>(null);
  const [feedbackById, setFeedbackById] = useState<Record<string, DeliverPedidoVideoState>>({});
  const [newOrderAlert, setNewOrderAlert] = useState<string | null>(null);
  const [assignFilter, setAssignFilter] = useState<AssignFilter>("all");
  const [myAdminLabel, setMyAdminLabel] = useState("");
  const [assigningId, setAssigningId] = useState<string | null>(null);

  useEffect(() => {
    void createClient()
      .auth.getUser()
      .then(({ data }) => setMyAdminLabel(getAdminDisplayLabel(data.user)));
  }, []);

  const fetchPedidos = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pedidos", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) {
        console.error(
          "[AdminPedidosTicketClient] Erro ao buscar pedidos:",
          res.status,
          await res.text(),
        );
        return;
      }
      const json = (await res.json()) as { pedidos?: AdminPedido[] };
      setLocalPedidos((current) =>
        sortPedidosByCreatedAtDesc(
          mergeAdminPedidoLists(current, json.pedidos ?? []),
        ),
      );
    } catch (error) {
      console.error("[AdminPedidosTicketClient] Erro ao buscar pedidos:", error);
    }
  }, []);

  const filteredPedidos = useMemo(() => {
    const byAssignment = filterPedidosByAssignment(
      localPedidos,
      assignFilter,
      myAdminLabel,
    );
    const term = query.trim().toLowerCase();
    if (!term) return byAssignment;
    return byAssignment.filter((pedido) => {
      const text = [
        pedido.id,
        pedido.user_id,
        getPedidoTitle(pedido),
        pedido.card_name,
        pedido.assigned_to,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(term);
    });
  }, [query, localPedidos, assignFilter, myAdminLabel]);

  const handleAssign = useCallback(
    async (pedidoId: string) => {
      setAssigningId(pedidoId);
      try {
        const result = await assignPedidoAction({ generationId: pedidoId });
        if (result.ok && result.assignedTo) {
          setLocalPedidos((current) =>
            sortPedidosByCreatedAtDesc(
              current.map((p) =>
                p.id === pedidoId ? { ...p, assigned_to: result.assignedTo! } : p,
              ),
            ),
          );
        } else if (!result.ok) {
          window.alert(result.message);
        }
        void fetchPedidos();
      } finally {
        setAssigningId(null);
      }
    },
    [fetchPedidos],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>, pedido: AdminPedido) {
    event.preventDefault();
    if (isSubmittingId) return;

    setIsSubmittingId(pedido.id);
    setFeedbackById((prev) => ({ ...prev, [pedido.id]: initialState }));

    try {
      const form = event.currentTarget;
      const fileInput = form.elements.namedItem("videoFile") as HTMLInputElement | null;
      const file = fileInput?.files?.[0] ?? null;
      let publicUrl = "";

      if (file) {
        if (!file.type.startsWith("video/")) {
          setFeedbackById((prev) => ({
            ...prev,
            [pedido.id]: { ok: false, message: "O arquivo precisa ser um vídeo válido." },
          }));
          return;
        }

        const supabase = createClient();
        const fileName = safeFileName(file.name) || "resultado.mp4";
        const objectPath = `pedidos/${pedido.id}/${Date.now()}-${fileName}`;
        const { error: uploadError } = await supabase.storage.from("videos").upload(objectPath, file, {
          contentType: file.type || "video/mp4",
          upsert: true,
        });

        if (uploadError) {
          setFeedbackById((prev) => ({
            ...prev,
            [pedido.id]: { ok: false, message: `Erro no upload do vídeo: ${uploadError.message}` },
          }));
          return;
        }

        publicUrl = supabase.storage.from("videos").getPublicUrl(objectPath).data.publicUrl;
      }

      const result = await deliverPedidoVideoAction({
        generationId: pedido.id,
        publicUrl,
      });

      setFeedbackById((prev) => ({ ...prev, [pedido.id]: result }));

      if (result.ok) {
        setLocalPedidos((current) => current.filter((p) => p.id !== pedido.id));
        form.reset();
      }
    } catch (error) {
      console.error("[AdminPedidosTicketClient] Erro ao finalizar pedido:", error);
      setFeedbackById((prev) => ({
        ...prev,
        [pedido.id]: {
          ok: false,
          message: "Não foi possível finalizar o pedido. Tente novamente.",
        },
      }));
    } finally {
      setIsSubmittingId(null);
    }
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-pedidos-ticket")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "generations" },
        (payload) => {
          const row = payload.new as AdminPedido;
          if (isPendingGenerationStatus(row.status)) {
            playNotificationSound();
            setNewOrderAlert(formatAdminNewOrderMessage(row));
            setLocalPedidos((current) => mergePedidoIntoList(current, row));
          }
          void fetchPedidos();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "generations" },
        (payload) => {
          const row = payload.new as AdminPedido;
          setLocalPedidos((current) => mergePedidoIntoList(current, row));
          void fetchPedidos();
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("[AdminPedidosTicketClient] Realtime indisponível:", status);
        }
      });

    void fetchPedidos();

    const pollId = window.setInterval(() => {
      void fetchPedidos();
    }, 10000);

    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchPedidos();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(pollId);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [fetchPedidos]);

  useEffect(() => {
    if (!newOrderAlert) return;
    const timer = window.setTimeout(() => setNewOrderAlert(null), 8000);
    return () => window.clearTimeout(timer);
  }, [newOrderAlert]);

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">Pedidos</p>
            <h2 className="mt-1 text-lg font-bold text-white sm:text-xl">Entrega de gerações</h2>
          </div>
          <span className="rounded-full border border-yellow-400/25 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-200">
            {localPedidos.length} pendente{localPedidos.length === 1 ? "" : "s"}
          </span>
        </div>
        <label className="mt-4 flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-300">
          <Search className="h-4 w-4 shrink-0 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por card, id, usuário ou responsável..."
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-zinc-600"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          {ASSIGN_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setAssignFilter(item.id)}
              className={`min-h-9 touch-manipulation rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                assignFilter === item.id
                  ? "border-violet-400/50 bg-violet-600/25 text-violet-100"
                  : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {newOrderAlert ? (
        <div className="animate-pulse rounded-2xl border border-amber-400/40 bg-amber-500/15 px-4 py-3 text-center text-sm font-semibold text-amber-100 sm:text-base">
          🔔 {newOrderAlert}
        </div>
      ) : null}

      {localPedidos.length === 0 ? (
        <section className="flex min-h-[280px] flex-col items-center justify-center rounded-3xl border border-white/10 bg-zinc-900/80 p-8 text-center shadow-lg">
          <div className="mb-4 rounded-full border border-emerald-400/20 bg-emerald-500/10 p-5 text-4xl">
            🎉
          </div>
          <h2 className="text-xl font-bold text-white sm:text-2xl">
            Nenhum pedido pendente
          </h2>
          <p className="mt-2 max-w-md text-sm text-zinc-400">
            Assim que um novo pedido chegar, ele aparecerá aqui automaticamente.
            A página atualiza a cada 15 segundos.
          </p>
        </section>
      ) : (
        <>
      {/* Mobile: card completo por pedido — modelo, upload, download e entregar na mesma tela */}
      <div className="space-y-4 overflow-x-hidden lg:hidden">
        {filteredPedidos.length === 0 ? (
          <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center text-sm text-zinc-400">
            Nenhum pedido corresponde à busca.
          </p>
        ) : (
          filteredPedidos.map((pedido) => (
            <TicketCardPanel
              key={pedido.id}
              pedido={pedido}
              onSubmit={handleSubmit}
              isSubmitting={isSubmittingId === pedido.id}
              feedback={feedbackById[pedido.id]}
              assigning={assigningId === pedido.id}
              onAssign={handleAssign}
            />
          ))
        )}
      </div>

      {/* Desktop: tabela corporativa */}
      <div className="hidden overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/50 shadow-lg lg:block">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="border-b border-zinc-800 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 text-[11px] uppercase tracking-wider text-zinc-400">
            <tr>
              <th className="px-4 py-3.5 font-semibold">Modelo</th>
              <th className="px-4 py-3.5 font-semibold">Tipo</th>
              <th className="px-4 py-3.5 font-semibold">Áudio</th>
              <th className="px-4 py-3.5 font-semibold">Status</th>
              <th className="px-4 py-3.5 font-semibold">Atendido por</th>
              <th className="px-4 py-3.5 font-semibold">Foto</th>
              <th className="px-4 py-3.5 font-semibold">Download</th>
              <th className="min-w-[260px] px-4 py-3.5 font-semibold">Upload & entrega</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filteredPedidos.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-zinc-400">
                  Nenhum pedido corresponde ao filtro ou à busca.
                </td>
              </tr>
            ) : (
              filteredPedidos.map((pedido) => {
                const imageUrl = getClienteImage(pedido);
                const submitting = isSubmittingId === pedido.id;
                return (
                  <tr key={pedido.id} className="align-top transition hover:bg-white/[0.02]">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-white">{getPedidoTitle(pedido)}</p>
                      <p className="mt-1 text-xs text-zinc-500">{formatDate(pedido.created_at)}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-zinc-600">#{pedido.id.slice(0, 8)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <GenerationTypeBadge type={pedido.type} mode={pedido.mode} />
                    </td>
                    <td className="px-4 py-4">
                      <AudioBadge enabled={pedido.audio_enabled} />
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={pedido.status} />
                    </td>
                    <td className="px-4 py-4">
                      <AssignedToCell
                        pedido={pedido}
                        assigning={assigningId === pedido.id}
                        onAssign={handleAssign}
                        compact
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="relative h-24 w-16 overflow-hidden rounded-lg border border-zinc-700 bg-black">
                        {imageUrl ? (
                          <Image
                            src={imageUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="64px"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-zinc-600">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {imageUrl ? (
                        <a
                          href={imageUrl}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-600/15 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-600/25"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Baixar original
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="min-w-[260px] px-4 py-4">
                      <PedidoDeliveryForm
                        pedido={pedido}
                        isSubmitting={submitting}
                        feedback={feedbackById[pedido.id]}
                        onSubmit={handleSubmit}
                        compact
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
        </>
      )}
    </section>
  );
}
