"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import "@/components/css/global.css";
import styles from "@/components/css/home.module.css";

import axiosInstance from "@/utilities/AxiosInstance";
import withAuth from "@/utilities/WithAuth";

import Header from "@/components/private/Header";

type Session = {
  id: number;
  started_at: string;
  completed_at: string | null;
};

type SessionCategory = {
  id: number;
  name: string;
  question_count: number;
  started_at: string | null;
  completed_at: string | null;
  was_corrected: boolean;
};

type CategoriesState = {
  [sessionId: number]: {
    data: SessionCategory[] | null;
    loading: boolean;
    error: string | null;
  };
};

type SessionFilter = "all" | "active" | "completed";
type SortMode = "newest" | "oldest" | "progress";

const CATEGORY_LABELS: Record<string, string> = {
  Marketplace: "Obchod",
  Mountains: "Hory",
  Zoo: "ZOO",
  Home: "Domov",
  Street: "Ulica",
  Parent_answerd: "Odpovede rodiča",
};

const CATEGORY_ORDER = ["Marketplace", "Mountains", "Zoo", "Street", "Home"] as const;

const normalizeName = (s: string) => s.trim().toLowerCase();
const ORDER_NORM = CATEGORY_ORDER.map(normalizeName);

const getErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return fallback;
};

