import {
  getGenerationTypeLabel,
  isExtendedGeneration,
} from "@/lib/adminStaffDisplay";

export function StatusBadge({ status }: { status: string | null }) {
  const value = (status ?? "pendente").trim().toLowerCase();
  const styles =
    value === "concluido" || value === "completed"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/35"
      : value === "processando" || value === "processing"
        ? "bg-blue-500/15 text-blue-300 border-blue-500/35"
        : value === "falhou" || value === "failed"
          ? "bg-rose-500/15 text-rose-300 border-rose-500/35"
          : "bg-amber-500/15 text-amber-200 border-amber-500/35";
  const label =
    value === "concluido" || value === "completed"
      ? "Concluído"
      : value === "processando" || value === "processing"
        ? "Processando"
        : value === "falhou" || value === "failed"
          ? "Falhou"
          : value === "pendente" || value === "pending" || value === ""
            ? "Pendente"
            : status ?? "Sem status";

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${styles}`}
    >
      {label}
    </span>
  );
}

export function GenerationTypeBadge({
  type,
  mode,
}: {
  type?: string | null;
  mode?: string | null;
}) {
  const extended = isExtendedGeneration(type, mode);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
        extended
          ? "border-fuchsia-500/35 bg-fuchsia-500/10 text-fuchsia-200"
          : "border-violet-500/35 bg-violet-500/10 text-violet-200"
      }`}
    >
      {getGenerationTypeLabel(type, mode)}
    </span>
  );
}

export function AudioBadge({ enabled }: { enabled?: boolean | null }) {
  if (enabled) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-100">
        🔊 COM SOM
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-zinc-600/50 bg-zinc-800/80 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-400">
      🔇 SEM SOM
    </span>
  );
}
