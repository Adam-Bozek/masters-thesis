"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import SceneBuilder, { SceneConfig } from "@/components/private/SceneBuilder";
import Phase3Testing from "@/components/private/Phase3Testing";
import Phase5Testing from "@/components/private/Phase5Testing";
import axiosInstance from "@/utilities/AxiosInstance";
import withAuth from "@/utilities/WithAuth";
import {
  controllerRuntimeConfig as sharedControllerRuntimeConfig,
  phase3RuntimeConfig as sharedPhase3RuntimeConfig,
  phase5RuntimeConfig as sharedPhase5RuntimeConfig,
  sceneBuilderRuntimeConfig as sharedSceneBuilderRuntimeConfig,
} from "./componentRuntimeConfigs";

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

type StorageType = "session_storage" | "local_storage" | "database";
type TestedCategory = "marketplace" | "mountains" | "zoo" | "street" | "home";
type ScenePhase = 1 | 2 | 4 | 6;
type ControllerStep = "boot" | "phase1" | "phase2" | "phase3" | "phase4" | "phase5" | "phase6" | "done" | "error";
type RedirectResolver = string | ((categoryId: number) => string);
type IncorrectQuestion = unknown;
type CategorySceneList = Array<SceneConfig | undefined>;
type ScenesByCategoryMap = Record<string, CategorySceneList>;
type BrowserStorage = Storage | null;

type SessionListItem = {
  id?: number | string;
  completed_at?: string | null;
  created_at?: string | null;
  started_at?: string | null;
};

type SessionCategoryStatus = {
  id?: number | string;
  completed_at?: string | null;
};

type ApiErrorShape = {
  message?: string;
};

type AxiosLikeError = {
  message?: string;
  response?: {
    status?: number;
    data?: ApiErrorShape;
  };
};

type ControllerRuntimeConfig = {
  categoryCooldownHours: number;
  defaultRedirectPath: string;
  tolerateMarketplaceTypo: boolean;
  noAnswersMessageFragment: string;
  alreadyCompletedMessageFragment: string;
  alreadyCorrectedMessageFragment: string;
  bootLoadingAriaLabel: string;
  sceneLoadingAriaLabel: string;
  finalizingLoadingAriaLabel: string;
  genericErrorTitle: string;
  sceneMissingTitle: string;
  missingSessionTitle: string;
  finalizeErrorTitle: string;
};

type CategoryTestingControllerProps = {
  testedCategory: TestedCategory;
  scenesConfigPath: string;
  questionnaireConfigPath: string;
  storageType: StorageType;
  categoryId?: number;
  sessionId?: number;
  redirectTo?: RedirectResolver;
  debug?: boolean;
  config?: Partial<ControllerRuntimeConfig>;
};

type FinalizeAndRedirectProps = {
  storageType: StorageType;
  sessionId: number | null;
  categoryId: number;
  localLastCompletedKey: string;
  ensureCategoryCompletedDb: (sessionId: number) => Promise<void>;
  redirectHref: string;
  debug: boolean;
  runtimeConfig: ControllerRuntimeConfig;
};

type FullscreenStatusProps = {
  ariaLabel?: string;
  title?: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  centered?: boolean;
};

/* -------------------------------------------------------------------------------------------------
 * Runtime config
 * -----------------------------------------------------------------------------------------------*/

const DEFAULT_RUNTIME_CONFIG: ControllerRuntimeConfig = sharedControllerRuntimeConfig;

const CATEGORY_ID_BY_KEY: Record<TestedCategory, number> = {
  marketplace: 1,
  mountains: 2,
  zoo: 3,
  street: 4,
  home: 5,
};

const PHASE_TO_SCENE_INDEX: Record<ScenePhase, number> = {
  1: 0,
  2: 1,
  4: 2,
  6: 3,
};

/* -------------------------------------------------------------------------------------------------
 * Utility helpers
 * -----------------------------------------------------------------------------------------------*/

function normalizeSceneKey(rawKey: string, runtimeConfig: ControllerRuntimeConfig): string {
  const normalizedKey = rawKey.trim().toLowerCase();

  if (normalizedKey === "marketplace") {
    return "marketplace";
  }

  if (runtimeConfig.tolerateMarketplaceTypo && normalizedKey === "marketpace") {
    return "marketplace";
  }

  return normalizedKey;
}

