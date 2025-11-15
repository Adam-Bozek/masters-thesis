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

const getErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return fallback;
};

const DashboardPage = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null);

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

      // Update local state so UI reflects was_corrected = true
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
        const sessionState = prev[sessionId] ?? {
          data: null,
          loading: false,
          error: null,
        };

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
    return d.toLocaleString("sk-SK", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const printCategoryName = (category_name: string) => {
    if (category_name === "Marketplace") {
      return "Obchod";
    } else if (category_name === "Mountains") {
      return "Hory";
    } else if (category_name === "Zoo") {
      return "ZOO";
    } else if (category_name === "Home") {
      return "Domov";
    } else if (category_name === "Street") {
      return "Ulica";
    } else if (category_name === "Parent_answerd") {
      return "Odpovede rodiča";
    } else {
      return "Zlý názov kategórie";
    }
  };

  const formatDurationMinutes = (startIso: string | null, endIso: string | null) => {
    if (!startIso || !endIso) return "-";

    const start = new Date(startIso);
    const end = new Date(endIso);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "-";

    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return "-";

    const minutes = Math.round(diffMs / 60000); // 60 * 1000

    return `${minutes} min`;
  };

  return (
    <>
      <Header />
      <main className="container d-flex flex-column align-items-start">
        <div className="glass p-3 p-lg-5 mb-4 w-100">
          <h1 className={`${styles.title} mb-3`}>História sedení</h1>
          <p className="mb-4">
            Tu nájdete všetky vaše testovacie sedenia. Každé sedenie je v samostatnom akordeóne – po rozbalení uvidíte
            podrobnosti a stav kategórií.
          </p>

          {loadingSessions && <p>Načítavam sedenia...</p>}

          {sessionsError && (
            <div className="alert alert-danger" role="alert">
              {sessionsError}
            </div>
          )}

          {!loadingSessions && !sessionsError && sessions.length === 0 && <p>Zatiaľ nemáte žiadne sedenia.</p>}
        </div>

        {!loadingSessions && !sessionsError && sessions.length > 0 && (
          <div className="w-100 d-flex flex-column gap-3">
            {sessions.map((session) => {
              const isOpen = expandedSessionId === session.id;
              const isCompleted = !!session.completed_at;

              const catState = categoriesState[session.id];
              const categories = catState?.data ?? [];
              const catsLoading = catState?.loading;
              const catsError = catState?.error;

              return (
                <div key={session.id} className="glass p-0 w-100">
                  <div className="accordion glass-accordion" id={`sessionAccordion-${session.id}`}>
                    <div className="accordion-item">
                      <h2 className="accordion-header">
                        <button
                          type="button"
                          className={`accordion-button ${isOpen ? "" : "collapsed"}`}
                          onClick={() => handleToggleSession(session.id)}
                        >
                          <div className="d-flex flex-column flex-lg-row w-100 justify-content-between align-items-lg-center gap-1">
                            <div className="d-flex align-items-center gap-2">
                              <strong>Sedenie #{session.id}</strong>
                              <span
                                className={`status-pill ${isCompleted ? "status-pill--done" : "status-pill--active"}`}
                              >
                                {isCompleted ? "Ukončené" : "Prebieha"}
                              </span>
                            </div>

                            <span className="small text-muted me-4">Začiatok: {formatDate(session.started_at)}</span>
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
                                  const completedAt = category.completed_at;
                                  const isCorrected = category.was_corrected;
                                  const startedAt = category.started_at;

                                  return (
                                    <li
                                      key={category.id}
                                      className="category-list-item d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2"
                                    >
                                      <div className="d-flex flex-wrap align-items-center gap-2">
                                        <span className="fw-semibold">{printCategoryName(category.name)}</span>

                                        <span
                                          className={`status-pill ${
                                            isCategoryCompleted ? "status-pill--done" : "status-pill--active"
                                          }`}
                                        >
                                          {isCategoryCompleted ? "Dokončená" : "Nedokončená"}
                                        </span>

                                        <span
                                          className={`status-pill ${
                                            isCorrected ? "status-pill--done" : "status-pill--active"
                                          }`}
                                        >
                                          {isCorrected ? "Skontrolovaná" : "Neskontrolovaná"}
                                        </span>

                                        {/* optional: show both start + end */}
                                        <span className="small text-muted ms-1">
                                          Začiatok: {startedAt ? formatDateTime(startedAt) : "-"}
                                        </span>
                                        <span className="small text-muted ms-1">
                                          Čas vyplňania: {formatDurationMinutes(startedAt, completedAt)}
                                        </span>
                                      </div>

                                      <div className="d-flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          className="btn btn-outline-secondary btn-sm"
                                          disabled={!isCategoryCompleted || isCorrected} // 👈 prevent double/early correction
                                          onClick={() => handleCorrectCategory(session.id, category.id)} // 👈 call handler
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
