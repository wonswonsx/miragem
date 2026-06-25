"use client";

import {
  AdminPedidosTicketClient,
  type AdminPedido,
} from "@/app/admin/pedidos/AdminPedidosTicketClient";
import { deliverVideoAction, type DeliverVideoActionState } from "@/app/admin/painel/actions";
import {
  CheckCircle2,
  Clock3,
  Download,
  Inbox,
  LoaderCircle,
  Search,
  UploadCloud,
  UserRound,
  Video,
} from "lucide-react";
import Image from "next/image";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

export type PendingGeneration = {
  id: string;
  status: string | null;
  card_name: string | null;
  image_url: string | null;
  url_resultado: string | null;
  created_at: string | null;
  user_id: string | null;
};

const initialActionState: DeliverVideoActionState = {
  ok: false,
  message: "",
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-950/40 transition hover:from-violet-500 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
      {pending ? "Entregando vídeo..." : "Entregar vídeo final"}
    </button>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function generationTitle(generation: PendingGeneration) {
  return generation.card_name?.trim() || "Pedido sem nome";
}

function originalImageUrl(generation: PendingGeneration) {
  return generation.image_url || null;
}

type Props = {
  generations: PendingGeneration[];
};

export function AdminPainelClient({ generations }: Props) {
  const [selectedId, setSelectedId] = useState(generations[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [state, formAction] = useActionState(deliverVideoAction, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return generations;
    return generations.filter((generation) => {
      const haystack = [
        generationTitle(generation),
        generation.user_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [generations, query]);

  const selected = generations.find((generation) => generation.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  useEffect(() => {
    if (!selectedId && filtered[0]) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  if (generations.length === 0) {
    return (
      <section className="flex min-h-[520px] flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center shadow-2xl shadow-black/20">
        <div className="mb-5 rounded-full border border-violet-400/20 bg-violet-500/10 p-5">
          <Inbox className="h-10 w-10 text-violet-200" />
        </div>
        <h2 className="text-2xl font-semibold text-white">Nenhum atendimento pendente</h2>
        <p className="mt-2 max-w-md text-sm text-zinc-400">
          Quando um pedido entrar com status pendente, ele aparecerá nesta central para entrega do vídeo final.
        </p>
      </section>
    );
  }

  return (
    <>
      <div className="overflow-x-hidden lg:hidden">
        <AdminPedidosTicketClient pedidos={generations as AdminPedido[]} />
      </div>

      <div className="hidden min-h-0 overflow-hidden rounded-3xl border border-white/10 bg-[#100817]/90 shadow-2xl shadow-black/30 backdrop-blur lg:grid md:min-h-[680px] xl:grid-cols-[380px_1fr]">
      <aside className="border-b border-white/10 bg-black/20 xl:border-b-0 xl:border-r">
        <div className="border-b border-white/10 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300">Fila</p>
              <h2 className="mt-1 text-xl font-bold text-white">Pedidos pendentes</h2>
            </div>
            <span className="rounded-full border border-yellow-400/25 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-200">
              {generations.length}
            </span>
          </div>
          <label className="mt-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-300">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por tema ou usuário..."
              className="w-full bg-transparent outline-none placeholder:text-zinc-600"
            />
          </label>
        </div>

        <div className="max-h-[560px] space-y-2 overflow-y-auto p-3">
          {filtered.map((generation) => {
            const active = selected?.id === generation.id;
            return (
              <button
                key={generation.id}
                type="button"
                onClick={() => setSelectedId(generation.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  active
                    ? "border-violet-400/50 bg-violet-500/15 shadow-lg shadow-violet-950/30"
                    : "border-white/10 bg-white/[0.03] hover:border-violet-400/30 hover:bg-violet-500/10"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-white">{generationTitle(generation)}</h3>
                    <p className="mt-1 truncate text-xs text-zinc-400">userId: {generation.user_id ?? "sem usuário"}</p>
                  </div>
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-yellow-300" />
                </div>
                <p className="mt-3 text-xs text-zinc-500">{formatDate(generation.created_at)}</p>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="p-5 sm:p-8">
        {selected ? (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300">Detalhes do pedido</p>
                  <h1 className="mt-2 text-2xl font-bold text-white">{generationTitle(selected)}</h1>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-yellow-400/25 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-200">
                  <Clock3 className="h-3.5 w-3.5" />
                  Pendente
                </span>
              </div>

              <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-violet-300" />
                  <span className="truncate">{selected.user_id}</span>
                </div>
                <div>Criado em: {formatDate(selected.created_at)}</div>
                <div>ID: {selected.id}</div>
              </div>

              <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-2.5 lg:hidden">
                <div className="relative h-[5.75rem] w-[4.5rem] shrink-0 overflow-hidden rounded-lg border border-zinc-700 bg-black">
                  {originalImageUrl(selected) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={originalImageUrl(selected) ?? ""}
                      alt="Imagem do cliente"
                      className="pointer-events-none absolute inset-0 size-full select-none object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-zinc-500">
                      Sem foto
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
                  {originalImageUrl(selected) ? (
                    <a
                      href={originalImageUrl(selected) ?? "#"}
                      download
                      className="inline-flex h-10 w-full touch-manipulation items-center justify-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-600/20 px-2 text-[11px] font-semibold text-violet-100"
                    >
                      <Download className="h-3.5 w-3.5 shrink-0" />
                      Baixar original
                    </a>
                  ) : null}
                  <form ref={formRef} action={formAction} className="space-y-2 lg:hidden">
                    <input type="hidden" name="generationId" value={selected.id} />
                    <label className="block rounded-xl border border-dashed border-violet-400/30 bg-black/20 p-2">
                      <span className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-300">
                        <UploadCloud className="h-3.5 w-3.5 text-violet-300" />
                        Vídeo (.mp4)
                      </span>
                      <input
                        type="file"
                        name="videoFile"
                        accept="video/mp4,.mp4"
                        required
                        className="mt-1.5 block w-full max-w-full cursor-pointer rounded-md border border-white/10 bg-black/40 text-[10px] text-zinc-300 file:mr-1 file:rounded file:border-0 file:bg-violet-600 file:px-2 file:py-1 file:text-[10px] file:font-semibold file:text-white"
                      />
                    </label>
                    <SubmitButton />
                    {state.message ? (
                      <div
                        className={`rounded-xl border p-2 text-[11px] ${
                          state.ok
                            ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                            : "border-rose-400/25 bg-rose-500/10 text-rose-200"
                        }`}
                      >
                        {state.message}
                      </div>
                    ) : null}
                  </form>
                </div>
              </div>

              <div className="hidden overflow-hidden rounded-3xl border border-white/10 bg-black/30 lg:block">
                <div className="border-b border-white/10 px-5 py-4">
                  <h2 className="font-semibold text-white">Imagem original enviada pelo usuário</h2>
                  <p className="mt-1 text-xs text-zinc-500">Fonte: url_origem / image_url / source_url</p>
                </div>
                <div className="relative min-h-[420px] bg-black/50">
                  {originalImageUrl(selected) ? (
                    <Image
                      src={originalImageUrl(selected) ?? ""}
                      alt="Imagem original enviada pelo usuário"
                      fill
                      sizes="(max-width: 1024px) 100vw, 720px"
                      className="object-contain"
                      unoptimized
                    />
                  ) : (
                    <div className="flex min-h-[420px] items-center justify-center text-sm text-zinc-500">
                      Este pedido não possui imagem original cadastrada.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="hidden h-fit rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/20 lg:block">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-2xl bg-violet-500/15 p-3 text-violet-200">
                  <Video className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-white">Resposta do Admin</h2>
                  <p className="text-xs text-zinc-500">Upload final em .mp4</p>
                </div>
              </div>

              <form ref={formRef} action={formAction} className="space-y-4">
                <input type="hidden" name="generationId" value={selected.id} />
                <label className="block rounded-2xl border border-dashed border-violet-400/30 bg-black/20 p-4">
                  <span className="block text-sm font-medium text-zinc-200">Arquivo de vídeo</span>
                  <span className="mt-1 block text-xs text-zinc-500">Selecione um arquivo .mp4 para entregar ao cliente.</span>
                  <input
                    type="file"
                    name="videoFile"
                    accept="video/mp4,.mp4"
                    required
                    className="mt-4 block w-full cursor-pointer rounded-xl border border-white/10 bg-black/40 text-sm text-zinc-300 file:mr-4 file:border-0 file:bg-violet-600 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-violet-500"
                  />
                </label>
                <SubmitButton />
                {state.message ? (
                  <div
                    className={`rounded-2xl border p-3 text-sm ${
                      state.ok
                        ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                        : "border-rose-400/25 bg-rose-500/10 text-rose-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {state.ok ? <CheckCircle2 className="h-4 w-4" /> : null}
                      {state.message}
                    </div>
                  </div>
                ) : null}
              </form>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[500px] items-center justify-center text-sm text-zinc-500">
            Selecione um pedido para ver os detalhes.
          </div>
        )}
      </section>
    </div>
    </>
  );
}