function getHoursDifference(firstDate: Date, secondDate: Date): number {
  return Math.abs(firstDate.getTime() - secondDate.getTime()) / (1000 * 60 * 60);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractApiError(error: unknown): { status?: number; message: string } {
  const typedError = error as AxiosLikeError;

  return {
    status: typedError?.response?.status,
    message: typedError?.response?.data?.message ?? typedError?.message ?? "Unknown error",
  };
}

function isValidDate(date: Date): boolean {
  return Number.isFinite(date.getTime());
}

function parseApiDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsedDate = new Date(value);
  return isValidDate(parsedDate) ? parsedDate : null;
}

function toSceneConfig(value: unknown): SceneConfig | undefined {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value[0] as SceneConfig | undefined;
  }

  if (isRecord(value)) {
    return value as SceneConfig;
  }

  return undefined;
}

function normalizePhasedScenes(phasedConfig: Record<string, unknown>): CategorySceneList {
  return [
    toSceneConfig(phasedConfig.phase1 ?? phasedConfig.PHASE_1 ?? phasedConfig.phase_1),
    toSceneConfig(phasedConfig.phase2 ?? phasedConfig.PHASE_2 ?? phasedConfig.phase_2),
    toSceneConfig(phasedConfig.phase4 ?? phasedConfig.PHASE_4 ?? phasedConfig.phase_4),
    toSceneConfig(phasedConfig.phase6 ?? phasedConfig.PHASE_6 ?? phasedConfig.phase_6),
  ];
}

function looksLikePhasedSceneConfig(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }

  return Boolean(value.phase1 || value.phase2 || value.phase4 || value.phase6 || value.PHASE_1 || value.PHASE_2 || value.PHASE_4 || value.PHASE_6);
}

function getBrowserStorage(storageType: StorageType): BrowserStorage {
  if (typeof window === "undefined") {
    return null;
  }

  return storageType === "session_storage" ? window.sessionStorage : window.localStorage;
}

function resolveRedirectPath(redirectTo: RedirectResolver | undefined, categoryId: number, runtimeConfig: ControllerRuntimeConfig): string {
  if (typeof redirectTo === "function") {
    return redirectTo(categoryId);
  }

  if (typeof redirectTo === "string" && redirectTo.trim()) {
    return redirectTo.trim();
  }

  return runtimeConfig.defaultRedirectPath;
}

function getSessionSortTimestamp(session: SessionListItem): number {
  const createdAt = parseApiDate(session.created_at);
  const startedAt = parseApiDate(session.started_at);

  return createdAt?.getTime() ?? startedAt?.getTime() ?? 0;
}

function isErrorMessageMatch(message: string, fragment: string): boolean {
  return message.toLowerCase().includes(fragment.toLowerCase());
}

/* -------------------------------------------------------------------------------------------------
 * Small UI building blocks
 * -----------------------------------------------------------------------------------------------*/

