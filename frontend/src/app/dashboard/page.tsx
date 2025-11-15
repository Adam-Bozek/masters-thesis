"use client";

import { useEffect, useState } from "react";
import "@/components/css/global.css";
import styles from "@/components/css/home.module.css";

import axiosInstance from "@/utilities/AxiosInstance";
import withAuth from "@/utilities/WithAuth";

type Session = {
  id: number;
  started_at: string;
  completed_at: string | null;
};

type Answer = {
  id: number;
  category_id: number;
  question_number: number;
  answer_state: string;
  user_answer: string | null;
  answered_at: string | null;
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
  const [answersBySession, setAnswersBySession] = useState<Record<number, Answer[]>>({});
  const [answersLoadingId, setAnswersLoadingId] = useState<number | null>(null);
  const [answersErrorBySession, setAnswersErrorBySession] = useState<Record<number, string | null>>({});

  // ---- Load sessions -------------------------------------------------

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoadingSessions(true);
        setSessionsError(null);

        // axiosInstance already has baseURL + Authorization header
        const res = await axiosInstance.get<Session[]>("/sessions");
        console.log(res);
        setSessions(res.data);
      } catch (err: unknown) {
        setSessionsError(getErrorMessage(err, "Neznáma chyba pri načítaní sedení."));
      } finally {
        setLoadingSessions(false);
      }
    };

    void fetchSessions();
  }, []);

  // ---- Toggle accordion + load answers ------------------------------

  const handleToggleSession = async (sessionId: number) => {
    // close if already open
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      return;
    }

    setExpandedSessionId(sessionId);

    // if already loaded, do not refetch
    if (answersBySession[sessionId]) return;

    try {
      setAnswersLoadingId(sessionId);
      setAnswersErrorBySession((prev) => ({ ...prev, [sessionId]: null }));

      const res = await axiosInstance.get<Answer[]>(`/sessions/${sessionId}/answers`);

      setAnswersBySession((prev) => ({
        ...prev,
        [sessionId]: res.data,
      }));
    } catch (err: unknown) {
      setAnswersErrorBySession((prev) => ({
        ...prev,
        [sessionId]: getErrorMessage(err, "Neznáma chyba pri načítaní odpovedí."),
      }));
    } finally {
      setAnswersLoadingId(null);
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

  // ---- Render --------------------------------------------------------

  return (
    <main className="d-flex align-items-start py-3 py-lg-4">
      <div className="container glass p-3 p-lg-5">
        <h1 className={`${styles.title} mb-3`}>História sedení</h1>
        <p className="mb-4">
          Tu nájdete všetky vaše testovacie sedenia. Každé sedenie je v samostatnom akordeóne – po rozbalení uvidíte
          podrobnosti a odpovede.
        </p>

        {loadingSessions && <p>Načítavam sedenia...</p>}

        {sessionsError && (
          <div className="alert alert-danger" role="alert">
            {sessionsError}
          </div>
        )}

        {!loadingSessions && !sessionsError && sessions.length === 0 && <p>Zatiaľ nemáte žiadne sedenia.</p>}

        {!loadingSessions && !sessionsError && sessions.length > 0 && (
          <div className="accordion" id="sessionsAccordion">
            {sessions.map((session) => {
              const isOpen = expandedSessionId === session.id;
              const answers = answersBySession[session.id] ?? [];
              const answersError = answersErrorBySession[session.id] ?? null;

              return (
                <div className="accordion-item mb-2" key={session.id}>
                  <h2 className="accordion-header">
                    <button
                      type="button"
                      className={`accordion-button ${isOpen ? "" : "collapsed"}`}
                      onClick={() => void handleToggleSession(session.id)}
                    >
                      <div className="d-flex flex-column flex-lg-row w-100 justify-content-between">
                        <span>
                          <strong>Sedenie #{session.id}</strong>
                        </span>
                        <span className="small text-muted">
                          Začiatok: {formatDateTime(session.started_at)} {" • "}
                          Stav: {session.completed_at ? "Ukončené" : "Prebieha"}
                        </span>
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
                          <strong>Stav:</strong> {session.completed_at ? "Ukončené" : "Prebieha"}
                        </p>
                      </div>

                      {answersLoadingId === session.id && <p>Načítavam odpovede...</p>}

                      {answersError && (
                        <div className="alert alert-warning" role="alert">
                          {answersError}
                        </div>
                      )}

                      {!answersError && answersLoadingId !== session.id && answers.length === 0 && (
                        <p>V tomto sedení zatiaľ nie sú žiadne odpovede.</p>
                      )}

                      {!answersError && answersLoadingId !== session.id && answers.length > 0 && (
                        <div className="table-responsive">
                          <table className="table table-sm align-middle mb-0">
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Kategória</th>
                                <th>Otázka</th>
                                <th>Stav odpovede</th>
                                <th>Odpoveď</th>
                                <th>Čas odpovede</th>
                              </tr>
                            </thead>
                            <tbody>
                              {answers.map((a, idx) => (
                                <tr key={a.id}>
                                  <td>{idx + 1}</td>
                                  <td>{a.category_id}</td>
                                  <td>{a.question_number}</td>
                                  <td>{a.answer_state}</td>
                                  <td className="text-truncate" style={{ maxWidth: "220px" }}>
                                    {a.user_answer ?? "-"}
                                  </td>
                                  <td>{formatDateTime(a.answered_at)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
};

// 🔒 Protect the page with your existing auth HOC
export default withAuth(DashboardPage);
//export default DashboardPage;
