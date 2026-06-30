"use client";

import {
  adminAdjustDiamondsByProfileAction,
  listAdminProfilesAction,
  setProfileBannedAction,
} from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/client";
import { formatDiamondBalanceDisplay } from "@/lib/formatDiamonds";
import type { AdminProfileRow } from "@/types/database";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = { initialProfiles: AdminProfileRow[] };

export function AccountsTab({ initialProfiles }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<AdminProfileRow[]>(initialProfiles);
  const [loadProfiles, setLoadProfiles] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const emptyRefetchDone = useRef(false);

  useEffect(() => {
    if (initialProfiles.length > 0) {
      setRows(initialProfiles);
    }
  }, [initialProfiles]);

  useEffect(() => {
    if (initialProfiles.length > 0) return;
    if (emptyRefetchDone.current) return;
    emptyRefetchDone.current = true;
    let cancelled = false;
    (async () => {
      setLoadProfiles(true);
      try {
        const res = await listAdminProfilesAction();
        if (cancelled) return;
        if (res.ok) {
          setRows(res.data);
        } else {
          console.warn("[AccountsTab] refetch perfis falhou:", res.error);
        }
      } finally {
        if (!cancelled) setLoadProfiles(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialProfiles.length]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-presence")
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const onlineIds = new Set<string>();
        Object.values(state).forEach((users) => {
          (users as Array<{ user_id?: string; presence_ref?: string }>).forEach((user) => {
            const id = user.user_id ?? user.presence_ref;
            if (id) onlineIds.add(id);
          });
        });
        setOnlineUserIds(onlineIds);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [diamondDeltaById, setDiamondDeltaById] = useState<Record<string, string>>(
    {},
  );
  const [feedback, setFeedback] = useState<
    { kind: "ok" | "err"; text: string } | null
  >(null);

  async function onBanToggle(p: AdminProfileRow) {
    setFeedback(null);
    setBusyId(p.id);
    try {
      const res = await setProfileBannedAction(p.id, !p.is_banned);
      if (!res.ok) {
        setFeedback({ kind: "err", text: res.error });
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  function deltaAmountForRow(p: AdminProfileRow): number {
    const raw = (diamondDeltaById[p.id] ?? "0").trim();
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? Math.abs(n) : 0;
  }

  async function onAddDiamonds(p: AdminProfileRow) {
    setFeedback(null);
    const n = deltaAmountForRow(p);
    if (n <= 0) {
      setFeedback({
        kind: "err",
        text: "Indique um número inteiro maior que zero no campo.",
      });
      return;
    }
    setBusyId(p.id);
    try {
      const res = await adminAdjustDiamondsByProfileAction(p.id, n);
      if (!res.ok) {
        setFeedback({ kind: "err", text: res.error });
        return;
      }
      setDiamondDeltaById((m) => ({ ...m, [p.id]: "0" }));
      setFeedback({ kind: "ok", text: "Saldo atualizado." });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function onRemoveDiamonds(p: AdminProfileRow) {
    setFeedback(null);
    const n = deltaAmountForRow(p);
    if (n <= 0) {
      setFeedback({
        kind: "err",
        text: "Indique um número inteiro maior que zero no campo.",
      });
      return;
    }
    setBusyId(p.id);
    try {
      const res = await adminAdjustDiamondsByProfileAction(p.id, -n);
      if (!res.ok) {
        setFeedback({ kind: "err", text: res.error });
        return;
      }
      setDiamondDeltaById((m) => ({ ...m, [p.id]: "0" }));
      setFeedback({ kind: "ok", text: "Saldo atualizado." });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const showLoadingRow = loadProfiles && rows.length === 0;

  function renderLoading() {
    return (
      <div className="flex items-center justify-center py-10 text-[var(--muted)]" role="status">
        <LoaderCircle
          className="mr-2 h-6 w-6 animate-spin text-violet-300/80"
          aria-hidden
        />
        A carregar perfis…
      </div>
    );
  }

  function renderEmpty() {
    return (
      <div className="py-10 text-center text-sm text-[var(--muted)]">
        Nenhum perfil encontrado. Confirme a service role e as políticas RLS de{" "}
        <code className="text-violet-300/80">profiles</code>.
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-[rgba(147,112,219,0.25)] bg-[var(--card)] p-4 shadow-[0_0_36px_-18px_rgba(147,112,219,0.2)] md:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-violet-200/90">
        Gerenciar contas
        {!showLoadingRow && rows.length > 0 ? (
          <span className="ml-2 font-normal normal-case text-violet-300/80">
            ({rows.length}{" "}
            {rows.length === 1 ? "utilizador" : "utilizadores"})
          </span>
        ) : null}
      </h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Ajuste diamantes e estado das contas. Presence indica utilizadores online
        agora.
      </p>
      {feedback ? (
        <p
          className={
            feedback.kind === "ok"
              ? "mt-3 text-sm text-emerald-200/95"
              : "mt-3 text-sm text-amber-200/90"
          }
        >
          {feedback.text}
        </p>
      ) : null}

      {/* Mobile: cards */}
      <div className="mt-4 block space-y-4 md:hidden">
        {showLoadingRow
          ? renderLoading()
          : rows.length === 0
            ? renderEmpty()
            : rows.map((p) => {
                const busy = busyId === p.id;
                const created = p.created_at
                  ? new Date(p.created_at).toLocaleString("pt-BR")
                  : "—";
                const isOnline = onlineUserIds.has(p.id);
                return (
                  <article
                    key={p.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 shadow-md shadow-black/25"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-zinc-800 ${
                          isOnline
                            ? "bg-emerald-400 ring-emerald-400/30"
                            : "bg-zinc-500"
                        }`}
                        title={isOnline ? "Online" : "Offline"}
                        aria-label={isOnline ? "Online" : "Offline"}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-white">
                          {p.email || "—"}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          Criado em {created}
                        </p>
                      </div>
                      <span
                        className={
                          p.is_banned
                            ? "shrink-0 text-xs font-medium text-red-300"
                            : "shrink-0 text-xs font-medium text-emerald-300"
                        }
                      >
                        {p.is_banned ? "Banido" : "Ativo"}
                      </span>
                    </div>

                    <div className="mt-4 rounded-lg border border-violet-500/20 bg-violet-950/30 px-3 py-3">
                      <p className="text-xs uppercase tracking-wide text-violet-300/80">
                        Saldo de diamantes
                      </p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-violet-100">
                        {formatDiamondBalanceDisplay(Number(p.diamonds ?? 0))}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onBanToggle(p)}
                      className={`mt-4 h-11 w-full rounded-lg text-sm font-semibold disabled:opacity-50 ${
                        p.is_banned
                          ? "bg-emerald-600/30 text-emerald-100 hover:bg-emerald-600/45"
                          : "bg-red-600/35 text-red-100 hover:bg-red-600/50"
                      }`}
                    >
                      {busy ? (
                        <LoaderCircle className="mx-auto h-4 w-4 animate-spin" />
                      ) : p.is_banned ? (
                        "Desbanir"
                      ) : (
                        "Banir"
                      )}
                    </button>

                    <div className="mt-4 flex flex-col gap-3">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        aria-label={`Quantidade de diamantes para ${p.email ?? p.id}`}
                        className="h-12 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-base tabular-nums text-white"
                        value={diamondDeltaById[p.id] ?? "0"}
                        onChange={(e) =>
                          setDiamondDeltaById((m) => ({
                            ...m,
                            [p.id]: e.target.value,
                          }))
                        }
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void onAddDiamonds(p)}
                          className="h-12 rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          Adicionar
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void onRemoveDiamonds(p)}
                          className="h-12 rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
      </div>

      {/* Desktop: tabela */}
      <div className="mt-4 hidden overflow-auto rounded-xl border border-[rgba(147,112,219,0.15)] md:block">
        <table className="w-full min-w-[720px] text-left text-sm text-[var(--foreground)]">
          <thead className="sticky top-0 z-[1] border-b border-[rgba(147,112,219,0.2)] bg-black/50 text-xs text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">E-mail</th>
              <th className="px-3 py-2 font-medium">Saldo de Diamantes</th>
              <th className="px-3 py-2 font-medium">Criado em</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {showLoadingRow ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[var(--muted)]">
                  <LoaderCircle
                    className="mx-auto mb-2 h-6 w-6 animate-spin text-violet-300/80"
                    aria-hidden
                  />
                  A carregar perfis…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-[var(--muted)]"
                >
                  Nenhum perfil encontrado.
                </td>
              </tr>
            ) : (
              rows.map((p) => {
                const busy = busyId === p.id;
                const created = p.created_at
                  ? new Date(p.created_at).toLocaleString("pt-BR")
                  : "—";
                const isOnline = onlineUserIds.has(p.id);
                return (
                  <tr
                    key={p.id}
                    className="border-t border-[rgba(147,112,219,0.08)]"
                  >
                    <td className="max-w-[200px] truncate px-3 py-2.5 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            isOnline ? "bg-emerald-400" : "bg-zinc-500"
                          }`}
                          title={isOnline ? "Online" : "Offline"}
                        />
                        {p.email || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-base font-semibold tabular-nums text-violet-100/95">
                          {formatDiamondBalanceDisplay(Number(p.diamonds ?? 0))}
                        </span>
                        <span className="text-[11px] text-[var(--muted)]">
                          Diamantes
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-[var(--muted)]">
                      {created}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-2">
                        <span
                          className={
                            p.is_banned
                              ? "text-red-300/90"
                              : "text-emerald-300/90"
                          }
                        >
                          {p.is_banned ? "Banido" : "Ativo"}
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void onBanToggle(p)}
                          className={`w-fit rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50 ${
                            p.is_banned
                              ? "bg-emerald-600/30 text-emerald-100 hover:bg-emerald-600/45"
                              : "bg-red-600/35 text-red-100 hover:bg-red-600/50"
                          }`}
                        >
                          {busy ? (
                            <LoaderCircle className="inline h-3.5 w-3.5 animate-spin" />
                          ) : p.is_banned ? (
                            "Desbanir"
                          ) : (
                            "Banir"
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          aria-label={`Quantidade de diamantes para ${p.email ?? p.id}`}
                          className="w-20 rounded-lg border border-[rgba(147,112,219,0.25)] bg-black/40 px-2 py-1.5 text-xs tabular-nums"
                          value={diamondDeltaById[p.id] ?? "0"}
                          onChange={(e) =>
                            setDiamondDeltaById((m) => ({
                              ...m,
                              [p.id]: e.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          disabled={busy}
                          title="Adicionar diamantes"
                          onClick={() => void onAddDiamonds(p)}
                          className="flex h-9 min-w-[2rem] items-center justify-center rounded-lg bg-emerald-600 px-2 text-base font-bold text-white shadow hover:bg-emerald-500 disabled:opacity-50"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          title="Remover diamantes"
                          onClick={() => void onRemoveDiamonds(p)}
                          className="flex h-9 min-w-[2rem] items-center justify-center rounded-lg bg-red-600 px-2 text-base font-bold text-white shadow hover:bg-red-500 disabled:opacity-50"
                        >
                          −
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
