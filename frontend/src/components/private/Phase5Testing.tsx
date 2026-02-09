"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import axiosInstance from "@/utilities/AxiosInstance";

type StorageType = "local_storage" | "database";

type Answer = {
  answerId: number;
  isCorrect: boolean;
  label: string;
  imagePath: string;
};

type SceneConfigTimeline = {
  sound_path: string;
  pictures: Array<{
    path: string;
    display_time: string | number;
    display_type: "insert" | "add" | "remove" | "remove_last_and_add" | "remove_all_and_add";
  }>;
};

type SceneConfigSingle = {
  picture_path: string;
  sound_path: string;
};

type BaseQuestion = {
  questionId: number;
  questionText: string;
  questionAudioPath: string;
  acceptedTranscripts: string[];
};

type Question =
  | (BaseQuestion & { questionType: 1; answers: Answer[] })
  | (BaseQuestion & { questionType: 2; questionText2: string; questionAudioPath2: string; answers: Answer[] })
  | (BaseQuestion & { questionType: 3; config: SceneConfigTimeline | SceneConfigSingle })
  | (BaseQuestion & { questionType: 4; imagePath: string });

type SavePayload = {
  category_id: number;
  question_number: number;
  answer_state: string; // "2" correct, "3" incorrect
  // selected_answer_id?: number;
};

type Props = {
  wrongQuestions: Question[]; // input from Phase 3 (wrong only)
  categoryId: number;
  storageType: StorageType;

  // required for DB mode
  sessionId?: number;
  answersPath?: (sessionId: number) => string; // default below

  debug?: boolean;
  onComplete?: () => void;
};

const defaultAnswersPath = (id: number) => `/sessions/${id}/answers`;

// always-random (no seed, no persistence)
function cryptoRandInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.getRandomValues) return Math.floor(Math.random() * maxExclusive);

  const range = 0xffffffff;
  const limit = Math.floor(range / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  while (true) {
    cryptoObj.getRandomValues(buf);
    const x = buf[0] >>> 0;
    if (x < limit) return x % maxExclusive;
  }
}

function shuffleRandom<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = cryptoRandInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getPromptText(q: Question): string {
  return q.questionType === 2 ? q.questionText2 : q.questionText;
}

function getAudioSrc(q: Question): string {
  if (q.questionType === 2) return q.questionAudioPath2;
  if (q.questionType === 3) {
    const c: any = q.config;
    if (typeof c?.sound_path === "string" && c.sound_path) return c.sound_path;
  }
  return q.questionAudioPath;
}

function dedupeByQuestionId(list: Question[]): Question[] {
  const seen = new Set<number>();
  const out: Question[] = [];
  for (const q of list ?? []) {
    if (!q || typeof (q as any).questionId !== "number") continue;
    if (seen.has(q.questionId)) continue;
    seen.add(q.questionId);
    out.push(q);
  }
  return out;
}

