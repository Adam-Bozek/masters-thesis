/**
 * @ Author: Bc. Adam Božek
 * @ Create Time: 2025-10-22 16:40:57
 * @ Description: This repository contains a full-stack application suite developed within a master’s thesis.
		 It is designed to support the screening of children using the Slovak
		 implementation of the TEKOS II screening instrument, short version. Copyright (C) 2026  Bc. Adam Božek
 * @ License: This program is free software: you can redistribute it and/or modify it under the terms of
		 the GNU Affero General Public License as published by the Free Software Foundation, either
		 version 3 of the License, or any later version. This program is distributed in the hope
		 that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty
		 of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
		 See the GNU Affero General Public License for more details.
		 You should have received a copy of the GNU Affero General Public License along with this program.
		 If not, see <https://www.gnu.org/licenses/>..
 */

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
  public_id?: string | null;
  note: string | null;
  is_guest?: boolean;
  started_at: string;
  last_activity_at?: string | null;
  expires_at?: string | null;
  completed_at: string | null;
  answers_count?: number;
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

type ExportState = {
  loading: boolean;
  error: string | null;
};

type SaveState = {
  loading: boolean;
  error: string | null;
};

type MeResponse = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
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

const getDownloadFilename = (headerValue: unknown, fallback: string) => {
  if (typeof headerValue !== "string" || !headerValue.trim()) return fallback;

  const utfMatch = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch {
      return utfMatch[1];
    }
  }

  const quotedMatch = headerValue.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1];

  const plainMatch = headerValue.match(/filename=([^;]+)/i);
  if (plainMatch?.[1]) return plainMatch[1].trim();

  return fallback;
};

