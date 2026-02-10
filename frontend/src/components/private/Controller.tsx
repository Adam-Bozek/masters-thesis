// CategoryTestingController.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import axiosInstance from "@/utilities/AxiosInstance";
import SceneBuilder, { SceneConfig } from "@/components/private/SceneBuilder";
import Phase3Testing from "@/components/private/Phase3Testing";
import Phase5Testing from "@/components/private/Phase5Testing";

// Accept BOTH spellings you used across the project:
// - original spec: "session_storage" | "database"
// - some files:    "local_storage"  | "database"
type StorageType = "session_storage" | "local_storage" | "database";
type TestedCategory = "marketplace" | "mountains" | "zoo" | "street" | "home";

type Question = any;

type Props = {
  testedCategory: TestedCategory;

  // scenes config supports BOTH schemas:
  // A) { marketplace: [scene1, scene2, scene4, scene6] }
  // B) { marketplace: { phase1:[scene], phase2:[scene], phase4:[scene], phase6:[scene] } }
  scenesConfigPath: string;

  // questions JSON for Phase3
  questionnaireConfigPath: string;

  storageType: StorageType;

  // optional overrides
  categoryId?: number;
  sessionId?: number;

  redirectTo?: string | ((categoryId: number) => string);
  debug?: boolean;
};

type Step = "boot" | "phase1" | "phase2" | "phase3" | "phase4" | "phase5" | "phase6" | "done" | "error";

const CATEGORY_ID_BY_KEY: Record<TestedCategory, number> = {
  marketplace: 1,
  mountains: 2,
  zoo: 3,
  street: 4,
  home: 5,
};

const PHASE_TO_SCENE_INDEX: Record<1 | 2 | 4 | 6, number> = {
  1: 0,
  2: 1,
  4: 2,
  6: 3,
};

function normalizeSceneKey(k: string): string {
  const s = (k ?? "").trim().toLowerCase();
  if (s === "marketplace") return "marketplace";
  if (s === "marketpace") return "marketplace"; // tolerate typo
  return s;
}

function hoursDiff(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60);
}

function toSceneConfig(x: any): SceneConfig | undefined {
  if (!x) return undefined;
  if (Array.isArray(x)) return x[0] as SceneConfig | undefined; // some configs use arrays with 1 item
  if (typeof x === "object") return x as SceneConfig;
  return undefined;
}

function normalizePhased(obj: any): Array<SceneConfig | undefined> {
  const p1 = toSceneConfig(obj.phase1 ?? obj.PHASE_1 ?? obj.phase_1);
  const p2 = toSceneConfig(obj.phase2 ?? obj.PHASE_2 ?? obj.phase_2);
  const p4 = toSceneConfig(obj.phase4 ?? obj.PHASE_4 ?? obj.phase_4);
  const p6 = toSceneConfig(obj.phase6 ?? obj.PHASE_6 ?? obj.phase_6);
  return [p1, p2, p4, p6];
}

