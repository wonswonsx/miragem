"use client";

import {
  filterAndSortMedia,
  getItemTitle,
  getStreamUrl,
  getTagsForItem,
  isNewItem,
  itemKey,
  type MediaItem,
  type SortOrder,
} from "@/lib/mirageMedia";
import { videoRowToMediaItem } from "@/lib/videoRowToMediaItem";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import type { VideoRow } from "@/types/database";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { Gem, Search, Sparkles, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DependencyList } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useInView } from "react-intersection-observer";

/** PÃ¡gina inicial `/`: sem paginaÃ§Ã£o visual â€” exibe todos os vÃ­deos carregados. */
const BATCH_HOME = 200;
/** `/explore`: 10 vÃ­deos por pedido ao Supabase + scroll infinito. */
const BATCH_EXPLORE_DB = 10;

function VideoThumb({ item }: { item: MediaItem }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const { ref: wrapRef, inView } = useInView({
    threshold: 0.1,
    rootMargin: "50px",
    triggerOnce: false,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Controlar play/pause baseado no viewport
    if (inView) {
      void el.play().catch(() => {});
    } else {
      el.pause();
      el.currentTime = 0;
    }
  }, [inView]);

  // Hover effect como enhancement opcional
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (isHovering && inView) {
      void el.play().catch(() => {});
    } else if (!isHovering && inView) {
      // Continuar playing se estiver no viewport, mesmo sem hover
      // void el.play().catch(() => {});
    }
  }, [isHovering, inView]);

  const url = getStreamUrl(item);
  const poster = item.absolutePosterUrl?.trim() || undefined;

  return (
    <div
      ref={wrapRef}
      className="relative aspect-[9/16] w-full overflow-hidden bg-[rgba(20,10,30,0.95)] rounded-xl transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] hover:shadow-purple-500/20"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <video
        ref={ref}
        src={url}
        poster={poster}
        className="absolute inset-0 h-full w-full object-cover rounded-xl transition-transform duration-300 ease-out hover:scale-105"
        style={{ objectFit: 'cover' }}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={getItemTitle(item)}
      />
      
      {/* Overlay sutil no hover */}
      {isHovering && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
      )}
    </div>
  );
}

function ExploreGridCard({
  item,
  onSelectCard,
  onTagClick,
}: {
  item: MediaItem;
  onSelectCard: (item: MediaItem) => void;
  onTagClick: (tag: string) => void;
}) {
  const itemIsNew = isNewItem(item);
  const tags = getTagsForItem(item);
  const url = getStreamUrl(item);

  return (
    <article
      className="mirage-explore-card group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-[rgba(147,112,219,0.12)] bg-[rgba(25,12,38,0.9)] opacity-0 shadow-none transition-[opacity,transform] duration-500 max-sm:translate-y-0 max-sm:opacity-100 data-[visible=true]:translate-y-0 data-[visible=true]:opacity-100 [&:not([data-visible=true])]:translate-y-5"
      data-visible="false"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        if (item.type !== "video" || !item.id) return;
        onSelectCard(item);
      }}
    >
      <div className="relative aspect-[9/16] w-full overflow-hidden bg-[rgba(20,10,30,0.95)]">
        {itemIsNew && (
          <span className="absolute left-2 top-2 z-10 rounded-md bg-gradient-to-br from-[#7b2cbf] to-[#2dd4bf] px-2 py-1 text-[0.7rem] font-semibold text-white/95">
            Novo
          </span>
        )}
        {item.type === "image" ? (
           
          <img
            src={url}
            alt={getItemTitle(item)}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <VideoThumb item={item} />
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-3 py-3 max-sm:px-2.5 max-sm:py-2.5">
        <h3 className="mb-1 line-clamp-2 text-[0.95rem] font-semibold leading-snug text-[#e8e0f0]">
          {getItemTitle(item)}
        </h3>
        <p className="mb-2 text-[0.8rem] text-[rgba(232,224,240,0.6)]">
          @MirageFantasy
        </p>
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="cursor-pointer rounded-md border border-[rgba(147,112,219,0.3)] bg-[rgba(147,112,219,0.25)] px-1.5 py-0.5 text-[0.65rem] text-[rgba(232,224,240,0.85)] transition hover:border-[rgba(147,112,219,0.5)] hover:bg-[rgba(147,112,219,0.4)] max-sm:px-1 max-sm:py-0.5 max-sm:text-[0.6rem]"
              onClick={(e) => {
                e.stopPropagation();
                onTagClick(tag);
              }}
            >
              {tag}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={item.type !== "video" || !item.id}
          onClick={(e) => {
            e.stopPropagation();
            if (item.type !== "video" || !item.id) return;
            onSelectCard(item);
          }}
          className={
            itemIsNew
              ? "mt-auto block min-h-10 w-full touch-manipulation rounded-[10px] bg-gradient-to-br from-[#7b2cbf] to-[#2dd4bf] py-2 text-center text-[0.8rem] font-semibold text-white shadow-[0_4px_14px_rgba(45,212,191,0.3)] disabled:opacity-50 max-sm:min-h-9 max-sm:py-1.5 max-sm:text-[0.75rem]"
              : "mt-auto block min-h-10 w-full touch-manipulation rounded-[10px] bg-gradient-to-br from-[#e91e8c] to-[#ff6b35] py-2 text-center text-[0.8rem] font-semibold text-white shadow-[0_4px_14px_rgba(233,30,140,0.35)] transition group-hover:-translate-y-px group-hover:shadow-[0_6px_20px_rgba(233,30,140,0.45)] disabled:opacity-50 max-sm:min-h-9 max-sm:py-1.5 max-sm:text-[0.75rem]"
          }
        >
          {item.type === "video" && item.id ? "Gerar" : "Indisponível"}
        </button>
      </div>
    </article>
  );
}