const getBlobErrorMessage = async (blob: Blob, fallback: string): Promise<string> => {
  try {
    const raw = await blob.text();
    if (!raw.trim()) return fallback;

    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "message" in parsed && typeof (parsed as { message?: unknown }).message === "string") {
      return (parsed as { message: string }).message;
    }

    return raw;
  } catch {
    return fallback;
  }
};

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

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loadingCurrentUser, setLoadingCurrentUser] = useState(true);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null);

  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [query, setQuery] = useState("");

  const [categoriesState, setCategoriesState] = useState<CategoriesState>({});
  const [pdfExportState, setPdfExportState] = useState<Record<number, ExportState>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [noteSaveState, setNoteSaveState] = useState<Record<number, SaveState>>({});
  const inFlightCategories = useRef<Set<number>>(new Set());

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        setLoadingCurrentUser(true);
        const res = await axiosInstance.get<MeResponse>("/me");
        setCurrentUserId(res.data.id);
      } catch {
        setCurrentUserId(null);
      } finally {
        setLoadingCurrentUser(false);
      }
    };

    void fetchCurrentUser();
  }, []);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoadingSessions(true);
        setSessionsError(null);

        const res = await axiosInstance.get<Session[]>("/sessions");
        setSessions(res.data);
        setNoteDrafts(Object.fromEntries(res.data.map((session) => [session.id, session.note ?? ""])));
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

  const handleNoteDraftChange = (sessionId: number, value: string) => {
    setNoteDrafts((prev) => ({
      ...prev,
      [sessionId]: value,
    }));
  };

  const handleSaveNote = async (sessionId: number) => {
    const note = (noteDrafts[sessionId] ?? "").trim();

    setNoteSaveState((prev) => ({
      ...prev,
      [sessionId]: {
        loading: true,
        error: null,
      },
    }));

    try {
      const response = await axiosInstance.patch<{ note: string | null }>(`/sessions/${sessionId}`, { note });
      const savedNote = response.data.note ?? null;

      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                note: savedNote,
              }
            : session,
        ),
      );

      setNoteDrafts((prev) => ({
        ...prev,
        [sessionId]: savedNote ?? "",
      }));

      setNoteSaveState((prev) => ({
        ...prev,
        [sessionId]: {
          loading: false,
          error: null,
        },
      }));
    } catch (err: unknown) {
      setNoteSaveState((prev) => ({
        ...prev,
        [sessionId]: {
          loading: false,
          error: getErrorMessage(err, "Nepodarilo sa uložiť poznámku."),
        },
      }));
    }
  };

  const handleDownloadPdf = async (sessionId: number) => {
    if (currentUserId === null) {
      setPdfExportState((prev) => ({
        ...prev,
        [sessionId]: {
          loading: false,
          error: "Nepodarilo sa získať používateľa pre export PDF.",
        },
      }));
      return;
    }

    setPdfExportState((prev) => ({
      ...prev,
      [sessionId]: {
        loading: true,
        error: null,
      },
    }));

    try {
      const response = await axiosInstance.post<Blob>(
        "/sessions/export-pdf",
        {
          user_id: currentUserId,
          session_id: sessionId,
          form_data: {},
        },
        {
          responseType: "blob",
        },
      );

      const contentType = String(response.headers["content-type"] ?? "");
      const contentDisposition = response.headers["content-disposition"];
      const fallbackFilename = `testovanie_${sessionId}.pdf`;

      if (contentType.includes("application/json") && response.data instanceof Blob) {
        throw new Error(await getBlobErrorMessage(response.data, "Nepodarilo sa vygenerovať PDF."));
      }

      const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = getDownloadFilename(contentDisposition, fallbackFilename);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);

      setPdfExportState((prev) => ({
        ...prev,
        [sessionId]: {
          loading: false,
          error: null,
        },
      }));
    } catch (err: unknown) {
      let message = getErrorMessage(err, "Nepodarilo sa stiahnuť PDF.");

      if (typeof err === "object" && err !== null && "response" in err && typeof (err as { response?: { data?: unknown } }).response === "object") {
        const responseData = (err as { response?: { data?: unknown } }).response?.data;
        if (responseData instanceof Blob) {
          message = await getBlobErrorMessage(responseData, message);
        }
      }

      setPdfExportState((prev) => ({
        ...prev,
        [sessionId]: {
          loading: false,
          error: message,
        },
      }));
    }
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
                <div className={styles.filterBarTop}>
                  <div className={styles.filterTabs} role="tablist" aria-label="Filter sedení">
                    <button
                      type="button"
                      className={`${styles.filterTab} ${sessionFilter === "all" ? styles.filterTabActive : ""}`}
                      onClick={() => setSessionFilter("all")}
                      aria-pressed={sessionFilter === "all"}
                    >
                      <span>Všetky</span>
                      <span className={styles.filterTabCount}>{headerStats.total}</span>
                    </button>

                    <button
                      type="button"
                      className={`${styles.filterTab} ${styles.filterTabActiveState} ${sessionFilter === "active" ? styles.filterTabActive : ""}`}
                      onClick={() => setSessionFilter("active")}
                      aria-pressed={sessionFilter === "active"}
                    >
                      <span>Prebieha</span>
                      <span className={styles.filterTabCount}>{headerStats.active}</span>
                    </button>

                    <button
                      type="button"
                      className={`${styles.filterTab} ${styles.filterTabDoneState} ${sessionFilter === "completed" ? styles.filterTabActive : ""}`}
                      onClick={() => setSessionFilter("completed")}
                      aria-pressed={sessionFilter === "completed"}
                    >
                      <span>Ukončené</span>
                      <span className={styles.filterTabCount}>{headerStats.done}</span>
                    </button>
                  </div>
                </div>

                <div className={styles.filterBarBottom}>
                  <div className={styles.filterSearchWrap}>
                    <input
                      className={`form-control glass-input ${styles.searchInput}`}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Hľadať podľa ID alebo dátumu"
                      aria-label="Hľadať sedenia"
                    />
                  </div>

                  <div className={styles.filterSelectWrap}>
                    <select
                      className={`form-select glass-input ${styles.sortSelect}`}
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
            </div>

            <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-2">
              <p className="mb-0">Tu nájdete všetky vaše testovacie sedenia a stav jednotlivých kategórií.</p>
              <div className="small text-muted">
                <span className="fw-semibold">Poradie:</span> {getOrderDisplay()}
              </div>
            </div>

            <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-2">
              <div className="anon-warning-card anon-grid__wide">
                <p className="mb-0">
                  <strong>Upozornenie: </strong> Niektoré položky je potrebné v súbore vyplniť rodičom. Po stiahnutí odporúčame výsledný súbor
                  skontrolovať.
                </p>
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
              const allCategoriesCompleted = hasCategories && completedCount === categories.length;
              const exportState = pdfExportState[session.id] ?? { loading: false, error: null };
              const noteSave = noteSaveState[session.id] ?? { loading: false, error: null };
              const noteValue = noteDrafts[session.id] ?? session.note ?? "";
              const noteDisplay = (session.note ?? "").trim();

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
                                {noteDisplay && (
                                  <span className="badge rounded-pill text-bg-light border" title={noteDisplay}>
                                    Poznámka: {noteDisplay}
                                  </span>
                                )}
                              </div>

                              {catsLoading ? (
                                <span className="small text-muted">Načítavam kategórie...</span>
                              ) : hasCategories ? (
                                <span className="small text-muted me-3">
                                  Dokončené: <span className="fw-semibold">{completedCount}</span>/{categories.length} • Skontrolované:
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
                              </div>
                            )}

                            {!catsLoading && catsError && <div className="small text-danger">Chyba: {catsError}</div>}
                          </div>
                        </button>
                      </h2>

                      <div className={`accordion-collapse collapse ${isOpen ? "show" : ""}`}>
                        <div className="accordion-body">
                          <div className="mb-3">
                            <label htmlFor={`session-note-${session.id}`} className="form-label fw-semibold mb-1">
                              Poznámka
                            </label>
                            <div className="d-flex flex-column flex-md-row gap-2 align-items-md-start">
                              <input
                                id={`session-note-${session.id}`}
                                type="text"
                                className="form-control glass-input"
                                value={noteValue}
                                onChange={(e) => handleNoteDraftChange(session.id, e.target.value)}
                                placeholder="Napr. meno dieťaťa alebo interná poznámka"
                                maxLength={200}
                              />
                              <button
                                type="button"
                                className="btn btn-outline-primary"
                                disabled={noteSave.loading}
                                onClick={() => void handleSaveNote(session.id)}
                              >
                                {noteSave.loading ? "Ukladám..." : "Uložiť"}
                              </button>
                            </div>
                            {noteSave.error && <div className="small text-danger mt-2">{noteSave.error}</div>}
                          </div>

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
                          <div className="mt-3 d-flex flex-column gap-2">
                            <div className="d-flex flex-wrap align-items-center gap-2">
                              <div className="small text-muted ms-2"> Stiahnuť vyplnený súbor PDF: </div>
                              <button
                                type="button"
                                className="btn btn-success btn-sm"
                                disabled={exportState.loading || loadingCurrentUser || currentUserId === null}
                                onClick={() => void handleDownloadPdf(session.id)}
                              >
                                {exportState.loading ? "Pripravujem PDF..." : "Stiahnuť PDF"}
                              </button>
                            </div>

                            {exportState.error && (
                              <div className="alert alert-danger py-2 px-3 mb-0" role="alert">
                                {exportState.error}
                              </div>
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
