"use client";

import { createClient } from "@/lib/supabase/client";
import { playNotificationSound } from "@/lib/playNotificationSound";
import { LoaderCircle, Upload, Eye, Download, Bell, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

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
  profiles?: {
    email: string;
    display_name: string | null;
  };
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  processing: "Em produção",
};

export function ProductionQueueTab() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [resultFile, setResultFile] = useState<File | null>(null);
  const [newCount, setNewCount] = useState(0);
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // ── Fetch inicial: pending + processing ──
  const fetchQueue = useCallback(async () => {
    try {
      const sb = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await sb
        .from("generations" as any)
        .select("*, profiles!inner(email, display_name)")
        .in("status", ["pending", "processing"])
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[Queue] Erro ao buscar fila:", error);
        return;
      }
      setItems((data as unknown as QueueItem[]) ?? []);
    } catch (err) {
      console.error("[Queue] Erro:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // ── Realtime: novos pedidos + atualizações ──
  useEffect(() => {
    const sb = createClient();

    const channel = sb
      .channel("admin-queue-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "generations" },
        (payload) => {
          const row = payload.new as QueueItem | undefined;
          if (!row) return;

          if (
            payload.eventType === "INSERT" &&
            (row.status === "pending" || row.status === "processing")
          ) {
            // Novo pedido — som + badge
            playNotificationSound();
            setNewCount((c) => c + 1);
            // Re-fetch para ter o join com profiles
            fetchQueue();
          }

          if (payload.eventType === "UPDATE") {
            if (row.status === "completed" || row.status === "failed") {
              // Remover da fila
              setItems((prev) => prev.filter((i) => i.id !== row.id));
            } else {
              // Atualizar status
              setItems((prev) =>
                prev.map((i) => (i.id === row.id ? { ...i, ...row } : i)),
              );
            }
          }
        },
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [fetchQueue]);

  // Limpar badge após 5s
  useEffect(() => {
    if (newCount > 0) {
      const t = setTimeout(() => setNewCount(0), 5000);
      return () => clearTimeout(t);
    }
  }, [newCount]);

  // ── Upload do resultado finalizado ──
  const handleUploadResult = useCallback(
    async (item: QueueItem, file: File) => {
      setUploadingId(item.id);
      setToast(null);

      try {
        const sb = createClient();

        // 1. Upload para bucket imagens, pasta resultados/
        const path = `resultados/${item.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await sb.storage
          .from("imagens")
          .upload(path, file, { cacheControl: "3600", upsert: false });

        if (upErr) throw new Error("Upload falhou: " + upErr.message);

        // 2. URL pública
        const {
          data: { publicUrl },
        } = sb.storage.from("imagens").getPublicUrl(path);

        // 3. Atualizar generation: result_url + status completed
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

        setToast({ type: "ok", text: `Resultado entregue para #${item.id.slice(0, 8)}!` });

        // Remover da lista local
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        setSelected(null);
        setResultFile(null);
      } catch (err) {
        console.error("[Queue] Erro upload resultado:", err);
        setToast({
          type: "err",
          text: err instanceof Error ? err.message : "Erro ao enviar resultado",
        });
      } finally {
        setUploadingId(null);
      }
    },
    [],
  );

  // ── Inline upload por item (sem modal) ──
  const handleInlineFileChange = useCallback(
    (item: QueueItem, file: File | undefined) => {
      if (!file) return;
      handleUploadResult(item, file);
    },
    [handleUploadResult],
  );

  // ── Render ──
  return (
    <section className="space-y-4">
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

      {/* Toast */}
      {toast && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            toast.type === "ok"
              ? "border-emerald-500/25 bg-emerald-950/30 text-emerald-100"
              : "border-red-500/25 bg-red-950/30 text-red-100"
          }`}
          role="status"
        >
          {toast.text}
        </div>
      )}

      {/* Loading */}
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
              className="overflow-hidden rounded-2xl border border-[rgba(147,112,219,0.22)] bg-black/25"
            >
              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                {/* Miniatura */}
                <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-black">
                  {item.image_url ? (
                    <Image
                      src={item.image_url}
                      alt="Imagem enviada"
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-zinc-600">
                      N/A
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-[#e9d5ff]">
                      {item.profiles?.display_name || item.profiles?.email || "—"}
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
                    {item.profiles?.email}
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
                </div>

                {/* Ações */}
                <div className="flex shrink-0 items-center gap-2">
                  {/* Download original */}
                  {item.image_url && (
                    <a
                      href={item.image_url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(147,112,219,0.3)] bg-black/40 px-3 py-2 text-xs font-medium text-violet-200 transition hover:border-violet-400/50 hover:bg-violet-900/20"
                      title="Baixar original"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Original
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
                    onChange={(e) => handleInlineFileChange(item, e.target.files?.[0])}
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
                      onClick={() => fileInputRefs.current.get(item.id)?.click()}
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

      {/* ── Modal de Detalhes + Upload ── */}
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
                    {selected.profiles?.display_name || selected.profiles?.email}
                  </div>
                  <div>
                    Data: {new Date(selected.created_at).toLocaleString("pt-BR")}
                  </div>
                  <div>Custo: {selected.diamond_cost} 💎</div>
                  <div>
                    Tipo:{" "}
                    <span className="font-semibold">
                      {selected.type === "estendido" ? "Estendido" : "Padrão"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Imagem original */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-medium text-[#e9d5ff]">
                      Imagem/Vídeo Enviado
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
                  <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-black">
                    {selected.image_url ? (
                      <Image
                        src={selected.image_url}
                        alt="Original"
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-zinc-600">
                        Sem imagem
                      </div>
                    )}
                  </div>
                </div>

                {/* Upload do resultado */}
                <div>
                  <h4 className="mb-2 text-sm font-medium text-[#e9d5ff]">
                    Upload do Resultado
                  </h4>
                  <div className="space-y-4">
                    <div
                      className={`relative aspect-[9/16] w-full overflow-hidden rounded-xl border-2 border-dashed transition ${
                        resultFile
                          ? "border-emerald-500/50 bg-emerald-950/20"
                          : "border-zinc-700 bg-zinc-900/50"
                      }`}
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

                      {resultFile ? (
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
                            <Image
                              src={URL.createObjectURL(resultFile)}
                              alt="Preview"
                              fill
                              className="object-cover"
                            />
                          )}
                          <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-xs">
                            {resultFile.name}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-8 text-center">
                          <Upload className="mb-4 h-12 w-12 text-zinc-500" />
                          <p className="mb-2 text-sm text-zinc-300">
                            Arraste o resultado aqui
                          </p>
                          <p className="text-xs text-zinc-500">
                            ou clique para selecionar
                          </p>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (resultFile && selected)
                          handleUploadResult(selected, resultFile);
                      }}
                      disabled={!resultFile || uploadingId === selected.id}
                      className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 text-center font-medium text-white shadow-lg shadow-emerald-900/20 transition hover:from-emerald-600 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {uploadingId === selected.id ? (
                        <>
                          <LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />
                          Enviando…
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 inline h-4 w-4" />
                          Entregar Resultado ao Cliente
                        </>
                      )}
                    </button>
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
