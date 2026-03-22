"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axiosInstance from "@/utilities/AxiosInstance";
import { CategoryTestingController } from "@/components/private/Controller";

type CategoryKey = "marketplace" | "mountains" | "zoo" | "street" | "home";

type GuestCreateResponse = {
  session_id?: number;
  id?: number;
  guest_token?: string;
};

const CATEGORIES: Array<{ id: number; slug: CategoryKey; label: string }> = [
  { id: 1, slug: "marketplace", label: "Obchod" },
  { id: 2, slug: "mountains", label: "Hory" },
  { id: 3, slug: "zoo", label: "ZOO" },
  { id: 4, slug: "street", label: "Ulica" },
  { id: 5, slug: "home", label: "Domov" },
];

const STORAGE_KEYS = {
  sessionId: "guestSessionId",
  token: "guestSessionToken",
  categoryIndex: "guestCategoryIndex",
};

function clearGuestStorage() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEYS.sessionId);
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.categoryIndex);
}

function saveGuestState(sessionId: number, token: string, categoryIndex: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.sessionId, String(sessionId));
  localStorage.setItem(STORAGE_KEYS.token, token);
  localStorage.setItem(STORAGE_KEYS.categoryIndex, String(categoryIndex));
}

export default function RunWithoutRegister() {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [guestToken, setGuestToken] = useState("");
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [starting, setStarting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [ready, setReady] = useState(false);

  const currentCategory = useMemo(() => CATEGORIES[categoryIndex] ?? null, [categoryIndex]);

  const validateSession = useCallback(async (candidateSessionId: number, candidateToken: string): Promise<boolean> => {
    try {
      await axiosInstance.get(`/sessions/${candidateSessionId}`, {
        headers: {
          "X-Guest-Token": candidateToken,
          Authorization: " ",
        },
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const resume = async () => {
      if (typeof window === "undefined") {
        setReady(true);
        return;
      }

      const rawSessionId = localStorage.getItem(STORAGE_KEYS.sessionId);
      const rawToken = localStorage.getItem(STORAGE_KEYS.token);
      const rawIndex = localStorage.getItem(STORAGE_KEYS.categoryIndex);

      if (!rawSessionId || !rawToken) {
        if (!cancelled) setReady(true);
        return;
      }

      const parsedSessionId = Number(rawSessionId);
      const parsedIndex = Number(rawIndex ?? "0");

      if (!Number.isFinite(parsedSessionId) || !rawToken.trim()) {
        clearGuestStorage();
        if (!cancelled) setReady(true);
        return;
      }

      const isValid = await validateSession(parsedSessionId, rawToken);
      if (!isValid) {
        clearGuestStorage();
        if (!cancelled) setReady(true);
        return;
      }

      if (!cancelled) {
        setSessionId(parsedSessionId);
        setGuestToken(rawToken);
        setCategoryIndex(Number.isFinite(parsedIndex) ? Math.max(0, Math.min(parsedIndex, CATEGORIES.length - 1)) : 0);
        setCompleted(parsedIndex >= CATEGORIES.length);
        setReady(true);
      }
    };

    void resume();

    return () => {
      cancelled = true;
    };
  }, [validateSession]);

  const startRun = useCallback(async () => {
    try {
      setStarting(true);
      setErrorMessage(null);
      clearGuestStorage();

      const response = await axiosInstance.post<GuestCreateResponse>("/sessions/guest", {});
      const nextSessionId = Number(response.data?.session_id ?? response.data?.id);
      const nextGuestToken = String(response.data?.guest_token ?? "");

      if (!Number.isFinite(nextSessionId) || !nextGuestToken) {
        throw new Error("Nepodarilo sa spustiť anonymné testovanie.");
      }

      const isValid = await validateSession(nextSessionId, nextGuestToken);
      if (!isValid) {
        throw new Error("Nepodarilo sa overiť anonymnú reláciu.");
      }

      saveGuestState(nextSessionId, nextGuestToken, 0);
      setSessionId(nextSessionId);
      setGuestToken(nextGuestToken);
      setCategoryIndex(0);
      setCompleted(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nepodarilo sa spustiť anonymné testovanie.");
    } finally {
      setStarting(false);
    }
  }, [validateSession]);

  const completeGuestSession = useCallback(async (candidateSessionId: number, candidateToken: string) => {
    try {
      await axiosInstance.patch(`/sessions/${candidateSessionId}/complete`, undefined, {
        headers: {
          "X-Guest-Token": candidateToken,
          Authorization: " ",
        },
      });
    } catch {
      // Best-effort finalization. Category data is already stored even if this request fails.
    }
  }, []);

  const resetRun = useCallback(() => {
    clearGuestStorage();
    setSessionId(null);
    setGuestToken("");
    setCategoryIndex(0);
    setCompleted(false);
    setErrorMessage(null);
  }, []);

  const exportPdf = useCallback(async () => {
    if (!sessionId || !guestToken) return;

    try {
      setExporting(true);
      setErrorMessage(null);

      const response = await axiosInstance.post(
        "/sessions/export-pdf",
        { session_id: sessionId, form_data: {} },
        {
          responseType: "blob",
          headers: {
            "X-Guest-Token": guestToken,
            Authorization: " ",
          },
        },
      );

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tekos_session_${sessionId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nepodarilo sa exportovať PDF.");
    } finally {
      setExporting(false);
    }
  }, [guestToken, sessionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleComplete = () => {
      setCategoryIndex((previousIndex) => {
        const nextIndex = previousIndex + 1;

        if (sessionId && guestToken) {
          saveGuestState(sessionId, guestToken, nextIndex);
        }

        if (nextIndex >= CATEGORIES.length) {
          if (sessionId && guestToken) {
            void completeGuestSession(sessionId, guestToken);
          }

          setCompleted(true);
          return previousIndex;
        }

        return nextIndex;
      });
    };

    window.addEventListener("guest-category-complete", handleComplete);
    return () => window.removeEventListener("guest-category-complete", handleComplete);
  }, [completeGuestSession, guestToken, sessionId]);

  if (!ready) {
    return (
      <div className="w-100 p-4 rounded-4 border bg-white shadow-sm">
        <div className="spinner-border" role="status" aria-label="Načítava sa" />
      </div>
    );
  }

  if (sessionId && guestToken && currentCategory && !completed) {
    return (
      <CategoryTestingController
        key={`${sessionId}-${currentCategory.slug}`}
        testedCategory={currentCategory.slug}
        scenesConfigPath="/data/scene_config.json"
        questionnaireConfigPath={`/data/${currentCategory.slug}.json`}
        storageType="database"
        sessionId={sessionId}
        guestToken={guestToken}
        categoryId={currentCategory.id}
        redirectTo="__guest_internal__"
      />
    );
  }

  return (
    <div className="content-stack compact-stack w-100 align-items-center">
      <div>
        <h3 className="mb-1">Test bez registrácie</h3>
        <div className="d-flex flex-wrap justify-content-center align-items-center gap-2">
          <p className="lead-muted compact-lead mb-0">Anonymné spustenie bez účtu a bez dlhodobého uloženia údajov.</p>
          <span className="status-pill status-pill--active warning-pill">Neodporúčame</span>
        </div>
      </div>

      <div className="anon-grid">
        <section className="info-card compact-card text-start">
          <h4>Anonymne</h4>
          <p>Vytvorí sa dočasná relácia len pre tento priebeh.</p>
        </section>

        <section className="info-card compact-card text-start">
          <h4>Limit</h4>
          <p>Dáta sa po 1 hodine neaktivity odstránia.</p>
        </section>

        <section className="info-card compact-card text-start anon-grid__wide">
          <h4>Výstup</h4>
          <p className="mb-1">Po dokončení je možné exportovať výsledok do PDF.</p>
          <p>
            <strong>Upozornenie: </strong> Niektoré položky je potrebné vyplniť rodičom. Po stiahnutí odporúčame výsledný súbor skontrolovať.
          </p>
        </section>

        <div className="anon-warning-card anon-grid__wide">
          <p className="mb-0">
            <strong>Upozornenie: </strong> Testovanie bez registrácie neodporúčame. Priebežné výsledky sa neukladajú, preto je potrebné test dokončiť
            v jednej relácii - vyplnenie testu trvá dlhý čas. Ak chcete test vyplniť po častiach,, vytvorte si účet.
          </p>
        </div>

        {completed && sessionId ? (
          <div className="d-flex flex-column gap-3 align-items-center w-100 anon-grid__wide">
            <div className="alert alert-success mb-0 p-1" style={{ maxWidth: 620 }}>
              Testovanie bolo dokončené.
            </div>

            <div className="d-flex flex-wrap gap-2 justify-content-center">
              <button className="btn btn-primary rounded-pill px-4" onClick={() => void exportPdf()} disabled={exporting}>
                {exporting ? "Generujem PDF..." : "Stiahnuť PDF"}
              </button>

              <button className="btn btn-outline-secondary rounded-pill px-4" onClick={resetRun}>
                Zavrieť
              </button>
            </div>
          </div>
        ) : (
          <div className="d-flex flex-column gap-3 align-items-center w-100 anon-grid__wide">
            {errorMessage ? (
              <div className="alert alert-danger mb-0 w-100" style={{ maxWidth: 620 }}>
                {errorMessage}
              </div>
            ) : null}

            <div className="d-flex flex-wrap gap-2 justify-content-center">
              <button className="btn btn-primary rounded-pill px-4" onClick={() => void startRun()} disabled={starting}>
                {starting ? "Spúšťam..." : sessionId ? "Pokračovať v testovaní" : "Spustiť testovanie"}
              </button>

              {sessionId ? (
                <button className="btn btn-outline-secondary rounded-pill px-4" onClick={resetRun}>
                  Zrušiť rozpracované testovanie
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
