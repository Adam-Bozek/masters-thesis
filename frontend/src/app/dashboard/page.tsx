"use client";

import { useEffect, useState } from "react";

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

const CATEGORY_LABELS: Record<string, string> = {
  Marketplace: "Obchod",
  Mountains: "Hory",
  Zoo: "ZOO",
  Home: "Domov",
  Street: "Ulica",
  Parent_answerd: "Odpovede rodiča",
};

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

type StatusPillProps = {
  variant: "active" | "done" | "info";
  children: React.ReactNode;
};

const StatusPill = ({ variant, children }: StatusPillProps) => {
  return <span className={`status-pill status-pill--${variant}`}>{children}</span>;
};

const DashboardPage = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null);
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");

  const [categoriesState, setCategoriesState] = useState<CategoriesState>({});

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

  const handleCorrectCategory = async (sessionId: number, categoryId: number) => {
    try {
      await axiosInstance.patch(`/sessions/${sessionId}/categories/${categoryId}/correct`);

      setCategoriesState((prev) => {
        const sessionState = prev[sessionId];
        if (!sessionState || !sessionState.data) return prev;

        return {
          ...prev,
          [sessionId]: {
            ...sessionState,
            data: sessionState.data.map((cat) => (cat.id === categoryId ? { ...cat, was_corrected: true } : cat)),
          },
        };
      });
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Nepodarilo sa označiť kategóriu ako skontrolovanú.");

      setCategoriesState((prev) => {
        const sessionState =
          prev[sessionId] ??
          ({
            data: null,
            loading: false,
            error: null,
          } as CategoriesState[number]);

        return {
          ...prev,
          [sessionId]: {
            ...sessionState,
            error: message,
          },
        };
      });
    }
  };

  const handleToggleSession = (sessionId: number) => {
    const willOpen = expandedSessionId !== sessionId;

    setExpandedSessionId((prev) => (prev === sessionId ? null : sessionId));

    if (willOpen && !categoriesState[sessionId]) {
      void fetchCategoriesForSession(sessionId);
    }
  };

  const filteredSessions = sessions.filter((s) => {
    if (sessionFilter === "active") return !s.completed_at;
    if (sessionFilter === "completed") return !!s.completed_at;
    return true;
  });

  return (
    <>
      <Header />
      <main className="container d-flex flex-column align-items-start">
        <div className="glass p-3 p-lg-4 mb-4 w-100">
          <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-3">
            <h1 className={`${styles.dashTitle} mb-0`}>Prehľad testov 📋</h1>

            {/* Segmented filter */}
            <div className="segmented">
              <button
                type="button"
                className={`segBtn ${sessionFilter === "all" ? "active" : ""}`}
                onClick={() => setSessionFilter("all")}
              >
                Všetky
              </button>
              <button
                type="button"
                className={`segBtn ${sessionFilter === "active" ? "active" : ""}`}
                onClick={() => setSessionFilter("active")}
              >
                Prebieha
              </button>
              <button
                type="button"
                className={`segBtn ${sessionFilter === "completed" ? "active" : ""}`}
                onClick={() => setSessionFilter("completed")}
              >
                Ukončené
              </button>
            </div>
          </div>

          <p className="mb-0">
            Tu nájdete všetky vaše testovacie sedenia. Kliknutím na testovanie zobrazíte podrobnosti a stav jednotlivých
            kategórií.
          </p>

          {loadingSessions && <p className="mt-3 mb-0">Načítavam testovania...</p>}

          {sessionsError && (
            <div className="alert alert-danger mt-3 mb-0" role="alert">
              {sessionsError}
            </div>
          )}

          {!loadingSessions && !sessionsError && sessions.length === 0 && (
            <p className="mt-3 mb-0">Zatiaľ nemáte žiadne testovania.</p>
          )}
        </div>

        {!loadingSessions && !sessionsError && filteredSessions.length > 0 && (
          <div className="w-100 d-flex flex-column mb-3">
            {filteredSessions.map((session) => {
              const isOpen = expandedSessionId === session.id;
              const isCompleted = !!session.completed_at;

              const catState = categoriesState[session.id];
              const categories = catState?.data ?? [];
              const catsLoading = catState?.loading;
              const catsError = catState?.error;

              const completedCount = categories.filter((c) => !!c.completed_at).length;
              const correctedCount = categories.filter((c) => c.was_corrected).length;
              const hasCategories = categories.length > 0;

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
                            <div className="d-flex flex-wrap align-items-center gap-2">
                              <strong>Testovanie</strong>
                              <span className="small text-muted">zo dňa: {formatDate(session.started_at)}</span>
                              <StatusPill variant={isCompleted ? "done" : "active"}>
                                {isCompleted ? "Ukončené" : "Prebieha"}
                              </StatusPill>
                            </div>

                            {/* Mini summary if categories are loaded */}
                            {hasCategories && (
                              <div className="d-flex flex-wrap gap-2 small">
                                <StatusPill variant="info">
                                  Dokončené kategórie: {completedCount}/{categories.length}
                                </StatusPill>
                                <StatusPill variant="info">
                                  Skontrolované: {correctedCount}/{categories.length}
                                </StatusPill>
                              </div>
                            )}
                          </div>
                        </button>
                      </h2>

                      <div className={`accordion-collapse collapse ${isOpen ? "show" : ""}`}>
                        <div className="accordion-body">
                          <div className="mb-3">
                            <p className="mb-1">
                              <strong>Začiatok:</strong> {formatDateTime(session.started_at)}
                            </p>
                            <p className="mb-1">
                              <strong>Ukončené:</strong> {formatDateTime(session.completed_at)}
                            </p>
                            <p className="mb-0">
                              <strong>Stav:</strong> {isCompleted ? "Ukončené" : "Prebieha"}
                            </p>
                          </div>

                          <div className="mt-3">
                            {catsLoading && <p className="mb-0 small">Načítavam kategórie...</p>}

                            {catsError && (
                              <p className="mb-0 small text-danger">Chyba pri načítaní kategórií: {catsError}</p>
                            )}

                            {!catsLoading && !catsError && categories.length === 0 && (
                              <p className="mb-0 small text-muted">Žiadne kategórie pre toto sedenie.</p>
                            )}

                            {!catsLoading && !catsError && categories.length > 0 && (
                              <ul className="category-list">
                                {categories.map((category) => {
                                  const isCategoryCompleted = !!category.completed_at;
                                  const startedAt = category.started_at;
                                  const completedAt = category.completed_at;
                                  const isCorrected = category.was_corrected;

                                  return (
                                    <li key={category.id} className="category-list-item">
                                      <div className="category-main">
                                        <span className="fw-semibold">
                                          Kategória: {translateCategoryName(category.name)}
                                        </span>

                                        <StatusPill variant={isCategoryCompleted ? "done" : "active"}>
                                          {isCategoryCompleted ? "Dokončená" : "Nedokončená"}
                                        </StatusPill>

                                        <StatusPill variant={isCorrected ? "done" : "active"}>
                                          {isCorrected ? "Skontrolovaná" : "Neskontrolovaná"}
                                        </StatusPill>

                                        <span className="small text-muted">
                                          Začiatok: {startedAt ? formatDateTime(startedAt) : "-"}
                                        </span>
                                        <span className="small text-muted">
                                          Čas vyplňania: {formatDurationMinutes(startedAt, completedAt)}
                                        </span>
                                      </div>

                                      <div className="category-actions">
                                        <button
                                          type="button"
                                          className="btn btn-outline-secondary btn-sm"
                                          disabled={!isCategoryCompleted || isCorrected}
                                          onClick={() => handleCorrectCategory(session.id, category.id)}
                                        >
                                          {isCorrected ? "Skontrolovaná" : "Opraviť"}
                                        </button>

                                        <button type="button" className="btn btn-primary btn-sm">
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