export default function Phase5Testing({ wrongQuestions, categoryId, storageType, sessionId, answersPath, debug = false, onComplete }: Props) {
  const useLocal = storageType === "local_storage";
  const useDb = storageType === "database";

  // DB-only means DB-only (no other storage side effects)
  const scopeKey = useMemo(() => `phase5:${categoryId}`, [categoryId]);
  const localAnsweredKey = `${scopeKey}:answered`;
  const localResultsKey = `${scopeKey}:results`;

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [answeredIds, setAnsweredIds] = useState<Set<number>>(new Set());
  const [activeIndex, setActiveIndex] = useState(0);
  const [saveBusy, setSaveBusy] = useState(false);

  // per-question shuffled answers (stable during the question)
  const [shuffledAnswers, setShuffledAnswers] = useState<Record<number, Answer[]>>({});

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const total = questions.length;
  const answeredCount = answeredIds.size;
  const progressPct = total ? Math.round((answeredCount / total) * 100) : 0;

  const orderedQuestions = useMemo(() => {
    const byId = new Map(questions.map((q) => [q.questionId, q]));
    return order.map((id) => byId.get(id)).filter(Boolean) as Question[];
  }, [questions, order]);

  const remaining = useMemo(() => orderedQuestions.filter((q) => !answeredIds.has(q.questionId)), [orderedQuestions, answeredIds]);

  const activeQ = remaining[activeIndex] ?? null;

  useEffect(() => {
    if (activeIndex >= remaining.length) setActiveIndex(Math.max(0, remaining.length - 1));
  }, [remaining.length, activeIndex]);

  // Load from props, randomize order ALWAYS
  useEffect(() => {
    setLoading(true);
    try {
      const base = dedupeByQuestionId(wrongQuestions);
      const ids = base.map((q) => q.questionId);
      const randomizedOrder = shuffleRandom(ids);

      setQuestions(base);
      setOrder(randomizedOrder);

      // shuffle answers for each question once
      const answerMap: Record<number, Answer[]> = {};
      for (const q of base) {
        if (q.questionType === 1 || q.questionType === 2) {
          answerMap[q.questionId] = shuffleRandom(q.answers ?? []);
        }
      }
      setShuffledAnswers(answerMap);

      if (useLocal) {
        const rawAnswered = localStorage.getItem(localAnsweredKey);
        const answered = rawAnswered ? new Set<number>(JSON.parse(rawAnswered)) : new Set<number>();
        setAnsweredIds(answered);
      } else {
        setAnsweredIds(new Set());
      }

      setActiveIndex(0);
    } catch (e) {
      console.error("[Phase5] zlyhalo načítanie vstupných otázok", e);
      setQuestions([]);
      setOrder([]);
      setShuffledAnswers({});
      setAnsweredIds(new Set());
      setActiveIndex(0);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrongQuestions, categoryId, storageType]);

  // DB hydration (DB-only: no localStorage usage)
  useEffect(() => {
    if (!useDb) return;
    if (!sessionId) return;
    if (!questions.length) return;

    (async () => {
      const url = (answersPath ?? defaultAnswersPath)(sessionId);
      const res = await axiosInstance.get(url);
      const raw = res?.data;
      const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.answers) ? raw.answers : [];

      const baseIds = new Set(questions.map((q) => q.questionId));
      const nextAnswered = new Set<number>();

      for (const r of rows) {
        if (Number(r?.category_id) !== Number(categoryId)) continue;
        const qn = Number(r?.question_number);
        if (!Number.isFinite(qn)) continue;
        if (!baseIds.has(qn)) continue;

        // In Phase 5 we always save correct/incorrect, so any row means answered.
        nextAnswered.add(qn);
      }

      setAnsweredIds(nextAnswered);
      setActiveIndex(0);
    })().catch((e) => console.error("[Phase5] zlyhala hydratácia", e));
  }, [useDb, sessionId, categoryId, answersPath, questions]);

  // Audio play-state tracking
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);

    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
    };
  }, [activeQ?.questionId]);

  // Reset audio when question changes
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setIsPlaying(false);
  }, [activeQ?.questionId]);

  const togglePlayPause = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      try {
        await a.play();
      } catch (e) {
        if (debug) console.debug("[Phase5] prehrávanie zablokované (gesto)", e);
      }
    } else {
      a.pause();
    }
  };

  const replayAudio = async () => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setIsPlaying(false);
    try {
      await a.play();
    } catch (e) {
      if (debug) console.debug("[Phase5] prehrávanie zablokované (gesto)", e);
    }
  };

  const saveLocal = (payload: SavePayload) => {
    const raw = localStorage.getItem(localResultsKey);
    const obj = raw ? JSON.parse(raw) : {};
    obj[String(payload.question_number)] = { ...payload, saved_at: new Date().toISOString() };
    localStorage.setItem(localResultsKey, JSON.stringify(obj));
  };

  const saveDb = async (payload: SavePayload) => {
    if (!sessionId) throw new Error("Chýba sessionId");
    const url = (answersPath ?? defaultAnswersPath)(sessionId);
    await axiosInstance.post(url, payload);
  };

  const persistAnsweredLocal = (nextAnswered: Set<number>) => {
    if (!useLocal) return;
    localStorage.setItem(localAnsweredKey, JSON.stringify(Array.from(nextAnswered)));
  };

  const finalizeAnswer = async (q: Question, chosen: Answer) => {
    if (saveBusy) return;
    const correct = !!chosen.isCorrect;
    const payload: SavePayload = {
      category_id: categoryId,
      question_number: q.questionId,
      answer_state: correct ? "2" : "3",
      // selected_answer_id: chosen.answerId,
    };

    setSaveBusy(true);
    try {
      if (useLocal) saveLocal(payload);
      else await saveDb(payload);

      const nextAnswered = new Set(answeredIds);
      nextAnswered.add(q.questionId);
      setAnsweredIds(nextAnswered);
      persistAnsweredLocal(nextAnswered);

      const nextRemaining = remaining.length - 1;
      if (nextRemaining <= 0) onComplete?.();
      else setActiveIndex((i) => Math.min(i, nextRemaining - 1));
    } catch (e) {
      console.error("[Phase5] zlyhalo ukladanie", e);
    } finally {
      setSaveBusy(false);
    }
  };

  const canNavigate = !saveBusy;

  const goPrev = () => {
    if (!canNavigate) return;
    setActiveIndex((i) => Math.max(0, i - 1));
  };

  const goNext = () => {
    if (!canNavigate) return;
    setActiveIndex((i) => Math.min(remaining.length - 1, i + 1));
  };

  const btn = (variant: "primary" | "outline-primary" | "outline-secondary") => `btn btn-${variant} rounded-pill px-3`;

  if (useDb && !sessionId) {
    return (
      <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-white p-3 text-center">
        <div>
          <div className="fw-semibold" style={{ fontSize: "1.25rem" }}>
            Chýba sessionId
          </div>
          <div className="text-muted small">storageType=database vyžaduje sessionId</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-white">
        <div className="spinner-border" role="status" aria-label="Načítavam" />
      </div>
    );
  }

  if (!total) {
    return (
      <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-white p-3 text-center">
        <div>
          <div className="fw-semibold" style={{ fontSize: "1.25rem" }}>
            Žiadne otázky pre fázu 5
          </div>
        </div>
      </div>
    );
  }

  if (!activeQ) {
    return (
      <div className="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-white p-3 text-center">
        <div className="fw-semibold" style={{ fontSize: "1.25rem" }}>
          Dokončené
        </div>
        <div className="text-muted small">
          Zodpovedané: {answeredCount}/{total}
        </div>
      </div>
    );
  }

  // Phase 5 expects answers-image selection; if not 1/2, show a hard stop card.
  if (!(activeQ.questionType === 1 || activeQ.questionType === 2)) {
    return (
      <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-white p-3 text-center">
        <div>
          <div className="fw-semibold" style={{ fontSize: "1.25rem" }}>
            Nepodporovaný typ otázky vo fáze 5
          </div>
          <div className="text-muted small">questionType: {activeQ.questionType}</div>
        </div>
      </div>
    );
  }

  const promptText = getPromptText(activeQ);
  const audioSrc = getAudioSrc(activeQ);

  // NOTE: do NOT use hooks (useMemo) after conditional returns above.
  // Keep this as plain computation to avoid React hook-order crashes.
  const answersForUi = shuffledAnswers[activeQ.questionId] ?? activeQ.answers;

  // Keep a stable grid: 6 answers -> 3 + 3, 4 answers -> 2 + 2.
  // If the last row is incomplete, fill it with invisible placeholders.
  const cols = answersForUi.length <= 4 ? 2 : 3;
  const mod = answersForUi.length % cols;
  const missing = mod === 0 ? 0 : cols - mod;
  const paddedAnswers = [...answersForUi, ...Array(missing).fill(null)] as Array<Answer | null>;

  const rowColsClass = cols === 2 ? "row row-cols-2 g-2 g-sm-3" : "row row-cols-2 row-cols-sm-3 g-2 g-sm-3";
  const cardPadding = "clamp(6px, 1.1vw, 10px)";
  const imgBoxHeight = "clamp(92px, 22vh, 280px)";

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 bg-white" style={{ overflow: "hidden" }}>
      {/* progress */}
      <div className="w-100 px-2" style={{ paddingTop: 6 }}>
        <div className="d-flex align-items-center gap-2">
          <div className="progress flex-grow-1" style={{ height: 8, borderRadius: 999 }}>
            <div
              className="progress-bar"
              role="progressbar"
              style={{ width: `${progressPct}%` }}
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <div className="small text-muted" style={{ minWidth: 72, textAlign: "right" }}>
            {answeredCount}/{total}
          </div>
        </div>
      </div>

      <audio ref={audioRef} src={audioSrc} preload="auto" style={{ display: "none" }} />

      <div
        className="w-100 h-100"
        style={{
          paddingBottom: `calc(env(safe-area-inset-bottom) + 34px)`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* header */}
        <div className="w-100 px-2" style={{ paddingTop: 10, paddingBottom: 6 }}>
          <div className="d-flex align-items-center justify-content-center" style={{ maxWidth: 1280, margin: "0 auto" }}>
            <div className="d-flex align-items-center justify-content-between w-100" style={{ gap: 12, flexWrap: "wrap" }}>
              <div className="fw-semibold text-center flex-grow-1" style={{ fontSize: "clamp(1.6rem, 2.2vw, 2.5rem)", lineHeight: 1.12 }}>
                {promptText}
              </div>

              <div className="d-flex gap-2 justify-content-center" style={{ flex: "0 0 auto" }}>
                <button type="button" className={btn("outline-primary")} onClick={() => void togglePlayPause()} disabled={saveBusy}>
                  <i className={`bi ${isPlaying ? "bi-pause-fill" : "bi-play-fill"} me-2`} />
                  {isPlaying ? "Pauza" : "Prehrať"}
                </button>

                <button type="button" className={btn("outline-secondary")} onClick={() => void replayAudio()} disabled={saveBusy}>
                  <i className="bi bi-arrow-counterclockwise me-2" />
                  Znova
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* answers grid */}
        <div className="w-100 flex-grow-1" style={{ position: "relative" }}>
          {/* nav arrows */}
          <button
            type="button"
            aria-label="Predchádzajúca"
            onClick={goPrev}
            disabled={!canNavigate || activeIndex <= 0}
            className="btn btn-light"
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              borderRadius: 999,
              width: 46,
              height: 46,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: activeIndex <= 0 || !canNavigate ? 0.35 : 0.9,
              zIndex: 20,
            }}
          >
            <i className="bi bi-chevron-left" style={{ fontSize: 24 }} />
          </button>

          <button
            type="button"
            aria-label="Nasledujúca"
            onClick={goNext}
            disabled={!canNavigate || activeIndex >= remaining.length - 1}
            className="btn btn-light"
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              borderRadius: 999,
              width: 46,
              height: 46,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: activeIndex >= remaining.length - 1 || !canNavigate ? 0.35 : 0.9,
              zIndex: 20,
            }}
          >
            <i className="bi bi-chevron-right" style={{ fontSize: 24 }} />
          </button>

          <div className="w-100 h-100 d-flex align-items-center justify-content-center" style={{ maxWidth: 1440, margin: "0 auto" }}>
            <div className="container-fluid" style={{ maxWidth: 1280 }}>
              <div className={rowColsClass}>
                {paddedAnswers.map((a, idx) => {
                  if (!a) {
                    // placeholder to keep the last row aligned
                    return (
                      <div className="col" key={`ph-${idx}`} style={{ visibility: "hidden" }}>
                        <div style={{ borderRadius: 14, padding: 10, border: "1px solid rgba(0,0,0,0.12)" }}>
                          <div style={{ position: "relative", width: "100%", height: imgBoxHeight }} />
                          <div className="mt-2" style={{ height: 22 }} />
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="col" key={a.answerId}>
                      <button
                        type="button"
                        disabled={saveBusy}
                        onClick={() => void finalizeAnswer(activeQ, a)}
                        className="w-100 text-start"
                        style={{
                          border: "1px solid rgba(0,0,0,0.12)",
                          background: "white",
                          borderRadius: 14,
                          padding: cardPadding,
                        }}
                      >
                        <div style={{ position: "relative", width: "100%", height: imgBoxHeight, borderRadius: 10, overflow: "hidden" }}>
                          <Image
                            src={a.imagePath}
                            alt={a.label ?? ""}
                            fill
                            sizes="(max-width: 768px) 45vw, (max-width: 1200px) 28vw, 22vw"
                            style={{ objectFit: "contain" }}
                          />
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="text-center text-muted small mt-3">
                Otázka {Math.min(activeIndex + 1, remaining.length)}/{remaining.length}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
