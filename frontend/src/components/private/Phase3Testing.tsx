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

type DisplayType = "insert" | "add" | "remove" | "remove_last_and_add" | "remove_all_and_add";

type SceneConfigTimeline = {
  sound_path: string;
  pictures: Array<{
    path: string;
    display_time: string | number;
    display_type: DisplayType;
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
  answer_state: string; // "1" or "true"
  user_answer?: string | null;
};

type Props = {
  questionnaireConfigPath: string;
  categoryId: number;
  storageType: StorageType;

  sessionId?: number;
  answersPath?: (sessionId: number) => string;

  debug?: boolean;
  onComplete?: (incorrectQuestions: Question[]) => void;
};

const defaultAnswersPath = (id: number) => `/sessions/${id}/answers`;

// Crypto shuffle (no seed, always fresh)
function cryptoRandInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.getRandomValues) return Math.floor(Math.random() * maxExclusive);

  const range = 0xffffffff;
  const limit = Math.floor(range / maxExclusive) * maxExclusive; // rejection sampling
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

function parseTimeToSeconds(v: string | number): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, v);
  const s = String(v).trim();
  if (!s) return 0;
  if (/^\d+$/.test(s)) return Math.max(0, Number(s));

  const parts = s.split(":").map((p) => p.trim());
  if (parts.some((p) => p === "" || !/^\d+$/.test(p))) return 0;
  const nums = parts.map(Number);

  if (nums.length === 2) return nums[0] * 60 + nums[1];
  if (nums.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2];
  return 0;
}

function normalizeTranscript(s: string): string {
  const trimmed = (s ?? "").trim().toLowerCase();
  const noPunct = trimmed.replace(/[^\p{L}\p{N}\s-]+/gu, " ");
  const collapsed = noPunct.replace(/\s+/g, " ").trim();
  return collapsed.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

function getStimulusImage(q: Question): string | null {
  if (q.questionType === 1 || q.questionType === 2) {
    const correct = q.answers.find((a) => a.isCorrect);
    return correct?.imagePath ?? null;
  }
  if (q.questionType === 4) return q.imagePath;
  return null;
}

function isTimelineConfig(c: SceneConfigTimeline | SceneConfigSingle): c is SceneConfigTimeline {
  return Array.isArray((c as any)?.pictures);
}

function applySceneEvent(current: string[], path: string, type: DisplayType): string[] {
  switch (type) {
    case "insert":
      return [path];
    case "add":
      return current.includes(path) ? current : [...current, path];
    case "remove":
      return current.filter((x) => x !== path);
    case "remove_last_and_add": {
      const next = current.slice(0, Math.max(0, current.length - 1));
      next.push(path);
      return next;
    }
    case "remove_all_and_add":
      return [path];
    default:
      return current;
  }
}

function computeSceneImages(config: SceneConfigTimeline | SceneConfigSingle, currentTime: number): string[] {
  if (!isTimelineConfig(config)) return [config.picture_path];

  const events = [...config.pictures]
    .map((p) => ({ path: p.path, t: parseTimeToSeconds(p.display_time), type: p.display_type }))
    .sort((a, b) => a.t - b.t);

  let imgs: string[] = [];
  for (const e of events) {
    if (e.t > currentTime + 0.01) break;
    imgs = applySceneEvent(imgs, e.path, e.type);
  }
  return imgs;
}

function useBrowserSpeechRecognition(lang: string) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [finalText, setFinalText] = useState("");
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    setSupported(true);

    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = lang;

    r.onresult = (evt: any) => {
      let interimAccum = "";
      let finalAccum = "";
      for (let i = evt.resultIndex; i < evt.results.length; i++) {
        const res = evt.results[i];
        const txt = res?.[0]?.transcript ?? "";
        if (res.isFinal) finalAccum += txt + " ";
        else interimAccum += txt + " ";
      }
      if (interimAccum) setInterim(interimAccum.trim());
      if (finalAccum) {
        setFinalText((prev) => (prev ? prev + " " : "") + finalAccum.trim());
        setInterim("");
      }
    };

    r.onerror = (e: any) => {
      console.error("[Phase3] chyba rozpoznávania reči", e);
      setListening(false);
    };
    r.onend = () => setListening(false);

    recognitionRef.current = r;
  }, [lang]);

  const start = () => {
    if (!recognitionRef.current) return;
    setFinalText("");
    setInterim("");
    setListening(true);
    recognitionRef.current.start();
  };

  const stop = () => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setListening(false);
  };

  const reset = () => {
    setFinalText("");
    setInterim("");
  };

  return { supported, listening, interim, finalText, start, stop, reset };
}

