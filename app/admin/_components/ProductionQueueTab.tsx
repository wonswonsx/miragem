"use client";

import { createClient } from "@/lib/supabase/client";
import { playNotificationSound } from "@/lib/playNotificationSound";
import {
  LoaderCircle,
  Upload,
  Eye,
  Download,
  Bell,
  CheckCircle2,
  X,
  ZoomIn,
} from "lucide-react";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";

/* ── Tipos ── */

type QueueItem = {
  id: string;
  user_id: string;
  image_url: string;
  video_url: string | null;
  result_url: string | null;
  type: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  diamond_cost: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  client_email: string | null;
  client_name: string | null;
};

type FloatingToast = {
  id: number;
  type: "ok" | "err" | "info";
  text: string;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  processing: "Em produção",
};

let toastCounter = 0;

/* ── Componente ── */

export function ProductionQueueTab() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [resultFile, setResultFile] = useState<File | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [toasts, setToasts] = useState<FloatingToast[]>([]);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  /* ── Toast flutuante ── */
  const pushToast = useCallback(
    (type: FloatingToast["type"], text: string) => {
      const id = ++toastCounter;
      setToasts((prev) => [...prev, { id, type, text }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    [],
  );

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /* ── Fetch via view admin_queue ── */
  const fetchQueue = useCallback(async () => {
    try {
      const sb = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await sb
        .from("admin_queue" as any)
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[AdminQueue] Erro ao buscar fila:", error);
        return;
      }
      const list = (data as unknown as QueueItem[]) ?? [];
      console.log(`[AdminQueue] ✅ Fila carregada: ${list.length} item(ns)`);
      setItems(list);
    } catch (err) {
      console.error("[AdminQueue] Erro:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  /* ── Realtime: escuta generations → re-fetch admin_queue ── */
  useEffect(() => {
    const sb = createClient();

    const channel = sb
      .channel("admin-queue-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "generations" },
        async (payload) => {
          const row = payload.new as Partial<QueueItem> | undefined;
          if (!row) return;

          console.log(`[AdminQueue] 📡 Realtime recebido: ${payload.eventType}`, { id: row.id, status: row.status });

          if (
            payload.eventType === "INSERT" &&
            (row.status === "pending" || row.status === "processing")
          ) {
            console.log("[AdminQueue] 🔔 Admin recebeu sinal Realtime — novo pedido!");
            playNotificationSound();
            setNewCount((c) => c + 1);

            // Re-fetch para obter client_name da view
            await fetchQueue();

            // Toast com nome do cliente (pegar da lista atualizada)
            setItems((current) => {
              const found = current.find((i) => i.id === row.id);
              const name = found?.client_name || found?.client_email || "Cliente";
              pushToast("info", `Novo pedido de ${name}!`);
              return current;
            });
          }

          if (payload.eventType === "UPDATE") {
            if (row.status === "completed" || row.status === "failed") {
              console.log(`[AdminQueue] Item ${row.id} removido da fila (status: ${row.status})`);
              setItems((prev) => prev.filter((i) => i.id !== row.id));
            } else {
              fetchQueue();
            }
          }
        },
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [fetchQueue, pushToast]);

  // Limpar badge
  useEffect(() => {
    if (newCount > 0) {
      const t = setTimeout(() => setNewCount(0), 5000);
      return () => clearTimeout(t);
    }
  }, [newCount]);

  /* ── Upload do resultado ── */
  const handleUploadResult = useCallback(
    async (item: QueueItem, file: File) => {
      setUploadingId(item.id);
      console.log(`[AdminQueue] 🚀 Iniciando upload de resultado para #${item.id.slice(0, 8)}...`, file.name);

      try {
        const sb = createClient();

        const path = `resultados/${item.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await sb.storage
          .from("imagens")
          .upload(path, file, { cacheControl: "3600", upsert: false });

        if (upErr) throw new Error("Upload falhou: " + upErr.message);

        const {
          data: { publicUrl },
        } = sb.storage.from("imagens").getPublicUrl(path);
        console.log(`[AdminQueue] ✅ Resultado subiu para o Storage:`, publicUrl);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateErr } = await sb
          .from("generations" as any)
          .update({
            result_url: publicUrl,
            status: "completed",
            completed_at: new Date().toISOString(),
          } as any)
          .eq("id", item.id);

        if (updateErr) throw new Error("Update falhou: " + updateErr.message);

        console.log(`[AdminQueue] ✅ Tabela generations atualizada: status=completed, result_url preenchido`);
        pushToast("ok", `Resultado entregue para #${item.id.slice(0, 8)}!`);
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        setSelected(null);
        setResultFile(null);
      } catch (err) {
        console.error("[AdminQueue] ❌ Erro upload resultado:", err);
        pushToast(
          "err",
          err instanceof Error ? err.message : "Erro ao enviar resultado",
        );
      } finally {
        setUploadingId(null);
      }
    },
    [pushToast],
  );

  /* ── Drag & Drop handlers ── */
  const onDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>, itemId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverId(itemId);
    },
    [],
  );

  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>, item: QueueItem) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverId(null);

      const file = e.dataTransfer.files?.[0];
      if (!file) return;

      // Auto-upload imediato
      handleUploadResult(item, file);
    },
    [handleUploadResult],
  );

  /* ── Render ── */
  return (
    <section className="relative space-y-4">
      {/* ── Floating Toasts (topo fixo) ── */}
      <div className="pointer-events-none fixed left-0 right-0 top-4 z-[1100] flex flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-2xl border px-5 py-3 text-sm font-medium shadow-xl backdrop-blur-md animate-in slide-in-from-top-3 fade-in duration-300 ${
              t.type === "ok"
                ? "border-emerald-500/40 bg-emerald-950/80 text-emerald-100"
                : t.type === "err"
                  ? "border-red-500/40 bg-red-950/80 text-red-100"
                  : "border-amber-500/40 bg-amber-950/80 text-amber-100"
            }`}
          >
            {t.type === "info" && <Bell className="h-4 w-4 text-amber-400" />}
            {t.type === "ok" && (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            )}
            <span>{t.text}</span>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="ml-1 rounded-full p-0.5 hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-[#e9d5ff]">
            Esteira de Processamento
          </h2>
          {newCount > 0 && (
            <div className="flex animate-pulse items-center gap-2 rounded-full border border-amber-500/50 bg-amber-500/20 px-3 py-1">
              <Bell className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-medium text-amber-300">
                {newCount} novo{newCount > 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
        <div className="text-sm text-[rgba(232,224,240,0.8)]">
          {items.length} na fila
        </div>
      </div>

      {/* Loading / Empty / List */}
      {loading ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="h-8 w-8 animate-spin text-violet-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-[rgba(147,112,219,0.25)] bg-black/30 px-4 py-10 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-400/60" />
          <p className="text-sm text-[var(--muted)]">
            Fila vazia — todos os pedidos foram processados.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className={`overflow-hidden rounded-2xl border transition-all duration-200 ${
                dragOverId === item.id
                  ? "border-emerald-400/60 bg-emerald-950/20 shadow-[0_0_20px_rgba(52,211,153,0.15)]"
                  : "border-[rgba(147,112,219,0.22)] bg-black/25"
              }`}
              onDragOver={(e) => onDragOver(e, item.id)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, item)}
            >
              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                {/* Miniatura clicável */}
                <button
                  type="button"
                  className="group/thumb relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-black"
                  onClick={() =>
                    item.image_url && setPreviewUrl(item.image_url)
                  }
                  title="Clique para ampliar"
                >
                  {item.image_url ? (
                    <>
                      <Image
                        src={item.image_url}
                        alt="Imagem enviada"
                        fill
                        className="object-cover transition group-hover/thumb:brightness-75"
                        sizes="56px"
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover/thumb:opacity-100">
                        <ZoomIn className="h-5 w-5 text-white drop-shadow" />
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-zinc-600">
                      N/A
                    </div>
                  )}
                </button>

                {/* Info */}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-[#e9d5ff]">
                      {item.client_name || item.client_email || "—"}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        item.type === "estendido"
                          ? "bg-fuchsia-500/20 text-fuchsia-300"
                          : "bg-violet-500/20 text-violet-300"
                      }`}
                    >
                      {item.type === "estendido" ? "Estendido" : "Padrão"}
                    </span>
                  </div>
                  <div className="text-xs text-[rgba(232,224,240,0.5)]">
                    {item.client_email}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[rgba(232,224,240,0.5)]">
                    <span>
                      {new Date(item.created_at).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                    <span className="text-amber-300">
                      {item.diamond_cost} 💎
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        item.status === "processing"
                          ? "bg-blue-500/20 text-blue-300"
                          : "bg-yellow-500/20 text-yellow-300"
                      }`}
                    >
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </div>

                  {/* Drag hint */}
                  {dragOverId === item.id && (
                    <p className="mt-1 text-xs font-semibold text-emerald-300 animate-pulse">
                      Solte para entregar o resultado…
                    </p>
                  )}
                </div>

                {/* Ações */}
                <div className="flex shrink-0 items-center gap-2">
                  {/* Baixar Arquivo Original */}
                  {item.image_url && (
                    <a
                      href={item.image_url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(147,112,219,0.3)] bg-black/40 px-3 py-2 text-xs font-medium text-violet-200 transition hover:border-violet-400/50 hover:bg-violet-900/20"
                      title="Baixar Arquivo Original"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Baixar Original
                    </a>
                  )}

                  {/* Upload resultado inline */}
                  <input
                    type="file"
                    accept="video/*,image/*"
                    className="hidden"
                    ref={(el) => {
                      if (el) fileInputRefs.current.set(item.id, el);
                    }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadResult(item, f);
                    }}
                    disabled={uploadingId === item.id}
                  />

                  {uploadingId === item.id ? (
                    <div className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600/30 px-3 py-2 text-xs font-medium text-emerald-200">
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      Enviando…
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        fileInputRefs.current.get(item.id)?.click()
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-2 text-xs font-medium text-white shadow-lg shadow-emerald-900/20 transition hover:brightness-110"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Enviar Resultado
                    </button>
                  )}

                  {/* Ver detalhes */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(item);
                      setResultFile(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(147,112,219,0.3)] bg-black/40 px-3 py-2 text-xs font-medium text-violet-200 transition hover:border-violet-400/50 hover:bg-violet-900/20"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Detalhes
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal Preview (imagem em tamanho real) ── */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-[1050] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 z-10 rounded-full border border-white/20 bg-black/60 p-2 text-white hover:bg-white/10"
            onClick={() => setPreviewUrl(null)}
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Preview em tamanho real"
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <a
            href={previewUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-6 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-4 w-4" />
            Baixar Arquivo Original
          </a>
        </div>
      )}

      {/* ── Modal de Detalhes + Upload com Drop Zone ── */}
      {selected && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-5">
          <div
            className="absolute inset-0 bg-[rgba(15,10,24,0.75)] backdrop-blur-md"
            onClick={() => {
              setSelected(null);
              setResultFile(null);
            }}
          />
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[rgba(147,112,219,0.4)] bg-[rgba(26,15,46,0.95)] shadow-[0_24px_60px_rgba(0,0,0,0.5)] p-6">
            <button
              type="button"
              className="absolute right-4 top-4 h-8 w-8 rounded-full border border-[rgba(147,112,219,0.35)] bg-[rgba(15,10,24,0.65)] text-lg leading-none text-[#e9d5ff] hover:bg-[rgba(147,112,219,0.35)]"
              onClick={() => {
                setSelected(null);
                setResultFile(null);
              }}
            >
              ×
            </button>

            <div className="space-y-6">
              {/* Info */}
              <div>
                <h3 className="mb-2 text-lg font-semibold text-[#e9d5ff]">
                  Pedido #{selected.id.slice(0, 8)}
                </h3>
                <div className="space-y-1 text-sm text-[rgba(232,224,240,0.8)]">
                  <div>
                    Cliente:{" "}
                    {selected.client_name || selected.client_email}
                  </div>
                  <div>
                    Data:{" "}
                    {new Date(selected.created_at).toLocaleString("pt-BR")}
                  </div>
                  <div>Custo: {selected.diamond_cost} 💎</div>
                  <div>
                    Tipo:{" "}
                    <span className="font-semibold">
                      {selected.type === "estendido"
                        ? "Estendido"
                        : "Padrão"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Imagem original (clicável) */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-medium text-[#e9d5ff]">
                      Arquivo Enviado pelo Cliente
                    </h4>
                    {selected.image_url && (
                      <a
                        href={selected.image_url}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs text-violet-300 hover:bg-white/10"
                      >
                        <Download className="h-3 w-3" />
                        Baixar
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    className="group relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-black"
                    onClick={() =>
                      selected.image_url && setPreviewUrl(selected.image_url)
                    }
                  >
                    {selected.image_url ? (
                      <>
                        <Image
                          src={selected.image_url}
                          alt="Original"
                          fill
                          className="object-cover transition group-hover:brightness-75"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                          <ZoomIn className="h-8 w-8 text-white drop-shadow-lg" />
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-zinc-600">
                        Sem imagem
                      </div>
                    )}
                  </button>
                </div>

                {/* Drop Zone para entrega */}
                <div>
                  <h4 className="mb-2 text-sm font-medium text-[#e9d5ff]">
                    Entrega do Resultado
                  </h4>
                  <div className="space-y-4">
                    <div
                      className={`relative aspect-[9/16] w-full overflow-hidden rounded-xl border-2 border-dashed transition-all duration-200 ${
                        dragOverId === `modal-${selected.id}`
                          ? "border-emerald-400 bg-emerald-950/30 shadow-[0_0_30px_rgba(52,211,153,0.2)]"
                          : resultFile
                            ? "border-emerald-500/50 bg-emerald-950/20"
                            : "border-zinc-700 bg-zinc-900/50"
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverId(`modal-${selected.id}`);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverId(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverId(null);
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          setResultFile(file);
                          // Auto-upload
                          handleUploadResult(selected, file);
                        }
                      }}
                    >
                      <input
                        type="file"
                        accept="video/*,image/*"
                        onChange={(e) =>
                          setResultFile(e.target.files?.[0] ?? null)
                        }
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        disabled={uploadingId === selected.id}
                      />

                      {uploadingId === selected.id ? (
                        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                          <LoaderCircle className="h-12 w-12 animate-spin text-emerald-400" />
                          <p className="text-sm font-medium text-emerald-200">
                            Enviando resultado…
                          </p>
                        </div>
                      ) : resultFile ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-white">
                          {resultFile.type.startsWith("video/") ? (
                            <video
                              src={URL.createObjectURL(resultFile)}
                              className="h-full w-full rounded-lg object-cover"
                              muted
                              loop
                              playsInline
                              controls
                            />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={URL.createObjectURL(resultFile)}
                              alt="Preview"
                              className="h-full w-full rounded-lg object-cover"
                            />
                          )}
                          <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-xs">
                            {resultFile.name}
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                          <Upload
                            className={`mb-4 h-12 w-12 transition ${
                              dragOverId === `modal-${selected.id}`
                                ? "text-emerald-400 scale-110"
                                : "text-zinc-500"
                            }`}
                          />
                          <p className="mb-2 text-sm text-zinc-300">
                            {dragOverId === `modal-${selected.id}`
                              ? "Solte para enviar!"
                              : "Arraste e solte o resultado aqui"}
                          </p>
                          <p className="text-xs text-zinc-500">
                            ou clique para selecionar
                          </p>
                          <p className="mt-3 text-[10px] text-emerald-400/60">
                            O upload começa automaticamente ao soltar o arquivo
                          </p>
                        </div>
                      )}
                    </div>

                    {resultFile && uploadingId !== selected.id && (
                      <button
                        type="button"
                        onClick={() => handleUploadResult(selected, resultFile)}
                        className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 text-center font-medium text-white shadow-lg shadow-emerald-900/20 transition hover:from-emerald-600 hover:to-emerald-700"
                      >
                        <Upload className="mr-2 inline h-4 w-4" />
                        Entregar Resultado ao Cliente
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