/** Observa cards para animaÃ§Ã£o de entrada (como no IntersectionObserver antigo). */
function useRevealCards(
  gridRef: React.RefObject<HTMLDivElement | null>,
  deps: DependencyList,
) {
  useEffect(() => {
    const root = gridRef.current;
    if (!root) return;
    const observed = new WeakSet<Element>();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.visible = "true";
          }
        }
      },
      { rootMargin: "60px 0px", threshold: 0.05 },
    );
    const flushVisible = () => {
      for (const entry of obs.takeRecords()) {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).dataset.visible = "true";
        }
      }
    };
    const watchNew = () => {
      root.querySelectorAll(".mirage-explore-card").forEach((el) => {
        if (observed.has(el)) return;
        observed.add(el);
        obs.observe(el);
      });
    };
    const revealAllOnMobile = () => {
      if (typeof window !== "undefined" && window.innerWidth < 640) {
        root.querySelectorAll(".mirage-explore-card").forEach((el) => {
          (el as HTMLElement).dataset.visible = "true";
        });
      }
    };
    watchNew();
    revealAllOnMobile();
    flushVisible();
    requestAnimationFrame(() => {
      revealAllOnMobile();
      flushVisible();
    });
    const mo = new MutationObserver(() => {
      watchNew();
      flushVisible();
      requestAnimationFrame(() => flushVisible());
    });
    mo.observe(root, { childList: true });
    return () => {
      mo.disconnect();
      obs.disconnect();
    };
  }, [gridRef, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps -- deps vÃªm do caller
}

type MirageExploreClientProps = {
  /** `/explore`: primeiros 10 vÃ­deos no Supabase e mais ao rolar (range). */
  explorePagination?: boolean;
};

