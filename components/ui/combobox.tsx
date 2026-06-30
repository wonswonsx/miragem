"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  /** Lista de opções disponíveis. */
  options: ComboboxOption[];
  /** Valores actualmente seleccionados. */
  selected: string[];
  /** Callback quando a selecção muda. */
  onChange: (selected: string[]) => void;
  /** Permitir criar opções novas com Enter. */
  creatable?: boolean;
  /** Callback quando uma opção nova é criada. */
  onCreateOption?: (value: string) => void;
  /** Permitir múltipla selecção (tags). Se false, aceita apenas 1 valor. */
  multiple?: boolean;
  /** Placeholder do input. */
  placeholder?: string;
  /** Label para a opção de criar. */
  createLabel?: string;
  /** Desactivado. */
  disabled?: boolean;
  /** Classes extra no wrapper. */
  className?: string;
}

export function Combobox({
  options,
  selected,
  onChange,
  creatable = true,
  onCreateOption,
  multiple = true,
  placeholder = "Pesquisar ou criar…",
  createLabel = "Criar",
  disabled = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();

  const filtered = React.useMemo(() => {
    if (!q) return options.slice(0, 30);
    return options
      .filter((o) => o.label.toLowerCase().includes(q))
      .slice(0, 30);
  }, [options, q]);

  const exactMatch = React.useMemo(
    () => options.some((o) => o.label.toLowerCase() === q),
    [options, q],
  );

  const showCreate = creatable && q.length > 0 && !exactMatch;

  // Fechar ao clicar fora
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggleValue(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else if (multiple) {
      onChange([...selected, value]);
    } else {
      onChange([value]);
    }
    setQuery("");
    if (!multiple) setOpen(false);
  }

  function handleCreate() {
    const val = query.trim();
    if (!val) return;
    onCreateOption?.(val);
    if (!selected.includes(val)) {
      if (multiple) {
        onChange([...selected, val]);
      } else {
        onChange([val]);
      }
    }
    setQuery("");
    if (!multiple) setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (showCreate) {
        handleCreate();
      } else if (filtered.length === 1) {
        toggleValue(filtered[0].value);
      }
    }
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
    if (e.key === "Backspace" && query === "" && selected.length > 0) {
      onChange(selected.slice(0, -1));
    }
  }

  function removeValue(value: string) {
    onChange(selected.filter((v) => v !== value));
  }

  const selectedLabels = React.useMemo(() => {
    const map = new Map(options.map((o) => [o.value, o.label]));
    return selected.map((v) => map.get(v) ?? v);
  }, [options, selected]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger */}
      <div
        className={cn(
          "flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-xl border border-[rgba(147,112,219,0.25)] bg-black/40 px-3 py-1.5 text-sm transition",
          open && "ring-2 ring-violet-500/20 border-violet-500/40",
          disabled && "cursor-not-allowed opacity-50",
        )}
        onClick={() => {
          if (!disabled) {
            setOpen(true);
            inputRef.current?.focus();
          }
        }}
      >
        {/* Badges das selecções */}
        {selected.map((val, i) => (
          <span
            key={val}
            className="inline-flex items-center gap-1 rounded-full bg-violet-600/80 px-2 py-0.5 text-xs font-medium text-white"
          >
            {selectedLabels[i]}
            <button
              type="button"
              className="rounded-full p-0.5 hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                removeValue(val);
              }}
              aria-label={`Remover ${selectedLabels[i]}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selected.length === 0 ? placeholder : ""}
          disabled={disabled}
          className="min-w-[80px] flex-1 bg-transparent py-1 text-sm text-[var(--foreground)] outline-none placeholder:text-zinc-500"
        />

        <ChevronsUpDown className="h-4 w-4 shrink-0 text-zinc-500" />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-[rgba(147,112,219,0.25)] bg-[rgba(15,10,24,0.98)] shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
          <div className="max-h-[240px] overflow-auto p-1">
            {/* Opção de criar */}
            {showCreate && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-amber-100 hover:bg-amber-500/15"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleCreate}
              >
                <Plus className="h-3.5 w-3.5 text-amber-400" />
                <span>
                  {createLabel} &quot;{query.trim()}&quot;
                </span>
              </button>
            )}

            {/* Opções existentes */}
            {filtered.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition",
                    isSelected
                      ? "bg-violet-600/15 text-violet-200"
                      : "text-[var(--foreground)] hover:bg-white/5",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggleValue(option.value)}
                >
                  <span className="min-w-0 truncate">{option.label}</span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-violet-400" />}
                </button>
              );
            })}

            {filtered.length === 0 && !showCreate && (
              <p className="px-3 py-3 text-center text-xs text-zinc-500">
                Nenhum resultado encontrado.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
