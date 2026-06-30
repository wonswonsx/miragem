"use client";

import { supabase } from "@/lib/supabase/client";
import {
  formatAdminNewOrderMessage,
  isPendingGenerationStatus,
} from "@/lib/adminNewOrderMessage";
import { Download, LoaderCircle, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Order = {
  id: string;
  user_id: string;
  image_url: string | null;
  video_url: string | null;
  result_url?: string | null;
  card_name?: string | null;
  type?: "padrao" | "estendido" | string | null;
  status: string;
  diamond_cost?: number | null;
  created_at: string;
  updated_at?: string | null;
  completed_at?: string | null;
  profiles?: {
    email?: string | null;
    display_name?: string | null;
  } | null;
};

type Props = {
  initialOrders: Order[];
};

export function AdminPedidosRealtimeClient({ initialOrders }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [showNewOrderBanner, setShowNewOrderBanner] = useState(false);
  const [newOrderLabel, setNewOrderLabel] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputs = useRef<Map<string, HTMLInputElement>>(new Map());

  useEffect(() => {
    console.log('📡 Admin aguardando pedidos...');

    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const connectRealtime = () => {
      if (channel) {
        supabase.removeChannel(channel);
      }

      channel = supabase
        .channel('fila-de-entrega')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'generations' },
          (payload) => {
            console.log('✅ DADOS DO NOVO PEDIDO:', payload);

            const row = payload.new as Order;
            if (!isPendingGenerationStatus(row.status)) return;

            const audio = new Audio('/notificacao.mp3');
            audio.play().catch((err) => console.error('Erro ao tocar notificação:', err));

            const label = formatAdminNewOrderMessage(row, {
              clientLabel: getOrderName(row),
            });
            setNewOrderLabel(label);
            setShowNewOrderBanner(true);
            setMessage(label);
            setOrders((current) => [row, ...current]);
          },
        )
        .subscribe((status) => {
          console.log('📡 Status fila-de-entrega:', status);

          if (status === 'CHANNEL_ERROR') {
            console.error('❌ CHANNEL_ERROR na fila-de-entrega. Tentando reconectar em 2s...');
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(connectRealtime, 2000);
          }
        });
    };

    connectRealtime();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!showNewOrderBanner) return;
    const timer = window.setTimeout(() => setShowNewOrderBanner(false), 8000);
    return () => window.clearTimeout(timer);
  }, [showNewOrderBanner]);

  const handleDeliver = async (order: Order, file: File | undefined) => {
    if (!file) return;

    setUploadingId(order.id);
    setMessage(null);

    try {
      const path = `generations/${order.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('generations')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('generations').getPublicUrl(path);

      const { error: updateError } = await supabase
        .from('generations' as any)
        .update({
          status: 'completed',
          video_url: publicUrl,
          completed_at: new Date().toISOString(),
        } as any)
        .eq('id', order.id);

      if (updateError) throw updateError;

      setOrders((current) => current.filter((item) => item.id !== order.id));
      setMessage(`Pedido #${order.id.slice(0, 8)} entregue com sucesso!`);
    } catch (err) {
      console.error('Erro ao entregar pedido:', err);
      setMessage(err instanceof Error ? err.message : 'Erro ao entregar pedido');
    } finally {
      setUploadingId(null);
    }
  };

  const getOrderName = (order: Order) =>
    order.profiles?.display_name?.trim() ||
    order.profiles?.email?.trim() ||
    order.user_id ||
    order.id;

  const getOrderTitle = (order: Order) =>
    order.card_name?.trim() || getOrderName(order);

  const getTypeLabel = (order: Order) => {
    if (order.type === 'estendido') return 'Estendido';
    if (order.type === 'padrao') return 'Padrão';
    if (order.diamond_cost && order.diamond_cost >= 100) return 'Estendido';
    return 'Padrão';
  };

  return (
    <main className="min-h-screen bg-[#0b0712] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-2 rounded-3xl border border-violet-500/20 bg-black/30 p-6 shadow-2xl shadow-violet-950/30 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-violet-300">Admin Realtime</p>
            <h1 className="mt-2 text-3xl font-bold text-violet-50">Fila de Entrega</h1>
            <p className="mt-2 text-sm text-violet-100/70">Deixe esta página aberta para receber novos pedidos ao vivo.</p>
          </div>
          <div className="rounded-2xl border border-violet-400/20 bg-violet-950/30 px-4 py-3 text-sm text-violet-100">
            {orders.length} pedido(s) na fila
          </div>
        </header>

        {showNewOrderBanner ? (
          <div className="animate-pulse rounded-3xl border border-amber-300/50 bg-amber-500/20 px-5 py-4 text-center text-lg font-black text-amber-100 shadow-xl shadow-amber-950/30">
            ⚠️ {newOrderLabel ?? "NOVO PEDIDO RECEBIDO AGORA!"}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-2xl border border-violet-400/25 bg-violet-950/40 px-4 py-3 text-sm text-violet-100">
            {message}
          </div>
        ) : null}

        {orders.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-violet-500/25 bg-black/25 p-10 text-center text-violet-100/70">
            Nenhum pedido aguardando entrega. A rádio Realtime está ligada.
          </section>
        ) : (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {orders.map((order) => (
              <article key={order.id} className="overflow-hidden rounded-3xl border border-violet-500/20 bg-[#140d22] shadow-xl shadow-black/30">
                <div className="relative aspect-[9/12] bg-black">
                  {order.image_url ? (
                    <img src={order.image_url} alt="Thumbnail do pedido" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-violet-100/50">Sem imagem</div>
                  )}
                  <div className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-amber-200 backdrop-blur">
                    {getTypeLabel(order)}
                  </div>
                </div>

                <div className="space-y-4 p-4">
                  <div>
                    <h2 className="truncate text-base font-bold text-violet-50">{getOrderTitle(order)}</h2>
                    {order.card_name ? (
                      <p className="truncate text-xs text-violet-300/80">
                        Cliente: {getOrderName(order)}
                      </p>
                    ) : null}
                    <p className="mt-1 font-mono text-xs text-violet-200/60">#{order.id}</p>
                    <p className="mt-2 text-xs text-violet-100/60">{new Date(order.created_at).toLocaleString('pt-BR')}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={order.image_url ?? '#'}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition ${order.image_url ? 'bg-violet-600 text-white hover:bg-violet-500' : 'pointer-events-none bg-zinc-800 text-zinc-500'}`}
                    >
                      <Download className="h-4 w-4" />
                      Baixar
                    </a>

                    <input
                      ref={(node) => {
                        if (node) fileInputs.current.set(order.id, node);
                        else fileInputs.current.delete(order.id);
                      }}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(event) => void handleDeliver(order, event.target.files?.[0])}
                    />
                    <button
                      type="button"
                      disabled={uploadingId === order.id}
                      onClick={() => fileInputs.current.get(order.id)?.click()}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {uploadingId === order.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                      Entregar
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