export function MirageExploreClient({
  explorePagination = false,
}: MirageExploreClientProps) {
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement>(null);
  const lastScrollYRef = useRef(0);
  const sliceBatch = explorePagination ? BATCH_EXPLORE_DB : BATCH_HOME;
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOrder>("todos");
  const [selectedTag, setSelectedTag] = useState("");
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [controlsHidden, setControlsHidden] = useState(false);
  const [instantShow, setInstantShow] = useState(false);
  const [visibleCount, setVisibleCount] = useState(sliceBatch);
  const [userId, setUserId] = useState<string | null>(null);
  const [dbVideos, setDbVideos] = useState<MediaItem[]>([]);
  const [loadingDbVideos, setLoadingDbVideos] = useState(() =>
    isSupabaseConfigured(),
  );
  const [dbHasMore, setDbHasMore] = useState(true);
  const [loadingMoreDb, setLoadingMoreDb] = useState(false);
  const dbFetchBusy = useRef(false);

  const goToCreate = useCallback(
    (item: MediaItem) => {
      if (item.type !== "video" || !item.id) return;
      router.push(`/criar/${item.id}`);
    },
    [router],
  );

  /** Sempre usa apenas vÃ­deos do Supabase (sem lista estÃ¡tica). */
  const mergedMediaList = useMemo(() => dbVideos, [dbVideos]);

  const loadDbVideos = useCallback(
    async (from: number, append: boolean) => {
      if (!isSupabaseConfigured()) return;
      if (dbFetchBusy.current) return;
      dbFetchBusy.current = true;
      if (append) setLoadingMoreDb(true);
      else setLoadingDbVideos(true);
      try {
        let q = supabase
          .from("videos")
          .select("*")
          .eq("is_published" as any, true)
          .order("id", { ascending: false });
        if (explorePagination) {
          const to = from + BATCH_EXPLORE_DB - 1;
          q = q.range(from, to);
        }
        const { data, error } = await q.abortSignal(AbortSignal.timeout(15000));

        if (!append) {
          console.log("VÃ­deos carregados:", data);
        }

        if (error) {
          console.error(
            "ERRO REAL DO SUPABASE:",
            error.message,
            error.details,
          );
          console.error("[explore] vÃ­deos Supabase:", error);
          if (!append) setDbVideos([]);
          setDbHasMore(false);
          return;
        }

        const rows = data ?? [];
        if (explorePagination) {
          setDbHasMore(rows.length >= BATCH_EXPLORE_DB);
          setDbVideos((prev) => {
            if (append) {
              const base = prev.length;
              return [
                ...prev,
                ...rows
                  .map((row, i) => videoRowToMediaItem(row as VideoRow, base + i))
                  .filter((x): x is MediaItem => x != null),
              ];
            }
            return rows
              .map((row, i) => videoRowToMediaItem(row as VideoRow, i))
              .filter((x): x is MediaItem => x != null);
          });
        } else {
          setDbHasMore(false);
          setDbVideos(
            rows
              .map((row, i) => videoRowToMediaItem(row as VideoRow, i))
              .filter((x): x is MediaItem => x != null),
          );
        }
        if (process.env.NODE_ENV === "development") {
          console.log(
            append ? "[explore] mais vÃ­deos Supabase:" : "[explore] carregados do Supabase:",
            rows.length,
          );
        }
      } finally {
        dbFetchBusy.current = false;
        if (append) setLoadingMoreDb(false);
        else setLoadingDbVideos(false);
      }
    },
    [explorePagination],
  );

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoadingDbVideos(false);
      setDbHasMore(false);
      return;
    }
    void loadDbVideos(0, false);
  }, [loadDbVideos]);

  /** Ao voltar ao separador, pede lista fresca (home e /explore). */
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const refetch = () => {
      if (document.visibilityState !== "visible") return;
      void loadDbVideos(0, false);
    };
    document.addEventListener("visibilitychange", refetch);
    return () => document.removeEventListener("visibilitychange", refetch);
  }, [loadDbVideos]);

  /** Realtime: mudanÃ§as em `public.videos` â†’ refetch. */
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => void loadDbVideos(0, false), 250);
    };

    const channel = supabase
      .channel("realtime:public.videos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "videos" },
        () => schedule(),
      )
      .subscribe();

    return () => {
      if (t) clearTimeout(t);
      void supabase.removeChannel(channel);
    };
  }, [loadDbVideos]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    console.log("VÃ­deos carregados:", dbVideos.length);
  }, [dbVideos.length]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    console.log("dbVideos:", dbVideos);
  }, [dbVideos]);

  const tagsAvailable = useMemo(() => {
    const set = new Set<string>();
    for (const v of dbVideos) {
      for (const t of getTagsForItem(v)) {
        set.add(t);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [dbVideos]);

  const filtered = useMemo(
    () =>
      filterAndSortMedia(mergedMediaList, {
        search,
        sort,
        selectedTag,
      }),
    [mergedMediaList, search, sort, selectedTag],
  );

  useEffect(() => {
    setVisibleCount(Math.min(sliceBatch, Math.max(filtered.length, 0)));
  }, [filtered, sliceBatch]);

  // Home: exibe TODOS os vÃ­deos sem slice. /explore usa paginaÃ§Ã£o visual.
  const displayed = useMemo(
    () => explorePagination ? filtered.slice(0, visibleCount) : filtered,
    [filtered, visibleCount, explorePagination],
  );

  const sentinelRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  /** `/explore`: sentinela visÃ­vel â†’ prÃ³ximo bloco de 10 vÃ­deos no Supabase (repete enquanto houver mais linhas). */
  useEffect(() => {
    if (!explorePagination || !isSupabaseConfigured()) return;
    if (!inView || !dbHasMore || loadingDbVideos || loadingMoreDb) return;
    if (dbVideos.length === 0) return;
    void loadDbVideos(dbVideos.length, true);
  }, [
    inView,
    explorePagination,
    dbHasMore,
    loadingDbVideos,
    loadingMoreDb,
    dbVideos.length,
    loadDbVideos,
  ]);

  useEffect(() => {
    if (inView && visibleCount < filtered.length) {
      setVisibleCount((c) => Math.min(c + sliceBatch, filtered.length));
    }
  }, [inView, visibleCount, filtered.length, sliceBatch]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    void supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_e: AuthChangeEvent, session: Session | null) => {
        setUserId(session?.user?.id ?? null);
      },
    );
    return () => subscription.unsubscribe();
  }, []);

  const searchMsg = useMemo(() => {
    if (filtered.length === 0) {
      const noVideosAtAll =
        dbVideos.length === 0 &&
        search.trim() === "" &&
        selectedTag === "" &&
        sort === "todos";
      if (noVideosAtAll) return "Nenhum vÃ­deo encontrado.";

      const noDbYet =
        explorePagination &&
        dbVideos.length === 0 &&
        search.trim() === "" &&
        selectedTag === "" &&
        sort === "todos";
      if (noDbYet) {
        return "Nenhum tesouro encontrado ainda.";
      }
      return "Nenhum item encontrado. Tente outro termo ou filtro.";
    }
    return filtered.length === 1
      ? "1 item encontrado."
      : `${filtered.length} itens encontrados.`;
  }, [
    filtered.length,
    explorePagination,
    dbVideos.length,
    search,
    selectedTag,
    sort,
  ]);

  const exploreEmptySubtitle = useMemo(() => {
    if (!explorePagination) return "";
    const filteredByUser =
      search.trim() !== "" || selectedTag !== "" || sort !== "todos";
    if (filteredByUser) {
      return "NÃ£o hÃ¡ resultados com estes filtros. Limpa a pesquisa ou experimenta outra tag.";
    }
    return "A galeria estÃ¡ Ã  espera do primeiro conteÃºdo. Volta em breve â€” novos tesouros aparecem aqui quando forem publicados.";
  }, [explorePagination, search, selectedTag, sort]);

  const setTagFilter = useCallback((tag: string) => {
    setSelectedTag((prev) => (prev === tag ? "" : tag));
  }, []);

  const onCardTagClick = useCallback((tag: string) => {
    setSelectedTag((prev) => (prev === tag ? "" : tag));
    setTagMenuOpen(true);
  }, []);

  useRevealCards(gridRef, [search, sort, selectedTag, visibleCount]);

  // Mobile UX: esconde a barra de exploraÃ§Ã£o (search/filtros/tags) ao descer e mostra ao subir.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const isMobile = () => window.innerWidth < 640; // < sm
    lastScrollYRef.current = window.scrollY || 0;

    const onScroll = () => {
      if (!isMobile()) {
        if (controlsHidden) setControlsHidden(false);
        lastScrollYRef.current = window.scrollY || 0;
        return;
      }
      const y = window.scrollY || 0;
      const last = lastScrollYRef.current;
      const delta = y - last;

      // evita â€œtremidoâ€ no topo
      if (y < 12) {
        setControlsHidden(false);
        lastScrollYRef.current = y;
        return;
      }

      if (delta > 10) {
        // Hide suave ao descer
        setInstantShow(false);
        setControlsHidden(true);
      } else if (delta < -8) {
        // Show instantÃ¢neo ao subir
        setInstantShow(true);
        setControlsHidden(false);
        // volta ao modo â€œcom animaÃ§Ã£oâ€ depois do 1Âº frame
        requestAnimationFrame(() => setInstantShow(false));
      }

      lastScrollYRef.current = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [controlsHidden]);

  const loggedIn = Boolean(userId);

  if (process.env.NODE_ENV === "development") {
    console.log("Dados processados para a UI:", mergedMediaList);
  }

  return (
    <>
      <main className="explore-main mx-auto max-w-[1400px] px-4 pb-24 pt-4 sm:pb-10">
        <div
          className={`relative z-10 mb-4 overflow-hidden transition-[max-height,opacity,transform] will-change-[max-height,opacity,transform] ${
            instantShow ? "duration-0" : "duration-300"
          } ${
            controlsHidden
              ? "max-h-0 -translate-y-full opacity-0 pointer-events-none"
              : "max-h-[520px] translate-y-0 opacity-100"
          }`}
          aria-hidden={controlsHidden}
        >
          <div className="flex flex-col gap-3 min-[520px]:flex-row min-[520px]:flex-wrap min-[520px]:items-center">
            <div className="relative min-w-0 w-full flex-1">
              <label htmlFor="search-input" className="sr-only">
                Buscar vÃ­deos
              </label>
              <span
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base opacity-70"
                aria-hidden
              >
                ðŸ”
              </span>
              <input
                id="search-input"
                type="search"
                placeholder="Buscar por nome..."
                autoComplete="off"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-[10px] border border-[rgba(147,112,219,0.25)] bg-[rgba(25,12,38,0.8)] py-2.5 pl-10 pr-3.5 text-[0.95rem] text-[#e8e0f0] placeholder:text-[rgba(232,224,240,0.5)] outline-none focus:border-[rgba(147,112,219,0.5)]"
              />
            </div>

            <div className="w-full shrink-0 min-[520px]:w-auto">
              <label htmlFor="filter-select" className="sr-only">
                Ordenar ou filtrar
              </label>
              <select
                id="filter-select"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOrder)}
                className="w-full min-[520px]:w-auto cursor-pointer appearance-none rounded-[10px] border border-[rgba(147,112,219,0.25)] bg-[rgba(25,12,38,0.8)] bg-[length:12px] bg-[right_12px_center] bg-no-repeat py-2.5 pl-3.5 pr-9 text-[0.95rem] text-[#e8e0f0] outline-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23c9a0dc' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E")`,
                }}
              >
                <option value="todos">Todos</option>
                <option value="az">Ordenar Aâ€“Z</option>
                <option value="za">Ordenar Zâ€“A</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              aria-expanded={tagMenuOpen}
              aria-label={tagMenuOpen ? "Fechar menu de tags" : "Abrir menu de tags"}
              onClick={() => setTagMenuOpen((o) => !o)}
              className={`inline-flex items-center gap-2 rounded-[10px] border border-[rgba(147,112,219,0.35)] bg-[rgba(25,12,38,0.9)] px-4 py-2.5 text-[0.95rem] font-medium text-[rgba(232,224,240,0.9)] transition hover:border-[rgba(147,112,219,0.5)] hover:bg-[rgba(147,112,219,0.2)] ${tagMenuOpen ? "rounded-b-none border-b-transparent" : ""}`}
            >
              <span
                className={`text-xl leading-none transition ${tagMenuOpen ? "rotate-90" : ""}`}
                aria-hidden
              >
                â˜°
              </span>
              <span>Tags</span>
            </button>
            <div
              className={`flex flex-wrap gap-2 border border-t-0 border-[rgba(147,112,219,0.35)] bg-[rgba(20,10,32,0.6)] px-0 pb-3 pt-3 ${tagMenuOpen ? "flex rounded-b-[10px]" : "hidden"}`}
              role="group"
              aria-label="Filtrar por tag"
            >
              <button
                type="button"
                data-tag=""
                className={`rounded-[10px] border px-3.5 py-2 text-[0.85rem] font-medium transition ${selectedTag === "" ? "border-transparent bg-gradient-to-br from-[rgba(123,44,191,0.6)] to-[rgba(233,30,140,0.4)] text-white" : "border-[rgba(147,112,219,0.3)] bg-[rgba(25,12,38,0.8)] text-[rgba(232,224,240,0.85)] hover:border-[rgba(147,112,219,0.5)] hover:bg-[rgba(147,112,219,0.2)]"}`}
                onClick={() => setSelectedTag("")}
              >
                Todos
              </button>
              {tagsAvailable.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`rounded-[10px] border px-3.5 py-2 text-[0.85rem] font-medium capitalize transition ${selectedTag === tag ? "border-transparent bg-gradient-to-br from-[rgba(123,44,191,0.6)] to-[rgba(233,30,140,0.4)] text-white" : "border-[rgba(147,112,219,0.3)] bg-[rgba(25,12,38,0.8)] text-[rgba(232,224,240,0.85)] hover:border-[rgba(147,112,219,0.5)] hover:bg-[rgba(147,112,219,0.2)]"}`}
                  onClick={() => setTagFilter(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <p
            className="mt-4 min-h-[1.25em] text-[0.9rem] text-[rgba(232,224,240,0.8)]"
            aria-live="polite"
          >
            {loadingDbVideos ? (
              <span className="text-violet-200/90">Carregando vÃ­deosâ€¦</span>
            ) : loadingMoreDb && explorePagination ? (
              <span className="text-violet-200/90">A carregar mais vÃ­deosâ€¦</span>
            ) : (
              searchMsg
            )}
          </p>
        </div>

        <div
          ref={gridRef}
          className="grid grid-cols-2 gap-4 min-[480px]:grid-cols-3 min-[480px]:gap-[18px] min-[720px]:grid-cols-4 min-[720px]:gap-5 min-[960px]:grid-cols-5 min-[960px]:gap-6"
        >
          {!loadingDbVideos && displayed.length === 0 ? (
            <div
              className="col-span-full relative flex min-h-[44vh] flex-col items-center justify-center overflow-hidden rounded-[20px] border border-[rgba(147,112,219,0.22)] bg-[linear-gradient(165deg,rgba(35,18,52,0.85)_0%,rgba(18,8,28,0.92)_45%,rgba(26,12,40,0.88)_100%)] px-6 py-16 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_48px_rgba(0,0,0,0.35)]"
              role="status"
              aria-label={
                explorePagination
                  ? "Nenhum tesouro encontrado ainda"
                  : "Nenhum resultado"
              }
            >
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(168,85,247,0.14),transparent_55%),radial-gradient(ellipse_50%_40%_at_80%_100%,rgba(236,72,153,0.08),transparent_50%)]"
                aria-hidden
              />
              {explorePagination ? (
                <div className="relative flex flex-col items-center gap-6">
                  <div className="relative">
                    <div className="absolute inset-0 scale-110 rounded-3xl bg-[radial-gradient(circle_at_50%_50%,rgba(196,181,253,0.2),transparent_65%)] blur-md" />
                    <div className="relative flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-2xl border border-[rgba(196,181,253,0.28)] bg-gradient-to-br from-[rgba(88,28,135,0.55)] via-[rgba(45,18,74,0.9)] to-[rgba(15,6,24,0.95)] shadow-[0_8px_32px_rgba(124,58,237,0.2)]">
                      <Gem
                        className="h-[2.65rem] w-[2.65rem] text-[#f0e7ff]"
                        strokeWidth={1.15}
                        aria-hidden
                      />
                    </div>
                    <Sparkles
                      className="absolute -right-2 -top-2 h-8 w-8 text-amber-200/95 drop-shadow-[0_0_10px_rgba(253,230,138,0.45)]"
                      strokeWidth={1.35}
                      aria-hidden
                    />
                  </div>
                  <div className="relative max-w-md space-y-2">
                    <h3 className="bg-gradient-to-r from-[#f5e9ff] via-[#e9d5ff] to-[#d8b4fe] bg-clip-text text-xl font-semibold tracking-tight text-transparent sm:text-2xl">
                      Nenhum tesouro encontrado ainda
                    </h3>
                    <p className="text-sm leading-relaxed text-[rgba(232,224,240,0.72)]">
                      {exploreEmptySubtitle}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="relative flex flex-col items-center gap-5">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgba(147,112,219,0.25)] bg-[rgba(30,15,48,0.75)]">
                    <Search
                      className="h-8 w-8 text-[#d4b8f0]"
                      strokeWidth={1.35}
                      aria-hidden
                    />
                  </div>
                  <div className="max-w-md space-y-2">
                    <h3 className="text-lg font-semibold text-[#e9d5ff] sm:text-xl">
                      Nada para mostrar
                    </h3>
                    <p className="text-sm text-[rgba(232,224,240,0.72)]">
                      Ajusta a pesquisa ou os filtros para ver mais itens.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            displayed.map((item) => (
              <ExploreGridCard
                key={itemKey(item)}
                item={item}
                onSelectCard={goToCreate}
                onTagClick={onCardTagClick}
              />
            ))
          )}
        </div>

        {visibleCount < filtered.length && (
          <div
            ref={sentinelRef}
            className="invisible mt-4 h-px w-full"
            aria-hidden
          />
        )}
      </main>
    </>
  );
}