function SceneFull({ config, audioTime }: { config: SceneConfigTimeline | SceneConfigSingle; audioTime: number }) {
  const imgs = useMemo(() => computeSceneImages(config, audioTime), [config, audioTime]);
  const n = imgs.length;

  if (n <= 1) {
    return (
      <div className="w-100 h-100" style={{ position: "relative" }}>
        {imgs[0] ? (
          <Image src={imgs[0]} alt="" fill sizes="100vw" style={{ objectFit: "contain" }} priority />
        ) : (
          <div className="w-100 h-100 d-flex align-items-center justify-content-center text-muted">Scéna je pripravená</div>
        )}
      </div>
    );
  }

  return (
    <div className="w-100 h-100 d-flex flex-wrap align-items-center justify-content-center" style={{ gap: 10, padding: 10 }}>
      {imgs.map((src, i) => (
        <div
          key={`${src}-${i}`}
          style={{
            position: "relative",
            flex: n === 2 ? "0 0 48%" : "0 0 32%",
            height: n === 2 ? "92%" : "48%",
            minHeight: 140,
          }}
        >
          <Image src={src} alt="" fill sizes={n === 2 ? "48vw" : "32vw"} style={{ objectFit: "contain" }} />
        </div>
      ))}
    </div>
  );
}

export default function Phase3Testing({
  questionnaireConfigPath,
  categoryId,
  storageType,
  sessionId,
  answersPath,
  debug = false,
  onComplete,
}: Props) {
  const useLocal = storageType === "local_storage";
  const useDb = storageType === "database";

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [answeredIds, setAnsweredIds] = useState<Set<number>>(new Set());
  const [incorrect, setIncorrect] = useState<Question[]>([]);
  const [saveBusy, setSaveBusy] = useState(false);

  const [activeIndex, setActiveIndex] = useState(0);
  const [phase, setPhase] = useState<"nahravanie" | "kontrola" | "uprava">("nahravanie");
  const [editableText, setEditableText] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioTime, setAudioTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const { supported, listening, interim, finalText, start, stop, reset } = useBrowserSpeechRecognition("sk-SK");

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const scopeKey = useMemo(() => {
    // only relevant for local storage mode
    return `phase3:${categoryId}:${questionnaireConfigPath}`;
  }, [categoryId, questionnaireConfigPath]);

  const uiAnsweredKey = `${scopeKey}:answered`;
  const uiIncorrectKey = `${scopeKey}:incorrect`;

  const orderedQuestions = useMemo(() => {
    const byId = new Map(questions.map((q) => [q.questionId, q]));
    return order.map((id) => byId.get(id)).filter(Boolean) as Question[];
  }, [questions, order]);

  const remaining = useMemo(() => orderedQuestions.filter((q) => !answeredIds.has(q.questionId)), [orderedQuestions, answeredIds]);
  const activeQ = remaining[activeIndex] ?? null;

  const total = orderedQuestions.length;
  const answeredCount = answeredIds.size;
  const progressPct = total ? Math.round((answeredCount / total) * 100) : 0;

  const readUiStateLocal = () => {
    if (!useLocal) return { a: new Set<number>(), i: [] as number[] };
    const aRaw = localStorage.getItem(uiAnsweredKey);
    const iRaw = localStorage.getItem(uiIncorrectKey);
    const a = aRaw ? new Set<number>(JSON.parse(aRaw)) : new Set<number>();
    const i = iRaw ? (JSON.parse(iRaw) as number[]) : [];
    return { a, i };
  };

  const persistUiStateLocal = (a: Set<number>, inc: Question[]) => {
    if (!useLocal) return;
    localStorage.setItem(uiAnsweredKey, JSON.stringify(Array.from(a)));
    localStorage.setItem(uiIncorrectKey, JSON.stringify(inc.map((q) => q.questionId)));
  };

  useEffect(() => {
    if (activeIndex >= remaining.length) setActiveIndex(Math.max(0, remaining.length - 1));
  }, [remaining.length, activeIndex]);

  // Load JSON + ALWAYS randomize order (no persistence)
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch(questionnaireConfigPath, { cache: "no-store" });
        const data = (await r.json()) as Question[];

        const valid = Array.isArray(data) ? data.filter((q: any) => typeof q?.questionId === "number" && typeof q?.questionType === "number") : [];

        const computedOrder = shuffleRandom(valid.map((q: any) => q.questionId));

        setQuestions(valid as Question[]);
        setOrder(computedOrder);

        if (useLocal) {
          const { a, i } = readUiStateLocal();
          const incorrectQs = valid.filter((q: any) => i.includes(q.questionId));
          setAnsweredIds(a);
          setIncorrect(incorrectQs as Question[]);
        } else {
          setAnsweredIds(new Set());
          setIncorrect([]);
        }

        setActiveIndex(0);
      } catch (e) {
        console.error("[Phase3] zlyhalo načítanie JSON", e);
        setQuestions([]);
        setOrder([]);
        setAnsweredIds(new Set());
        setIncorrect([]);
        setActiveIndex(0);
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionnaireConfigPath, categoryId, storageType]);

  // DB hydration (NO localStorage usage)
  useEffect(() => {
    if (!useDb) return;
    if (!sessionId) return;
    if (!questions.length) return;
    if (!order.length) return;

    (async () => {
      const url = (answersPath ?? defaultAnswersPath)(sessionId);
      const res = await axiosInstance.get(url);
      const raw = res?.data;
      const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.answers) ? raw.answers : [];

      const nextAnswered = new Set<number>();
      for (const r of rows) {
        if (Number(r?.category_id) !== Number(categoryId)) continue;
        const qn = Number(r?.question_number);
        if (!Number.isFinite(qn)) continue;
        nextAnswered.add(qn);
      }

      setAnsweredIds(nextAnswered);
      setIncorrect([]); // cannot reconstruct incorrect Type 1/2 because you intentionally do not save them
      setActiveIndex(0);
    })().catch((e) => console.error("[Phase3] zlyhala hydratácia", e));
  }, [useDb, sessionId, categoryId, questions.length, order.length, answersPath]);

  useEffect(() => {
    if (!activeQ) return;

    setPhase("nahravanie");
    setEditableText("");
    reset();

    setAudioTime(0);
    setIsPlaying(false);

    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
  }, [activeQ?.questionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onTime = () => setAudioTime(a.currentTime || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("seeked", onTime);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);

    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("seeked", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
    };
  }, [activeQ?.questionId]);

  const playAudio = async () => {
    const a = audioRef.current;
    if (!a) return;
    try {
      await a.play();
    } catch (e) {
      if (debug) console.debug("[Phase3] prehrávanie zablokované (gesto)", e);
    }
  };

  const pauseAudio = () => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
  };

  const togglePlayPause = async () => {
    if (isPlaying) pauseAudio();
    else await playAudio();
  };

  const replayAudio = async () => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setAudioTime(0);
    await playAudio();
  };

  const saveLocalResult = (payload: SavePayload) => {
    const k = `${scopeKey}:answers_payload`;
    const raw = localStorage.getItem(k);
    const obj = raw ? JSON.parse(raw) : {};
    obj[String(payload.question_number)] = { ...payload, saved_at: new Date().toISOString() };
    localStorage.setItem(k, JSON.stringify(obj));
  };

  const saveDbResult = async (payload: SavePayload) => {
    if (!sessionId) throw new Error("Chýba sessionId");
    const url = (answersPath ?? defaultAnswersPath)(sessionId);
    await axiosInstance.post(url, payload);
  };

  // Type 1/2 incorrect -> NO POST (send nothing)
  const evaluateAndFinalize = async (q: Question, userText: string) => {
    const normUser = normalizeTranscript(userText);
    const accepted = (q.acceptedTranscripts ?? []).map(normalizeTranscript);
    const isCorrect = accepted.includes(normUser);

    const isBoolQuestion = q.questionType === 3 || q.questionType === 4;
    const shouldPersistResult = isBoolQuestion || isCorrect;

    const payload: SavePayload | null = shouldPersistResult
      ? {
          category_id: categoryId,
          question_number: q.questionId,
          answer_state: isBoolQuestion ? String(isCorrect) : "1",
          user_answer: userText || null,
        }
      : null;

    setSaveBusy(true);
    try {
      if (payload) {
        if (useLocal) saveLocalResult(payload);
        else await saveDbResult(payload);
      }

      const nextAnswered = new Set(answeredIds);
      nextAnswered.add(q.questionId);

      let nextIncorrect = incorrect;
      if (!isBoolQuestion && !isCorrect) {
        if (!incorrect.some((x) => x.questionId === q.questionId)) nextIncorrect = [...incorrect, q];
      }

      setAnsweredIds(nextAnswered);
      setIncorrect(nextIncorrect);

      if (useLocal) persistUiStateLocal(nextAnswered, nextIncorrect);

      const nextRemainingCount = remaining.length - 1;
      if (nextRemainingCount <= 0) onComplete?.(nextIncorrect);
      else setActiveIndex((i) => Math.min(i, nextRemainingCount - 1));
    } catch (e) {
      console.error("[Phase3] zlyhalo ukladanie", e);
    } finally {
      setSaveBusy(false);
    }
  };

  const canNavigate = phase === "nahravanie" && !saveBusy && !listening;

  const goPrev = () => {
    if (!canNavigate) return;
    setActiveIndex((i) => Math.max(0, i - 1));
  };

  const goNext = () => {
    if (!canNavigate) return;
    setActiveIndex((i) => Math.min(remaining.length - 1, i + 1));
  };

  const onTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    touchStartY.current = e.touches[0]?.clientY ?? null;
  };

  const onTouchEnd: React.TouchEventHandler<HTMLDivElement> = (e) => {
    const sx = touchStartX.current;
    const sy = touchStartY.current;
    const ex = e.changedTouches[0]?.clientX ?? null;
    const ey = e.changedTouches[0]?.clientY ?? null;

    touchStartX.current = null;
    touchStartY.current = null;

    if (sx == null || ex == null || sy == null || ey == null) return;

    const dx = ex - sx;
    const dy = ey - sy;

    if (Math.abs(dy) > Math.abs(dx)) return;
    if (Math.abs(dx) < 55) return;

    if (dx > 0) goPrev();
    else goNext();
  };

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
            Žiadne otázky
          </div>
          <div className="text-muted small">{questionnaireConfigPath}</div>
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
        <div className="text-muted small">Nesprávne pre ďalšiu fázu: {incorrect.length}</div>
      </div>
    );
  }

  const promptText = getPromptText(activeQ);
  const audioSrc = getAudioSrc(activeQ);
  const stimulusImage = getStimulusImage(activeQ);
  const liveText = (finalText || interim || "").trim();

  const showEditInput = phase === "uprava";
  const isScene = activeQ.questionType === 3;

  const btn = (variant: "primary" | "outline-primary" | "outline-secondary" | "success" | "outline-success") =>
    `btn btn-${variant} rounded-pill px-3`;

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 bg-white" style={{ overflow: "hidden" }}>
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
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          paddingBottom: `calc(env(safe-area-inset-bottom) + 34px)`,
          display: "flex",
          flexDirection: "column",
        }}
      >
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

        <div className="w-100 flex-grow-1" style={{ position: "relative" }}>
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
            {isScene ? (
              <div className="w-100 h-100">
                <SceneFull config={(activeQ as any).config} audioTime={audioTime} />
              </div>
            ) : stimulusImage ? (
              <div style={{ position: "relative", width: "min(86vw, 1100px)", height: "52dvh", maxHeight: "52dvh" }}>
                <Image
                  src={stimulusImage}
                  alt=""
                  fill
                  sizes="(max-width: 1100px) 86vw, 1100px"
                  style={{ objectFit: "contain", borderRadius: 12 }}
                  priority
                />
              </div>
            ) : (
              <div className="text-muted">Bez obrázka</div>
            )}
          </div>
        </div>

        <div className="w-100 px-2" style={{ paddingTop: 10, paddingBottom: 10 }}>
          <div className="d-flex flex-column align-items-center" style={{ maxWidth: 1280, margin: "0 auto", gap: 10 }}>
            {!showEditInput ? (
              <div className="w-100 text-center" style={{ minHeight: 40 }}>
                <div className="text-muted" style={{ fontSize: 16, marginBottom: 2 }}>
                  Prepis
                </div>
                <div style={{ fontSize: "clamp(1.35rem, 1.9vw, 2.1rem)", lineHeight: 1.1, wordBreak: "break-word" }}>
                  {liveText ? (
                    <>
                      <span className="fw-semibold">{finalText}</span>
                      {interim ? <span className="text-muted"> {interim}</span> : null}
                    </>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-100 text-center" style={{ maxWidth: 760 }}>
                <div className="text-muted" style={{ fontSize: 16, marginBottom: 6 }}>
                  Upravte prepis
                </div>
                <input
                  className="form-control form-control-lg"
                  value={editableText}
                  onChange={(e) => setEditableText(e.target.value)}
                  disabled={saveBusy}
                  placeholder="Upravte rozpoznaný text"
                />
              </div>
            )}

            <div className="d-flex flex-wrap justify-content-center gap-2">
              <button
                type="button"
                className={btn("success")}
                disabled={!supported || listening || phase !== "nahravanie" || saveBusy}
                onClick={() => start()}
              >
                <i className="bi bi-mic-fill me-2" />
                Nahrávať
              </button>

              <button
                type="button"
                className={btn("outline-success")}
                disabled={!supported || !listening || phase !== "nahravanie" || saveBusy}
                onClick={() => {
                  stop();
                  setPhase("kontrola");
                }}
              >
                <i className="bi bi-stop-fill me-2" />
                Stop
              </button>

              <button
                type="button"
                className={btn("outline-secondary")}
                disabled={phase !== "nahravanie" || saveBusy}
                onClick={() => {
                  stop();
                  reset();
                }}
              >
                <i className="bi bi-x-circle me-2" />
                Vymazať
              </button>
            </div>

            {!supported && <div className="text-danger small text-center">Tento prehliadač nepodporuje rozpoznávanie reči.</div>}

            {phase === "kontrola" && (
              <div className="d-flex flex-wrap justify-content-center gap-2">
                <button
                  type="button"
                  className={btn("primary")}
                  disabled={saveBusy || !liveText}
                  onClick={() => void evaluateAndFinalize(activeQ, liveText)}
                >
                  <i className="bi bi-check-lg me-2" />
                  Prepis je správny
                </button>

                <button
                  type="button"
                  className={btn("outline-primary")}
                  disabled={saveBusy || !liveText}
                  onClick={() => {
                    setEditableText(liveText);
                    setPhase("uprava");
                  }}
                >
                  <i className="bi bi-pencil me-2" />
                  Prepis je nesprávny
                </button>

                <button
                  type="button"
                  className={btn("outline-secondary")}
                  disabled={saveBusy}
                  onClick={() => {
                    setPhase("nahravanie");
                    stop();
                    reset();
                  }}
                >
                  <i className="bi bi-arrow-repeat me-2" />
                  Znova nahrať
                </button>
              </div>
            )}

            {phase === "uprava" && (
              <div className="d-flex flex-wrap justify-content-center gap-2">
                <button
                  type="button"
                  className={btn("outline-secondary")}
                  disabled={saveBusy}
                  onClick={() => {
                    setPhase("nahravanie");
                    stop();
                    reset();
                    setEditableText("");
                  }}
                >
                  <i className="bi bi-arrow-repeat me-2" />
                  Znova nahrať
                </button>

                <button
                  type="button"
                  className={btn("primary")}
                  disabled={saveBusy || !editableText.trim()}
                  onClick={() => void evaluateAndFinalize(activeQ, editableText.trim())}
                >
                  <i className="bi bi-save2 me-2" />
                  {saveBusy ? "Ukladám…" : "Uložiť"}
                </button>
              </div>
            )}

            <div className="small text-muted">
              Otázka {Math.min(activeIndex + 1, remaining.length)}/{remaining.length} • Nesprávne pre ďalšiu fázu: {incorrect.length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