export default function CategoryTestingController({
  testedCategory,
  scenesConfigPath,
  questionnaireConfigPath,
  storageType,
  categoryId: categoryIdProp,
  sessionId: sessionIdProp,
  redirectTo,
  debug = false,
}: Props) {
  const router = useRouter();

  const log = useCallback(
    (...args: any[]) => {
      if (debug) console.log("[CategoryTestingController]", ...args);
    },
    [debug],
  );

  const categoryId = useMemo(() => categoryIdProp ?? CATEGORY_ID_BY_KEY[testedCategory], [categoryIdProp, testedCategory]);

  const [step, setStep] = useState<Step>("boot");
  const [bootError, setBootError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<number | null>(sessionIdProp ?? null);

  // value = [phase1, phase2, phase4, phase6] (some may be undefined if config missing)
  const [scenesByCategory, setScenesByCategory] = useState<Record<string, Array<SceneConfig | undefined>>>({});
  const [scenesLoaded, setScenesLoaded] = useState(false);

  const [wrongQuestions, setWrongQuestions] = useState<Question[]>([]);

  const localLastCompletedKey = useMemo(() => `category:lastCompletedAt:${categoryId}`, [categoryId]);

  const scenesForThisCategory = useMemo(() => {
    const key = normalizeSceneKey(testedCategory);
    const byKey = scenesByCategory[key];
    if (byKey?.length) return byKey;

    // legacy tolerance
    if (key === "marketplace") {
      const legacy = scenesByCategory["marketpace"];
      if (legacy?.length) return legacy;
    }
    return null;
  }, [scenesByCategory, testedCategory]);

  const getScene = (phase: 1 | 2 | 4 | 6): SceneConfig | null => {
    const arr = scenesForThisCategory;
    if (!arr) return null;
    const idx = PHASE_TO_SCENE_INDEX[phase];
    return arr[idx] ?? null;
  };

  const resolveRedirect = (cid: number) => {
    if (typeof redirectTo === "function") return redirectTo(cid);
    if (typeof redirectTo === "string" && redirectTo.trim()) return redirectTo.trim();
    return "/dashboard";
  };

  const getWebStorage = () => {
    // Only call in browser contexts (we do), still keep it defensive.
    if (typeof window === "undefined") return null;
    return storageType === "session_storage" ? window.sessionStorage : window.localStorage;
  };

  const loadScenesConfig = useCallback(async () => {
    setScenesLoaded(false);

    const r = await fetch(scenesConfigPath, { cache: "no-store" });
    if (!r.ok) {
      throw new Error(`Failed to load scenesConfig (${r.status}) from ${scenesConfigPath}`);
    }

    let json: any;
    try {
      json = await r.json();
    } catch {
      throw new Error(`Scenes config is not valid JSON: ${scenesConfigPath}`);
    }

    const out: Record<string, Array<SceneConfig | undefined>> = {};

    // If file is directly phased object (no category wrapper), bind it to current category.
    const looksPhased =
      json &&
      typeof json === "object" &&
      (json.phase1 || json.phase2 || json.phase4 || json.phase6 || json.PHASE_1 || json.PHASE_2 || json.PHASE_4 || json.PHASE_6);

    if (looksPhased) {
      const k = normalizeSceneKey(testedCategory);
      out[k] = normalizePhased(json);
      setScenesByCategory(out);
      setScenesLoaded(true);
      return;
    }

    // Normal case: { [categoryKey]: ... }
    if (json && typeof json === "object") {
      for (const [kRaw, v] of Object.entries(json as any)) {
        const k = normalizeSceneKey(kRaw);

        // Schema A: category: [scene1, scene2, scene4, scene6]
        if (Array.isArray(v)) {
          out[k] = v as SceneConfig[];
          out[kRaw] = v as SceneConfig[];
          continue;
        }

        // Schema B: category: { phase1:[scene], phase2:[scene], ... }
        if (v && typeof v === "object") {
          const arr = normalizePhased(v);
          out[k] = arr;
          out[kRaw] = arr;
        }
      }
    }

    setScenesByCategory(out);
    setScenesLoaded(true);
  }, [scenesConfigPath, testedCategory]);

  const ensureDbSessionId = useCallback(async (): Promise<number> => {
    if (storageType !== "database") throw new Error("ensureDbSessionId called in non-db mode");
    if (sessionIdProp) return sessionIdProp;
    if (sessionId != null) return sessionId;

    // marketplace => always new session
    if (testedCategory === "marketplace") {
      const res = await axiosInstance.post("/sessions");
      const sid = Number(res?.data?.session_id);
      if (!Number.isFinite(sid)) throw new Error("create_session: missing session_id");
      setSessionId(sid);
      log("created session for marketplace:", sid);
      return sid;
    }

    // others => reuse newest open session if exists, else create
    const list = await axiosInstance.get("/sessions");
    const sessions = Array.isArray(list?.data) ? list.data : [];

    // Prefer "newest open" if backend returns created_at/started_at, otherwise first open.
    const open = sessions
      .filter((s: any) => s && s.completed_at == null && Number.isFinite(Number(s.id)))
      .sort((a: any, b: any) => {
        const ta = new Date(a?.created_at ?? a?.started_at ?? 0).getTime();
        const tb = new Date(b?.created_at ?? b?.started_at ?? 0).getTime();
        return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
      })[0];

    if (open) {
      const sid = Number(open.id);
      setSessionId(sid);
      log("reusing open session:", sid);
      return sid;
    }

    const created = await axiosInstance.post("/sessions");
    const sid = Number(created?.data?.session_id);
    if (!Number.isFinite(sid)) throw new Error("create_session fallback: missing session_id");
    setSessionId(sid);
    log("created fallback session:", sid);
    return sid;
  }, [storageType, sessionIdProp, sessionId, testedCategory, log]);

  const findLatestCategoryCompletionDb = useCallback(async (): Promise<Date | null> => {
    const list = await axiosInstance.get("/sessions");
    const sessions = Array.isArray(list?.data) ? list.data : [];

    let latest: Date | null = null;

    for (const s of sessions) {
      const sid = Number(s?.id);
      if (!Number.isFinite(sid)) continue;

      try {
        const catsRes = await axiosInstance.get(`/sessions/${sid}/categories`);
        const cats = Array.isArray(catsRes?.data) ? catsRes.data : [];
        const row = cats.find((c: any) => Number(c?.id) === Number(categoryId));
        const completedAt = row?.completed_at;
        if (!completedAt) continue;

        const d = new Date(completedAt);
        if (!Number.isFinite(d.getTime())) continue;

        if (!latest || d.getTime() > latest.getTime()) latest = d;
      } catch {
        // ignore
      }
    }

    return latest;
  }, [categoryId]);

  const shouldShowPhase1 = useCallback(async (): Promise<boolean> => {
    if (testedCategory === "marketplace") return true;

    if (storageType !== "database") {
      try {
        const store = getWebStorage();
        if (!store) return true;

        const raw = store.getItem(localLastCompletedKey);
        if (!raw) return true;

        const d = new Date(raw);
        if (!Number.isFinite(d.getTime())) return true;

        return hoursDiff(new Date(), d) > 4;
      } catch {
        return true;
      }
    }

    try {
      const last = await findLatestCategoryCompletionDb();
      if (!last) return true;
      return hoursDiff(new Date(), last) > 4;
    } catch {
      return true;
    }
  }, [testedCategory, storageType, localLastCompletedKey, findLatestCategoryCompletionDb]);

  const ensureCategoryCompletedDb = useCallback(
    async (sid: number) => {
      try {
        await axiosInstance.patch(`/sessions/${sid}/categories/${categoryId}/complete`);
        log("category completed:", { sid, categoryId });
        return;
      } catch (e: any) {
        const msg = e?.response?.data?.message ?? "";
        const status = e?.response?.status;

        // backend requires at least one answer; seed dummy then retry
        if (status === 400 && typeof msg === "string" && msg.toLowerCase().includes("no answers")) {
          log("no answers; seeding then completing");
          await axiosInstance.post(`/sessions/${sid}/answers`, {
            category_id: categoryId,
            question_number: 1,
            answer_state: "0",
            user_answer: null,
          });
          await axiosInstance.patch(`/sessions/${sid}/categories/${categoryId}/complete`);
          log("category completed after seeding:", { sid, categoryId });
          return;
        }

        if (status === 400 && typeof msg === "string" && msg.toLowerCase().includes("already completed")) return;

        throw e;
      }
    },
    [categoryId, log],
  );

  const markCorrectedDb = useCallback(
    async (sid: number) => {
      try {
        await axiosInstance.patch(`/sessions/${sid}/categories/${categoryId}/correct`);
        log("category corrected:", { sid, categoryId });
      } catch (e: any) {
        const msg = e?.response?.data?.message ?? "";
        const status = e?.response?.status;
        if (status === 400 && typeof msg === "string" && msg.toLowerCase().includes("already corrected")) return;
        log("correct_category failed (non-fatal):", e?.response?.status, e?.response?.data);
      }
    },
    [categoryId, log],
  );

  // Helpful debug: show step changes (stable, won't cause loops)
  useEffect(() => {
    log("step =", step, { testedCategory, storageType, categoryId, sessionId });
  }, [step, testedCategory, storageType, categoryId, sessionId, log]);

  // boot
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setStep("boot");
      setBootError(null);
      setWrongQuestions([]);

      try {
        await loadScenesConfig();
        log("scenes loaded from", scenesConfigPath);

        if (storageType === "database") {
          const sid = await ensureDbSessionId();
          if (cancelled) return;
          setSessionId(sid);
        }

        const show1 = await shouldShowPhase1();
        if (cancelled) return;

        setStep(show1 ? "phase1" : "phase2");
      } catch (e: any) {
        if (cancelled) return;
        setBootError(e?.message ?? "Boot failed");
        setStep("error");
        log("boot error:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    testedCategory,
    scenesConfigPath,
    questionnaireConfigPath,
    storageType,
    categoryIdProp,
    sessionIdProp,
    loadScenesConfig,
    ensureDbSessionId,
    shouldShowPhase1,
    log,
  ]);

  // If something ever routes into phase5 with no wrong questions, move on SAFELY (no setState during render).
  useEffect(() => {
    if (step === "phase5" && (!wrongQuestions || wrongQuestions.length === 0)) {
      log("phase5 entered with empty wrongQuestions -> skipping to phase6");
      setStep("phase6");
    }
  }, [step, wrongQuestions, log]);

  const renderScenePhase = (phase: 1 | 2 | 4 | 6, next: Step) => {
    if (!scenesLoaded) {
      return (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-white">
          <div className="spinner-border" role="status" aria-label="Načítavam konfiguráciu" />
        </div>
      );
    }

    const cfg = getScene(phase);
    if (!cfg) {
      return (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-white p-3 text-center">
          <div>
            <div className="fw-semibold" style={{ fontSize: "1.25rem" }}>
              Chýba konfigurácia scény
            </div>
            <div className="text-muted small">
              category={testedCategory}, phase={phase}, path={scenesConfigPath}
            </div>
            {debug && (
              <pre className="text-start small mt-3 bg-light p-2 rounded" style={{ maxWidth: 720, overflow: "auto" }}>
                {JSON.stringify({ scenesForThisCategory }, null, 2)}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return <SceneBuilder config={cfg} debug={debug} onComplete={() => setStep(next)} onSkip={() => setStep(next)} />;
  };

  if (step === "boot") {
    return (
      <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-white">
        <div className="spinner-border" role="status" aria-label="Načítavam" />
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-white p-3 text-center">
        <div>
          <div className="fw-semibold" style={{ fontSize: "1.25rem" }}>
            Chyba
          </div>
          <div className="text-muted small">{bootError ?? "Neznáma chyba"}</div>
        </div>
      </div>
    );
  }

  if (step === "phase1") return renderScenePhase(1, "phase2");
  if (step === "phase2") return renderScenePhase(2, "phase3");

  if (step === "phase3") {
    const sid = storageType === "database" ? sessionId : undefined;

    if (storageType === "database" && !sid) {
      return (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-white p-3 text-center">
          <div>
            <div className="fw-semibold" style={{ fontSize: "1.25rem" }}>
              Chýba sessionId
            </div>
            <div className="text-muted small">Controller nedokázal vytvoriť / nájsť session.</div>
          </div>
        </div>
      );
    }

    return (
      <Phase3Testing
        questionnaireConfigPath={questionnaireConfigPath}
        categoryId={categoryId}
        storageType={storageType as any} // keep compatible if Phase3Testing still expects old union
        sessionId={sid ?? undefined}
        debug={debug}
        onComplete={(incorrect: Question[]) => {
          const inc = Array.isArray(incorrect) ? incorrect : [];
          setWrongQuestions(inc);
          setStep(inc.length > 0 ? "phase4" : "phase6");
        }}
      />
    );
  }

  if (step === "phase4") return renderScenePhase(4, "phase5");

  if (step === "phase5") {
    const sid = storageType === "database" ? sessionId : undefined;

    // NOTE: skipping-to-phase6 is handled in a useEffect to avoid setState during render.
    if (!wrongQuestions.length) return null;

    return (
      <Phase5Testing
        wrongQuestions={wrongQuestions}
        categoryId={categoryId}
        storageType={storageType as any}
        sessionId={sid ?? undefined}
        debug={debug}
        onComplete={async () => {
          if (storageType === "database" && sid) await markCorrectedDb(sid);
          setStep("phase6");
        }}
      />
    );
  }

  if (step === "phase6") return renderScenePhase(6, "done");

  if (step === "done") {
    return (
      <FinalizeAndRedirect
        storageType={storageType}
        sessionId={sessionId}
        categoryId={categoryId}
        localLastCompletedKey={localLastCompletedKey}
        ensureCategoryCompletedDb={ensureCategoryCompletedDb}
        redirectHref={resolveRedirect(categoryId)}
        debug={debug}
      />
    );
  }

  return null;
}

function FinalizeAndRedirect({
  storageType,
  sessionId,
  categoryId,
  localLastCompletedKey,
  ensureCategoryCompletedDb,
  redirectHref,
  debug,
}: {
  storageType: StorageType;
  sessionId: number | null;
  categoryId: number;
  localLastCompletedKey: string;
  ensureCategoryCompletedDb: (sid: number) => Promise<void>;
  redirectHref: string;
  debug: boolean;
}) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);

  const log = useCallback(
    (...args: any[]) => {
      if (debug) console.log("[FinalizeAndRedirect]", ...args);
    },
    [debug],
  );

  const getWebStorage = () => {
    if (typeof window === "undefined") return null;
    return storageType === "session_storage" ? window.sessionStorage : window.localStorage;
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (storageType === "database") {
          if (!sessionId) throw new Error("Missing sessionId at finalize");
          await ensureCategoryCompletedDb(sessionId);
        } else {
          const store = getWebStorage();
          if (!store) throw new Error("Web storage not available");
          store.setItem(localLastCompletedKey, new Date().toISOString());
        }

        if (cancelled) return;

        log("redirect", { storageType, sessionId, categoryId, to: redirectHref });
        router.push(redirectHref);
        router.refresh();
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "Finalize failed");
        log("finalize error:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [storageType, sessionId, categoryId, localLastCompletedKey, ensureCategoryCompletedDb, redirectHref, router, log]);

  if (!err) {
    return (
      <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-white">
        <div className="spinner-border" role="status" aria-label="Dokončujem" />
      </div>
    );
  }

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-white p-3 text-center">
      <div>
        <div className="fw-semibold" style={{ fontSize: "1.25rem" }}>
          Nepodarilo sa dokončiť kategóriu
        </div>
        <div className="text-muted small">{err}</div>
      </div>
    </div>
  );
}