const formatDateTime = (iso: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("sk-SK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (iso: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("sk-SK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const formatDurationMinutes = (startIso: string | null, endIso: string | null) => {
  if (!startIso || !endIso) return "-";

  const start = new Date(startIso);
  const end = new Date(endIso);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "-";

  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return "-";

  const minutes = Math.round(diffMs / 60000);
  return `${minutes} min`;
};

const translateCategoryName = (categoryName: string) => CATEGORY_LABELS[categoryName] ?? "Zlý názov kategórie";
const toCategorySlug = (categoryName: string) => categoryName.trim().toLowerCase();

type StatusPillProps = {
  variant: "active" | "done" | "info";
  children: ReactNode;
};

const StatusPill = ({ variant, children }: StatusPillProps) => {
  return <span className={`status-pill status-pill--${variant}`}>{children}</span>;
};

const getNextRequiredNorm = (categories: SessionCategory[]): string | null => {
  const byName = new Map(categories.map((c) => [normalizeName(c.name), c]));
  for (const n of ORDER_NORM) {
    const cat = byName.get(n);
    if (!cat || !cat.completed_at) return n;
  }
  return null;
};

const getOrderDisplay = () => CATEGORY_ORDER.map((n) => translateCategoryName(String(n))).join(" → ");

const getLabelFromNorm = (norm: string) => {
  const original = CATEGORY_ORDER.find((n) => normalizeName(n) === norm);
  return original ? translateCategoryName(String(original)) : norm;
};

const safeTs = (iso: string | null) => {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
};

const DashboardPage = () => {
  const router = useRouter();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null);

  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [query, setQuery] = useState("");

  const [categoriesState, setCategoriesState] = useState<CategoriesState>({});
  const inFlightCategories = useRef<Set<number>>(new Set());

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoadingSessions(true);
        setSessionsError(null);

        const res = await axiosInstance.get<Session[]>("/sessions");
        setSessions(res.data);
      } catch (err: unknown) {
        setSessionsError(getErrorMessage(err, "Neznáma chyba pri načítaní sedení."));
      } finally {
        setLoadingSessions(false);
      }
    };

    void fetchSessions();
  }, []);

  const fetchCategoriesForSession = async (sessionId: number) => {
    setCategoriesState((prev) => ({
      ...prev,
      [sessionId]: {
        data: prev[sessionId]?.data ?? null,
        loading: true,
        error: null,
      },
    }));

    try {
      const res = await axiosInstance.get<SessionCategory[]>(`/sessions/${sessionId}/categories`);
      setCategoriesState((prev) => ({
        ...prev,
        [sessionId]: {
          data: res.data,
          loading: false,
          error: null,
        },
      }));
    } catch (err: unknown) {
      setCategoriesState((prev) => ({
        ...prev,
        [sessionId]: {
          data: prev[sessionId]?.data ?? null,
          loading: false,
          error: getErrorMessage(err, "Neznáma chyba pri načítaní kategórií."),
        },
      }));
    }
  };

  useEffect(() => {
    if (loadingSessions || sessionsError) return;
    if (sessions.length === 0) return;

    for (const s of sessions) {
      if (categoriesState[s.id]) continue;
      if (inFlightCategories.current.has(s.id)) continue;

      inFlightCategories.current.add(s.id);
      fetchCategoriesForSession(s.id)
        .catch(() => undefined)
        .finally(() => {
          inFlightCategories.current.delete(s.id);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingSessions, sessionsError, sessions, categoriesState]);

  const handleOpenCorrection = (sessionId: number, categoryId: number, categoryName: string) => {
    const slug = toCategorySlug(categoryName);

    router.push(
      `/dashboard/correct/${encodeURIComponent(slug)}?sessionId=${encodeURIComponent(
        String(sessionId),
      )}&categoryId=${encodeURIComponent(String(categoryId))}`,
    );
  };

  const handleStartCategory = (sessionId: number, categoryName: string) => {
    const slug = toCategorySlug(categoryName);
    router.push(`/testing/${encodeURIComponent(slug)}?sessionId=${encodeURIComponent(String(sessionId))}`);
  };

  const handleToggleSession = (sessionId: number) => {
    setExpandedSessionId((prev) => (prev === sessionId ? null : sessionId));
  };

  const headerStats = useMemo(() => {
    const total = sessions.length;
    const active = sessions.filter((s) => !s.completed_at).length;
    const done = sessions.filter((s) => !!s.completed_at).length;
    return { total, active, done };
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    const q = query.trim().toLowerCase();

    const enriched = sessions.map((s) => {
      const cats = categoriesState[s.id]?.data ?? null;
      const totalCats = cats?.length ?? 0;
      const completedCats = cats ? cats.filter((c) => !!c.completed_at).length : 0;
      const progress = totalCats > 0 ? completedCats / totalCats : -1;
      return {
        ...s,
        _ts: safeTs(s.started_at),
        _totalCats: totalCats,
        _completedCats: completedCats,
        _progress: progress,
      };
    });

    const statusFiltered = enriched.filter((s) => {
      if (sessionFilter === "active") return !s.completed_at;
      if (sessionFilter === "completed") return !!s.completed_at;
      return true;
    });

    const queryFiltered =
      q.length === 0
        ? statusFiltered
        : statusFiltered.filter((s) => {
            const idStr = String(s.id);
            const dateStr = formatDate(s.started_at);
            const dateTimeStr = formatDateTime(s.started_at);
            return idStr.includes(q) || dateStr.toLowerCase().includes(q) || dateTimeStr.toLowerCase().includes(q);
          });

    const sorted = [...queryFiltered].sort((a, b) => {
      if (sortMode === "oldest") return a._ts - b._ts;
      if (sortMode === "progress") {
        const ap = a._progress;
        const bp = b._progress;
        const aKnown = ap >= 0 ? 1 : 0;
        const bKnown = bp >= 0 ? 1 : 0;
        if (aKnown !== bKnown) return bKnown - aKnown;
        if (ap !== bp) return bp - ap;
        return b._ts - a._ts;
      }
      return b._ts - a._ts;
    });

    return sorted;
  }, [sessions, categoriesState, sessionFilter, sortMode, query]);

  return (
    <>
      <Header />
      <main className="container d-flex flex-column align-items-start">
        <div className="glass p-3 p-lg-4 mb-4 w-100">
          <div className="d-flex flex-column gap-3">
            <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
              <div className="d-flex flex-column gap-1">
                <h1 className={`${styles.dashTitle} mb-0`}>Prehľad testov</h1>
                <div className="d-flex flex-wrap gap-2 small">
                  <StatusPill variant="info">Spolu: {headerStats.total}</StatusPill>
                  <StatusPill variant="active">Prebieha: {headerStats.active}</StatusPill>
                  <StatusPill variant="done">Ukončené: {headerStats.done}</StatusPill>
                </div>
              </div>

              <div className={styles.filterBar}>
                <div className={styles.filterPills}>
                  <button
                    type="button"
                    className={`status-pill status-pill--info ${styles.filterPill} ${sessionFilter === "all" ? styles.filterPillActive : ""}`}
                    onClick={() => setSessionFilter("all")}
                    aria-pressed={sessionFilter === "all"}
                  >
                    Všetky <span className={styles.filterCount}>{headerStats.total}</span>
                  </button>

                  <button
                    type="button"
                    className={`status-pill status-pill--active ${styles.filterPill} ${sessionFilter === "active" ? styles.filterPillActive : ""}`}
                    onClick={() => setSessionFilter("active")}
                    aria-pressed={sessionFilter === "active"}
                  >
                    Prebieha <span className={styles.filterCount}>{headerStats.active}</span>
                  </button>

                  <button
                    type="button"
                    className={`status-pill status-pill--done ${styles.filterPill} ${sessionFilter === "completed" ? styles.filterPillActive : ""}`}
                    onClick={() => setSessionFilter("completed")}
                    aria-pressed={sessionFilter === "completed"}
                  >
                    Ukončené <span className={styles.filterCount}>{headerStats.done}</span>
                  </button>
                </div>

                <div className={styles.filterControls}>
                  <input
                    className={`form-control form-control-sm glass-input ${styles.searchInput}`}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Hľadať (ID alebo dátum)"
                    aria-label="Hľadať sedenia"
                  />

                  <select
                    className={`form-select form-select-sm glass-input ${styles.sortSelect}`}
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as SortMode)}
                    aria-label="Zoradenie sedení"
                  >
                    <option value="newest">Najnovšie</option>
                    <option value="oldest">Najstaršie</option>
                    <option value="progress">Podľa progresu</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-2">
              <p className="mb-0">Tu nájdete všetky vaše testovacie sedenia a stav jednotlivých kategórií.</p>
              <div className="small text-muted">
                <span className="fw-semibold">Poradie:</span> {getOrderDisplay()}
              </div>
            </div>
          </div>

          {loadingSessions && <p className="mt-3 mb-0">Načítavam testovania...</p>}

          {sessionsError && (
            <div className="alert alert-danger mt-3 mb-0" role="alert">
              {sessionsError}
            </div>
          )}

          {!loadingSessions && !sessionsError && sessions.length === 0 && <p className="mt-3 mb-0">Zatiaľ nemáte žiadne testovania.</p>}
        </div>

        {!loadingSessions && !sessionsError && filteredSessions.length === 0 && (
          <div className="glass p-3 w-100">
            <p className="mb-0 small text-muted">Nenašli sa žiadne testovania pre zadaný filter.</p>
          </div>
        )}

        {!loadingSessions && !sessionsError && filteredSessions.length > 0 && (
          <div className="w-100 d-flex flex-column mb-3">
            {filteredSessions.map((session) => {
              const isOpen = expandedSessionId === session.id;
              const isCompleted = !!session.completed_at;

              const catState = categoriesState[session.id];
              const categories = catState?.data ?? [];
              const catsLoading = catState?.loading ?? true;
              const catsError = catState?.error ?? null;
              const hasCategories = categories.length > 0;

              const completedCount = hasCategories ? categories.filter((c) => !!c.completed_at).length : 0;
              const correctedCount = hasCategories ? categories.filter((c) => c.was_corrected).length : 0;
              const progressPct = hasCategories ? Math.round((completedCount / categories.length) * 100) : 0;

              const nextRequiredNorm = hasCategories ? getNextRequiredNorm(categories) : null;
              const orderedAllDone = hasCategories ? nextRequiredNorm === null : false;

              return (
                <div key={session.id} className="glass p-0 w-100 mb-3">
                  <div className="accordion glass-accordion">
                    <div className="accordion-item">
                      <h2 className="accordion-header">
                        <button
                          type="button"
                          className={`accordion-button ${isOpen ? "" : "collapsed"}`}
                          onClick={() => handleToggleSession(session.id)}
                        >
                          <div className="d-flex flex-column w-100 gap-2">
                            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                              <div className="d-flex flex-wrap align-items-center gap-2">
                                <strong>Testovanie</strong>
                                <span className="small text-muted">zo dňa: {formatDate(session.started_at)}</span>
                                <StatusPill variant={isCompleted ? "done" : "active"}>{isCompleted ? "Ukončené" : "Prebieha"}</StatusPill>
                              </div>

                              {catsLoading ? (
                                <span className="small text-muted">Načítavam kategórie...</span>
                              ) : hasCategories ? (
                                <span className="small text-muted">
                                  Dokončené: <span className="fw-semibold">{completedCount}</span>/{categories.length} • Skontrolované:{" "}
                                  <span className="fw-semibold">{correctedCount}</span>/{categories.length}
                                </span>
                              ) : (
                                <span className="small text-muted">Žiadne kategórie</span>
                              )}
                            </div>

                            {!catsLoading && hasCategories && (
                              <div className="d-flex flex-column gap-1">
                                <div className="progress" style={{ height: 8 }}>
                                  <div
                                    className="progress-bar"
                                    role="progressbar"
                                    style={{ width: `${progressPct}%` }}
                                    aria-valuenow={progressPct}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                  />
                                </div>

                                {!isCompleted && (
                                  <div className="small text-muted">
                                    <span className="fw-semibold">
                                      {orderedAllDone ? "Všetky povinné kategórie sú dokončené." : getLabelFromNorm(nextRequiredNorm ?? "")}
                                    </span>
                                    {orderedAllDone
                                      ? "Všetky povinné kategórie sú dokončené."
                                      : nextRequiredNorm === "marketplace"
                                        ? `${getLabelFromNorm(nextRequiredNorm)} (spúšťa sa cez „Nová hra“).`
                                        : getLabelFromNorm(nextRequiredNorm ?? "")}
                                  </div>
                                )}
                              </div>
                            )}

                            {!catsLoading && catsError && <div className="small text-danger">Chyba: {catsError}</div>}
                          </div>
                        </button>
                      </h2>

                      <div className={`accordion-collapse collapse ${isOpen ? "show" : ""}`}>
                        <div className="accordion-body">
                          <div className="mb-3">
                            <div className="row g-2">
                              <div className="col-12 col-lg-4">
                                <div className="p-2 rounded border bg-transparent">
                                  <div className="small text-muted">Začiatok</div>
                                  <div className="fw-semibold">{formatDateTime(session.started_at)}</div>
                                </div>
                              </div>
                              <div className="col-12 col-lg-4">
                                <div className="p-2 rounded border bg-transparent">
                                  <div className="small text-muted">Ukončené</div>
                                  <div className="fw-semibold">{formatDateTime(session.completed_at)}</div>
                                </div>
                              </div>
                              <div className="col-12 col-lg-4">
                                <div className="p-2 rounded border bg-transparent">
                                  <div className="small text-muted">Stav</div>
                                  <div className="fw-semibold">{isCompleted ? "Ukončené" : "Prebieha"}</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {catsLoading && (
                            <div className="d-flex flex-column gap-2">
                              <div className="placeholder-glow">
                                <span className="placeholder col-12" />
                              </div>
                              <div className="placeholder-glow">
                                <span className="placeholder col-10" />
                              </div>
                              <div className="placeholder-glow">
                                <span className="placeholder col-8" />
                              </div>
                            </div>
                          )}

                          {!catsLoading && !catsError && !hasCategories && (
                            <p className="mb-0 small text-muted">Žiadne kategórie pre toto sedenie.</p>
                          )}

                          {!catsLoading && !catsError && hasCategories && !isCompleted && (
                            <div className="alert alert-info py-2 px-3 mb-3" role="alert">
                              <div className="small">
                                <strong>Poradie:</strong> {getOrderDisplay()}
                              </div>
                              <div className="small mt-1">
                                <strong>
                                  {orderedAllDone ? "Všetky povinné kategórie sú dokončené." : getLabelFromNorm(nextRequiredNorm ?? "")}
                                </strong>
                                {orderedAllDone
                                  ? "Všetky povinné kategórie sú dokončené."
                                  : nextRequiredNorm === "marketplace"
                                    ? `${getLabelFromNorm(nextRequiredNorm)} (spúšťa sa cez „Nová hra“).`
                                    : getLabelFromNorm(nextRequiredNorm ?? "")}
                              </div>
                            </div>
                          )}

                          {!catsLoading && !catsError && hasCategories && (
                            <ul className="category-list">
                              {categories.map((category) => {
                                const isCategoryCompleted = !!category.completed_at;
                                const startedAt = category.started_at;
                                const completedAt = category.completed_at;
                                const isCorrected = category.was_corrected;

                                const norm = normalizeName(category.name);
                                const isMarketplace = norm === "marketplace";
                                const isOrderedCategory = ORDER_NORM.includes(norm);
                                const orderIndex = ORDER_NORM.indexOf(norm);

                                const nextIsThis = !orderedAllDone && nextRequiredNorm === norm;

                                const isAllowedToStart = orderedAllDone ? !isCategoryCompleted : isOrderedCategory && nextRequiredNorm === norm;

                                const startDisabledReason = (() => {
                                  if (isCategoryCompleted) return "Kategória je už dokončená.";

                                  if (!orderedAllDone) {
                                    if (!isOrderedCategory) {
                                      return `Najprv dokončite povinné kategórie v poradí: ${getOrderDisplay()}.`;
                                    }

                                    if (nextRequiredNorm && norm !== nextRequiredNorm) {
                                      return `Najprv dokončite: ${getLabelFromNorm(nextRequiredNorm)}.`;
                                    }
                                  }

                                  return "";
                                })();

                                return (
                                  <li
                                    key={category.id}
                                    className={`category-list-item ${nextIsThis ? "border border-2 border-primary rounded" : ""}`}
                                  >
                                    <div className="category-main">
                                      <div className="d-flex align-items-center gap-2 flex-wrap">
                                        {orderIndex >= 0 && (
                                          <span className="badge bg-light text-dark border" title="Poradie kategórie">
                                            {orderIndex + 1}
                                          </span>
                                        )}
                                        <span className="fw-semibold">Kategória: {translateCategoryName(category.name)}</span>
                                        {nextIsThis && !isMarketplace && <span className="badge bg-primary">Ďalšia</span>}
                                      </div>

                                      <div className="d-flex flex-wrap gap-2 mt-1">
                                        <StatusPill variant={isCategoryCompleted ? "done" : "active"}>
                                          {isCategoryCompleted ? "Dokončená" : "Nedokončená"}
                                        </StatusPill>

                                        <StatusPill variant={isCorrected ? "done" : "active"}>
                                          {isCorrected ? "Skontrolovaná" : "Neskontrolovaná"}
                                        </StatusPill>
                                      </div>

                                      <div className="d-flex flex-wrap gap-3 mt-1">
                                        <span className="small text-muted">Začiatok: {startedAt ? formatDateTime(startedAt) : "-"}</span>
                                        <span className="small text-muted">Čas vyplňania: {formatDurationMinutes(startedAt, completedAt)}</span>
                                      </div>

                                      {!isAllowedToStart && !isCategoryCompleted && startDisabledReason && (
                                        <div className="small text-muted mt-1">{startDisabledReason}</div>
                                      )}
                                    </div>

                                    <div className="category-actions">
                                      <button
                                        type="button"
                                        className="btn btn-outline-secondary btn-sm"
                                        disabled={!isCategoryCompleted || isCorrected}
                                        onClick={() => handleOpenCorrection(session.id, category.id, category.name)}
                                      >
                                        {isCorrected ? "Skontrolovaná" : "Opraviť"}
                                      </button>

                                      <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        disabled={isCategoryCompleted || !isAllowedToStart}
                                        aria-disabled={isCategoryCompleted || !isAllowedToStart}
                                        title={startDisabledReason}
                                        onClick={() => {
                                          if (isCategoryCompleted || !isAllowedToStart) return;
                                          handleStartCategory(session.id, category.name);
                                        }}
                                      >
                                        Spustiť kategóriu
                                      </button>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
};

export default withAuth(DashboardPage);