function FullscreenStatus({ ariaLabel, title, subtitle, children }: FullscreenStatusProps) {
  const hasText = Boolean(title || subtitle || children);

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-white p-3 text-center">
      {hasText ? (
        <div>
          {title ? (
            <div className="fw-semibold" style={{ fontSize: "1.25rem" }}>
              {title}
            </div>
          ) : null}
          {subtitle ? <div className="text-muted small">{subtitle}</div> : null}
          {children}
        </div>
      ) : (
        <div className="spinner-border" role="status" aria-label={ariaLabel} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Main controller
 * -----------------------------------------------------------------------------------------------*/

function CategoryTestingController({
  testedCategory,
  scenesConfigPath,
  questionnaireConfigPath,
  storageType,
  categoryId: categoryIdOverride,
  sessionId: initialSessionId,
  redirectTo,
  debug = false,
  config,
}: CategoryTestingControllerProps) {
  const runtimeConfig = useMemo(() => ({ ...DEFAULT_RUNTIME_CONFIG, ...config }), [config]);

  const log = useCallback(
    (...args: unknown[]) => {
      if (debug) {
        console.log("[CategoryTestingController]", ...args);
      }
    },
    [debug],
  );

  const categoryId = useMemo(() => categoryIdOverride ?? CATEGORY_ID_BY_KEY[testedCategory], [categoryIdOverride, testedCategory]);
  const localLastCompletedKey = useMemo(() => `category:lastCompletedAt:${categoryId}`, [categoryId]);

  const [step, setStep] = useState<ControllerStep>("boot");
  const [bootError, setBootError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(initialSessionId ?? null);
  const [scenesLoaded, setScenesLoaded] = useState(false);
  const [scenesByCategory, setScenesByCategory] = useState<ScenesByCategoryMap>({});
  const [incorrectQuestions, setIncorrectQuestions] = useState<IncorrectQuestion[]>([]);

  const scenesForCurrentCategory = useMemo(() => {
    const normalizedCategoryKey = normalizeSceneKey(testedCategory, runtimeConfig);
    const directMatch = scenesByCategory[normalizedCategoryKey];

    if (directMatch?.length) {
      return directMatch;
    }

    if (runtimeConfig.tolerateMarketplaceTypo && normalizedCategoryKey === "marketplace") {
      const legacyMarketplaceMatch = scenesByCategory["marketpace"];
      if (legacyMarketplaceMatch?.length) {
        return legacyMarketplaceMatch;
      }
    }

    return null;
  }, [runtimeConfig, scenesByCategory, testedCategory]);

  const getSceneForPhase = useCallback(
    (phase: ScenePhase): SceneConfig | null => {
      if (!scenesForCurrentCategory) {
        return null;
      }

      return scenesForCurrentCategory[PHASE_TO_SCENE_INDEX[phase]] ?? null;
    },
    [scenesForCurrentCategory],
  );

  const loadScenesConfig = useCallback(async (): Promise<void> => {
    setScenesLoaded(false);

    const response = await fetch(scenesConfigPath, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load scenesConfig (${response.status}) from ${scenesConfigPath}`);
    }

    let parsedJson: unknown;
    try {
      parsedJson = await response.json();
    } catch {
      throw new Error(`Scenes config is not valid JSON: ${scenesConfigPath}`);
    }

    const normalizedScenes: ScenesByCategoryMap = {};

    if (looksLikePhasedSceneConfig(parsedJson)) {
      const currentCategoryKey = normalizeSceneKey(testedCategory, runtimeConfig);
      normalizedScenes[currentCategoryKey] = normalizePhasedScenes(parsedJson);
      setScenesByCategory(normalizedScenes);
      setScenesLoaded(true);
      return;
    }

    if (isRecord(parsedJson)) {
      for (const [rawCategoryKey, rawCategoryValue] of Object.entries(parsedJson)) {
        const normalizedCategoryKey = normalizeSceneKey(rawCategoryKey, runtimeConfig);

        if (Array.isArray(rawCategoryValue)) {
          normalizedScenes[normalizedCategoryKey] = rawCategoryValue as SceneConfig[];
          normalizedScenes[rawCategoryKey] = rawCategoryValue as SceneConfig[];
          continue;
        }

        if (isRecord(rawCategoryValue)) {
          const phasedScenes = normalizePhasedScenes(rawCategoryValue);
          normalizedScenes[normalizedCategoryKey] = phasedScenes;
          normalizedScenes[rawCategoryKey] = phasedScenes;
        }
      }
    }

    setScenesByCategory(normalizedScenes);
    setScenesLoaded(true);
  }, [runtimeConfig, scenesConfigPath, testedCategory]);

  const ensureDatabaseSessionId = useCallback(async (): Promise<number> => {
    if (storageType !== "database") {
      throw new Error("ensureDatabaseSessionId called in non-database mode");
    }

    if (initialSessionId) {
      return initialSessionId;
    }

    if (sessionId !== null) {
      return sessionId;
    }

    if (testedCategory === "marketplace") {
      const response = await axiosInstance.post("/sessions");
      const createdSessionId = Number(response?.data?.session_id);

      if (!Number.isFinite(createdSessionId)) {
        throw new Error("create_session: missing session_id");
      }

      setSessionId(createdSessionId);
      log("created session for marketplace", createdSessionId);
      return createdSessionId;
    }

    const response = await axiosInstance.get("/sessions");
    const sessions = Array.isArray(response?.data) ? (response.data as SessionListItem[]) : [];

    const newestOpenSession = sessions
      .filter((session) => session && session.completed_at == null && Number.isFinite(Number(session.id)))
      .sort((leftSession, rightSession) => getSessionSortTimestamp(rightSession) - getSessionSortTimestamp(leftSession))[0];

    if (newestOpenSession) {
      const reusedSessionId = Number(newestOpenSession.id);
      setSessionId(reusedSessionId);
      log("reusing open session", reusedSessionId);
      return reusedSessionId;
    }

    const createFallbackResponse = await axiosInstance.post("/sessions");
    const fallbackSessionId = Number(createFallbackResponse?.data?.session_id);

    if (!Number.isFinite(fallbackSessionId)) {
      throw new Error("create_session fallback: missing session_id");
    }

    setSessionId(fallbackSessionId);
    log("created fallback session", fallbackSessionId);
    return fallbackSessionId;
  }, [storageType, initialSessionId, sessionId, testedCategory, log]);

  const findLatestCategoryCompletionInDatabase = useCallback(async (): Promise<Date | null> => {
    const response = await axiosInstance.get("/sessions");
    const sessions = Array.isArray(response?.data) ? (response.data as SessionListItem[]) : [];

    let latestCompletionDate: Date | null = null;

    for (const session of sessions) {
      const currentSessionId = Number(session?.id);
      if (!Number.isFinite(currentSessionId)) {
        continue;
      }

      try {
        const categoriesResponse = await axiosInstance.get(`/sessions/${currentSessionId}/categories`);
        const categories = Array.isArray(categoriesResponse?.data) ? (categoriesResponse.data as SessionCategoryStatus[]) : [];
        const matchingCategory = categories.find((category) => Number(category?.id) === Number(categoryId));
        const completedAt = parseApiDate(matchingCategory?.completed_at);

        if (!completedAt) {
          continue;
        }

        if (!latestCompletionDate || completedAt.getTime() > latestCompletionDate.getTime()) {
          latestCompletionDate = completedAt;
        }
      } catch {
        // Ignore per-session category lookup failures and continue scanning the remaining sessions.
      }
    }

    return latestCompletionDate;
  }, [categoryId]);

  const shouldShowPhase1 = useCallback(async (): Promise<boolean> => {
    if (testedCategory === "marketplace") {
      return true;
    }

    if (storageType !== "database") {
      try {
        const browserStorage = getBrowserStorage(storageType);
        if (!browserStorage) {
          return true;
        }

        const rawCompletionDate = browserStorage.getItem(localLastCompletedKey);
        if (!rawCompletionDate) {
          return true;
        }

        const completionDate = parseApiDate(rawCompletionDate);
        if (!completionDate) {
          return true;
        }

        return getHoursDifference(new Date(), completionDate) > runtimeConfig.categoryCooldownHours;
      } catch {
        return true;
      }
    }

    try {
      const latestCompletionDate = await findLatestCategoryCompletionInDatabase();
      if (!latestCompletionDate) {
        return true;
      }

      return getHoursDifference(new Date(), latestCompletionDate) > runtimeConfig.categoryCooldownHours;
    } catch {
      return true;
    }
  }, [runtimeConfig.categoryCooldownHours, testedCategory, storageType, localLastCompletedKey, findLatestCategoryCompletionInDatabase]);

  const ensureCategoryCompletedInDatabase = useCallback(
    async (databaseSessionId: number): Promise<void> => {
      try {
        await axiosInstance.patch(`/sessions/${databaseSessionId}/categories/${categoryId}/complete`);
        log("category completed", { databaseSessionId, categoryId });
        return;
      } catch (error) {
        const { status, message } = extractApiError(error);

        if (status === 400 && isErrorMessageMatch(message, runtimeConfig.noAnswersMessageFragment)) {
          log("category has no answers, seeding placeholder answer before completion");
          await axiosInstance.post(`/sessions/${databaseSessionId}/answers`, {
            category_id: categoryId,
            question_number: 1,
            answer_state: "0",
            user_answer: null,
          });
          await axiosInstance.patch(`/sessions/${databaseSessionId}/categories/${categoryId}/complete`);
          log("category completed after placeholder answer", { databaseSessionId, categoryId });
          return;
        }

        if (status === 400 && isErrorMessageMatch(message, runtimeConfig.alreadyCompletedMessageFragment)) {
          return;
        }

        throw error;
      }
    },
    [categoryId, log, runtimeConfig.alreadyCompletedMessageFragment, runtimeConfig.noAnswersMessageFragment],
  );

  const markCategoryCorrectedInDatabase = useCallback(
    async (databaseSessionId: number): Promise<void> => {
      try {
        await axiosInstance.patch(`/sessions/${databaseSessionId}/categories/${categoryId}/correct`);
        log("category corrected", { databaseSessionId, categoryId });
      } catch (error) {
        const { status, message } = extractApiError(error);

        if (status === 400 && isErrorMessageMatch(message, runtimeConfig.alreadyCorrectedMessageFragment)) {
          return;
        }

        log("correct category failed (non-fatal)", extractApiError(error));
      }
    },
    [categoryId, log, runtimeConfig.alreadyCorrectedMessageFragment],
  );

  useEffect(() => {
    log("step changed", { step, testedCategory, storageType, categoryId, sessionId });
  }, [step, testedCategory, storageType, categoryId, sessionId, log]);

  useEffect(() => {
    let isCancelled = false;

    const boot = async () => {
      setStep("boot");
      setBootError(null);
      setIncorrectQuestions([]);

      try {
        await loadScenesConfig();
        log("scenes loaded", scenesConfigPath);

        if (storageType === "database") {
          const databaseSessionId = await ensureDatabaseSessionId();
          if (isCancelled) {
            return;
          }

          setSessionId(databaseSessionId);
        }

        const displayPhase1 = await shouldShowPhase1();
        if (isCancelled) {
          return;
        }

        setStep(displayPhase1 ? "phase1" : "phase2");
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setBootError(extractApiError(error).message || "Boot failed");
        setStep("error");
        log("boot error", extractApiError(error));
      }
    };

    void boot();

    return () => {
      isCancelled = true;
    };
  }, [loadScenesConfig, ensureDatabaseSessionId, shouldShowPhase1, log, scenesConfigPath, storageType]);

  useEffect(() => {
    if (step === "phase5" && incorrectQuestions.length === 0) {
      log("phase5 entered without incorrect questions, skipping to phase6");
      setStep("phase6");
    }
  }, [step, incorrectQuestions.length, log]);

  const renderScenePhase = useCallback(
    (phase: ScenePhase, nextStep: ControllerStep) => {
      if (!scenesLoaded) {
        return <FullscreenStatus ariaLabel={runtimeConfig.sceneLoadingAriaLabel} />;
      }

      const sceneConfig = getSceneForPhase(phase);
      if (!sceneConfig) {
        return (
          <FullscreenStatus
            title={runtimeConfig.sceneMissingTitle}
            subtitle={
              <>
                category={testedCategory}, phase={phase}, path={scenesConfigPath}
              </>
            }
          >
            {debug ? (
              <pre className="text-start small mt-3 bg-light p-2 rounded" style={{ maxWidth: 720, overflow: "auto" }}>
                {JSON.stringify({ scenesForCurrentCategory }, null, 2)}
              </pre>
            ) : null}
          </FullscreenStatus>
        );
      }

      return (
        <SceneBuilder
          config={sceneConfig}
          runtimeConfig={sharedSceneBuilderRuntimeConfig}
          debug={debug}
          onComplete={() => setStep(nextStep)}
          onSkip={() => setStep(nextStep)}
        />
      );
    },
    [
      debug,
      getSceneForPhase,
      runtimeConfig.sceneLoadingAriaLabel,
      runtimeConfig.sceneMissingTitle,
      scenesLoaded,
      scenesConfigPath,
      scenesForCurrentCategory,
      testedCategory,
    ],
  );

  if (step === "boot") {
    return <FullscreenStatus ariaLabel={runtimeConfig.bootLoadingAriaLabel} />;
  }

  if (step === "error") {
    return <FullscreenStatus title={runtimeConfig.genericErrorTitle} subtitle={bootError ?? "Neznáma chyba"} />;
  }

  if (step === "phase1") {
    return renderScenePhase(1, "phase2");
  }

  if (step === "phase2") {
    return renderScenePhase(2, "phase3");
  }

  if (step === "phase3") {
    const databaseSessionId = storageType === "database" ? sessionId : undefined;

    if (storageType === "database" && !databaseSessionId) {
      return <FullscreenStatus title={runtimeConfig.missingSessionTitle} subtitle="Controller nedokázal vytvoriť alebo nájsť session." />;
    }

    return (
      <Phase3Testing
        questionnaireConfigPath={questionnaireConfigPath}
        categoryId={categoryId}
        storageType={storageType as React.ComponentProps<typeof Phase3Testing>["storageType"]}
        sessionId={databaseSessionId ?? undefined}
        debug={debug}
        config={sharedPhase3RuntimeConfig}
        onComplete={(receivedIncorrectQuestions: IncorrectQuestion[]) => {
          const normalizedIncorrectQuestions = Array.isArray(receivedIncorrectQuestions) ? receivedIncorrectQuestions : [];
          setIncorrectQuestions(normalizedIncorrectQuestions);
          setStep(normalizedIncorrectQuestions.length > 0 ? "phase4" : "phase6");
        }}
      />
    );
  }

  if (step === "phase4") {
    return renderScenePhase(4, "phase5");
  }

  if (step === "phase5") {
    const databaseSessionId = storageType === "database" ? sessionId : undefined;

    if (incorrectQuestions.length === 0) {
      return null;
    }

    return (
      <Phase5Testing
        wrongQuestions={incorrectQuestions as React.ComponentProps<typeof Phase5Testing>["wrongQuestions"]}
        categoryId={categoryId}
        storageType={storageType as React.ComponentProps<typeof Phase5Testing>["storageType"]}
        sessionId={databaseSessionId ?? undefined}
        debug={debug}
        config={sharedPhase5RuntimeConfig}
        onComplete={async () => {
          if (storageType === "database" && databaseSessionId) {
            await markCategoryCorrectedInDatabase(databaseSessionId);
          }

          setStep("phase6");
        }}
      />
    );
  }

  if (step === "phase6") {
    return renderScenePhase(6, "done");
  }

  if (step === "done") {
    return (
      <FinalizeAndRedirect
        storageType={storageType}
        sessionId={sessionId}
        categoryId={categoryId}
        localLastCompletedKey={localLastCompletedKey}
        ensureCategoryCompletedDb={ensureCategoryCompletedInDatabase}
        redirectHref={resolveRedirectPath(redirectTo, categoryId, runtimeConfig)}
        debug={debug}
        runtimeConfig={runtimeConfig}
      />
    );
  }

  return null;
}

/* -------------------------------------------------------------------------------------------------
 * Finalization step
 * -----------------------------------------------------------------------------------------------*/

function FinalizeAndRedirect({
  storageType,
  sessionId,
  categoryId,
  localLastCompletedKey,
  ensureCategoryCompletedDb,
  redirectHref,
  debug,
  runtimeConfig,
}: FinalizeAndRedirectProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const log = useCallback(
    (...args: unknown[]) => {
      if (debug) {
        console.log("[FinalizeAndRedirect]", ...args);
      }
    },
    [debug],
  );

  useEffect(() => {
    let isCancelled = false;

    const finalize = async () => {
      try {
        if (storageType === "database") {
          if (!sessionId) {
            throw new Error("Missing sessionId at finalize");
          }

          await ensureCategoryCompletedDb(sessionId);
        } else {
          const browserStorage = getBrowserStorage(storageType);
          if (!browserStorage) {
            throw new Error("Web storage not available");
          }

          browserStorage.setItem(localLastCompletedKey, new Date().toISOString());
        }

        if (isCancelled) {
          return;
        }

        log("redirecting after category completion", { storageType, sessionId, categoryId, redirectHref });
        router.push(redirectHref);
        router.refresh();
      } catch (error) {
        if (isCancelled) {
          return;
        }

        const parsedError = extractApiError(error);
        setErrorMessage(parsedError.message || "Finalize failed");
        log("finalize error", parsedError);
      }
    };

    void finalize();

    return () => {
      isCancelled = true;
    };
  }, [storageType, sessionId, categoryId, localLastCompletedKey, ensureCategoryCompletedDb, redirectHref, router, log]);

  if (!errorMessage) {
    return <FullscreenStatus ariaLabel={runtimeConfig.finalizingLoadingAriaLabel} />;
  }

  return <FullscreenStatus title={runtimeConfig.finalizeErrorTitle} subtitle={errorMessage} />;
}

export default withAuth(CategoryTestingController);
