// app/testing/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import SceneBuilder, { SceneConfig } from "@/components/private/SceneBuilder";

/**
 * NOTES
 * - Bootstrap must be loaded globally (layout.tsx or globals.css import).
 * - This file is intentionally structured so persistence can be swapped by changing ONE line:
 *     const store = useMemo(() => new SessionStorageStore(), []);
 *   ->  const store = useMemo(() => new ApiStore(axiosInstance, sessionId), []);
 *
 * - Speech recognition here uses the browser Web Speech API as a drop-in UI placeholder.
 *   Replace `useSpeechRecognition()` internals with Google STT when ready.
 */

/* ----------------------------- Persistence ----------------------------- */

type PersistedResult = {
  questionId: string;
  phase: 2 | 4;
  isCorrect: boolean;
  rawSpoken?: string;
  finalAnswer?: string;
  selectedImagePath?: string;
  timestamp: number;
};

interface AnswerStore {
  getAnsweredIds(): Promise<Set<string>>;
  markAnswered(questionId: string): Promise<void>;
  saveResult(result: PersistedResult): Promise<void>;
}

class SessionStorageStore implements AnswerStore {
  private answeredKey = "testing_answered_ids_v1";
  private resultsKey = "testing_results_v1";

  async getAnsweredIds(): Promise<Set<string>> {
    if (typeof window === "undefined") return new Set();
    const raw = sessionStorage.getItem(this.answeredKey);
    if (!raw) return new Set();
    try {
      const arr: unknown = JSON.parse(raw);
      if (!Array.isArray(arr)) return new Set();
      return new Set(arr.map(String));
    } catch {
      return new Set();
    }
  }

  private async setAnsweredIds(ids: Set<string>): Promise<void> {
    sessionStorage.setItem(this.answeredKey, JSON.stringify([...ids]));
  }

  async markAnswered(questionId: string): Promise<void> {
    const ids = await this.getAnsweredIds();
    ids.add(String(questionId));
    await this.setAnsweredIds(ids);
  }

  async saveResult(result: PersistedResult): Promise<void> {
    const raw = sessionStorage.getItem(this.resultsKey);
    const existing: PersistedResult[] = (() => {
      try {
        const v = raw ? JSON.parse(raw) : [];
        return Array.isArray(v) ? v : [];
      } catch {
        return [];
      }
    })();

    existing.push(result);
    sessionStorage.setItem(this.resultsKey, JSON.stringify(existing));
  }
}

/* ----------------------------- Config types ---------------------------- */

type TestingQuestion = {
  id: string; // stable unique id
  questionNo?: number;
  questionText: string;

  // Phase 2
  imagePath?: string;
  possibleAnswers?: string[];

  // Audio used in phases 2/4/5
  audioPath?: string;

  // Phase 4
  selectionImages?: string[]; // should be 6, but code handles >0
  correctImagePath?: string; // optional if you want correctness
};

type TestingConfig = {
  phase1?: { scene?: SceneConfig };
  phase2?: { questions: TestingQuestion[] };
  phase3?: { scene?: SceneConfig };
  phase5?: { scene?: SceneConfig };

  // optional, if you prefer phase4 options coming from config (otherwise queue-derived questions are used)
  phase4?: {
    questions?: Array<
      Pick<TestingQuestion, "id" | "questionText" | "audioPath" | "selectionImages" | "correctImagePath">
    >;
  };
};

/**
 * Very tolerant normalizer:
 * - Supports config.phase2.questions as canonical.
 * - Also supports the provided sample JSON shape (categories with arrays) by producing text-only questions.
 *   You will replace/extend this once the "exact JSON structure" is finalized.
 */
function normalizeConfig(input: any): TestingConfig {
  if (input?.phase2?.questions && Array.isArray(input.phase2.questions)) {
    return input as TestingConfig;
  }

  // Fallback: handle category -> array of { id, questionNo, question, answers[] } (sample JSON)
  if (input && typeof input === "object") {
    const categories = Object.keys(input);
    const all: TestingQuestion[] = [];
    for (const cat of categories) {
      const arr = input[cat];
      if (!Array.isArray(arr)) continue;
      for (const q of arr) {
        const id = String(q?.id ?? `${cat}-${q?.questionNo ?? cryptoRandomId()}`);
        const questionText = String(q?.question ?? "");
        const possibleAnswers = Array.isArray(q?.answers)
          ? q.answers.map((a: any) => String(a?.answer ?? "")).filter(Boolean)
          : undefined;

        all.push({
          id,
          questionNo: Number.isFinite(q?.questionNo) ? Number(q.questionNo) : undefined,
          questionText,
          possibleAnswers,
        });
      }
    }
    return {
      phase2: { questions: all },
    };
  }

  return { phase2: { questions: [] } };
}

function cryptoRandomId(): string {
  if (typeof window !== "undefined" && "crypto" in window && "randomUUID" in window.crypto)
    return window.crypto.randomUUID();
  return `id_${Math.random().toString(16).slice(2)}`;
}

/* ------------------------------ Utilities ------------------------------ */

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeText(s: string) {
  return (s ?? "").trim().toLocaleLowerCase();
}

function includesNormalized(list: string[] | undefined, value: string) {
  if (!list || list.length === 0) return false;
  const v = normalizeText(value);
  return list.some((x) => normalizeText(x) === v);
}

function shuffle<T>(arr: T[], seed: number): T[] {
  // Deterministic-ish shuffle (LCG) to avoid re-randomizing during re-renders.
  const a = [...arr];
  let x = seed >>> 0;
  const rand = () => {
    x = (1664525 * x + 1013904223) >>> 0;
    return x / 0xffffffff;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function seedFromString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ----------------------------- Audio control --------------------------- */

function AudioControls({ src }: { src?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<"idle" | "playing" | "paused" | "ended">("idle");

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onPlay = () => setState("playing");
    const onPause = () => setState((prev) => (prev === "ended" ? "ended" : "paused"));
    const onEnded = () => setState("ended");

    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);

    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
    };
  }, []);

  useEffect(() => {
    // reset button state when question changes
    setState("idle");
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
  }, [src]);

  if (!src) return null;

  const label = state === "playing" ? "Pause" : state === "ended" ? "Replay" : "Play";

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;

    if (state === "playing") {
      a.pause();
      return;
    }

    if (state === "ended") {
      a.currentTime = 0;
    }

    a.play().catch(() => {
      // ignore; user gesture policy
    });
  };

  return (
    <div className="d-flex gap-2 align-items-center">
      <button type="button" className="btn btn-outline-primary" onClick={toggle}>
        {label}
      </button>
      <audio ref={audioRef} src={src} preload="auto" />
    </div>
  );
}

/* --------------------------- Speech (placeholder) ---------------------- */

type SpeechState = {
  supported: boolean;
  listening: boolean;
  transcript: string;
  error?: string;
};

function useSpeechRecognition() {
  const recognitionRef = useRef<any>(null);
  const [st, setSt] = useState<SpeechState>({
    supported: false,
    listening: false,
    transcript: "",
  });

  useEffect(() => {
    const w = window as any;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSt((p) => ({ ...p, supported: false }));
      return;
    }

    setSt((p) => ({ ...p, supported: true }));

    const r = new SpeechRecognition();
    r.continuous = false;
    r.interimResults = true;
    r.lang = "sk-SK"; // adjust per user/session
    r.onresult = (event: any) => {
      const text = Array.from(event.results)
        .map((res: any) => res[0]?.transcript ?? "")
        .join(" ")
        .trim();
      setSt((p) => ({ ...p, transcript: text }));
    };
    r.onerror = (e: any) => setSt((p) => ({ ...p, error: String(e?.error ?? "speech_error"), listening: false }));
    r.onend = () => setSt((p) => ({ ...p, listening: false }));

    recognitionRef.current = r;
    return () => {
      try {
        r.stop();
      } catch {}
    };
  }, []);

  const start = () => {
    const r = recognitionRef.current;
    if (!r) return;
    setSt((p) => ({ ...p, transcript: "", error: undefined, listening: true }));
    try {
      r.start();
    } catch {
      setSt((p) => ({ ...p, listening: false }));
    }
  };

  const stop = () => {
    const r = recognitionRef.current;
    if (!r) return;
    try {
      r.stop();
    } catch {}
    setSt((p) => ({ ...p, listening: false }));
  };

  const reset = () => setSt((p) => ({ ...p, transcript: "", error: undefined, listening: false }));

  return { st, start, stop, reset };
}

/* ------------------------------ Main page ------------------------------ */

type FlowPhase = 1 | 2 | 3 | 4 | 5;

export default function TestingPage() {
  // Swap here later:
  const store = useMemo<AnswerStore>(() => new SessionStorageStore(), []);

  const [config, setConfig] = useState<TestingConfig | null>(null);
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());

  // Phase control
  const [phase, setPhase] = useState<FlowPhase>(1);

  // Phase 2 cursor
  const [p2Index, setP2Index] = useState(0);

  // Phase 4 queue built during Phase 2
  const [p4Queue, setP4Queue] = useState<TestingQuestion[]>([]);
  const [p4Index, setP4Index] = useState(0);

  // Load config + answered state
  useEffect(() => {
    (async () => {
      const ids = await store.getAnsweredIds();
      setAnsweredIds(ids);

      // config injection points (pick one):
      // 1) sessionStorage key "testing_config_v1"
      // 2) window.__TESTING_CONFIG__
      const raw =
        (typeof window !== "undefined" && sessionStorage.getItem("testing_config_v1")) ||
        ((window as any)?.__TESTING_CONFIG__ ? JSON.stringify((window as any).__TESTING_CONFIG__) : null);

      let parsed: any = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = null;
      }

      // If nothing provided, still mount with empty config.
      setConfig(normalizeConfig(parsed ?? {}));
    })();
  }, [store]);

  // Derived question list for phase 2, filtered by answered
  const p2Questions = useMemo(() => {
    const qs = config?.phase2?.questions ?? [];
    return qs.filter((q) => !answeredIds.has(String(q.id)));
  }, [config, answeredIds]);

  // If answeredIds changes, keep p2Index within bounds
  useEffect(() => {
    setP2Index((i) => clamp(i, 0, Math.max(0, p2Questions.length - 1)));
  }, [p2Questions.length]);

  // Global progress (dynamic total: phase2 remaining + phase2 already answered + phase4 queued)
  const baseTotal = useMemo(() => config?.phase2?.questions?.length ?? 0, [config]);
  const answeredCount = useMemo(() => answeredIds.size, [answeredIds]);
  const total = useMemo(() => baseTotal + p4Queue.length, [baseTotal, p4Queue.length]);
  const progressPct = useMemo(
    () => (total <= 0 ? 0 : Math.round((answeredCount / total) * 100)),
    [answeredCount, total],
  );

  // Prevent scrolling
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Phase transitions
  useEffect(() => {
    if (!config) return;

    if (phase === 1) return;

    if (phase === 2) {
      // if no more phase2 questions, branch:
      if (p2Questions.length === 0) {
        if (p4Queue.length > 0) setPhase(3);
        else setPhase(5);
      }
      return;
    }

    if (phase === 3) return;

    if (phase === 4) {
      if (p4Index >= p4Queue.length) setPhase(5);
      return;
    }

    if (phase === 5) return;
  }, [config, phase, p2Questions.length, p4Queue.length, p4Index]);

  const markAnsweredLocal = useCallback(
    async (questionId: string) => {
      await store.markAnswered(questionId);
      setAnsweredIds((prev) => {
        const next = new Set(prev);
        next.add(String(questionId));
        return next;
      });
    },
    [store],
  );

  const saveResult = useCallback(
    async (result: PersistedResult) => {
      await store.saveResult(result);
    },
    [store],
  );

  /* --------------------------- Phase 2 handlers --------------------------- */

  const currentP2 = p2Questions[p2Index];

  const speech = useSpeechRecognition();
  const [p2Mode, setP2Mode] = useState<"listen" | "confirm" | "edit">("listen");
  const [editedText, setEditedText] = useState("");

  useEffect(() => {
    // reset p2 UI when question changes or phase changes
    setP2Mode("listen");
    speech.reset();
    setEditedText("");
  }, [currentP2?.id, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const p2Advance = useCallback(() => {
    setP2Index((i) => {
      const next = i + 1;
      return next >= p2Questions.length ? i : next;
    });
  }, [p2Questions.length]);

  const p2HandleCorrect = useCallback(async () => {
    if (!currentP2) return;

    await saveResult({
      questionId: String(currentP2.id),
      phase: 2,
      isCorrect: true,
      rawSpoken: speech.st.transcript,
      finalAnswer: speech.st.transcript,
      timestamp: Date.now(),
    });

    await markAnsweredLocal(String(currentP2.id));
    p2Advance();
  }, [currentP2, markAnsweredLocal, p2Advance, saveResult, speech.st.transcript]);

  const p2HandleIncorrect = useCallback(() => {
    setP2Mode("edit");
    setEditedText(speech.st.transcript || "");
  }, [speech.st.transcript]);

  const p2SubmitEdit = useCallback(async () => {
    if (!currentP2) return;

    const finalAnswer = editedText.trim();
    const inList = includesNormalized(currentP2.possibleAnswers, finalAnswer);

    if (!inList && (currentP2.possibleAnswers?.length ?? 0) > 0) {
      // add to Phase 4 queue only when possibleAnswers exist AND edited word not found
      setP4Queue((prev) => {
        const exists = prev.some((x) => String(x.id) === String(currentP2.id));
        if (exists) return prev;
        return [...prev, currentP2];
      });
    }

    await saveResult({
      questionId: String(currentP2.id),
      phase: 2,
      isCorrect: false,
      rawSpoken: speech.st.transcript,
      finalAnswer,
      timestamp: Date.now(),
    });

    await markAnsweredLocal(String(currentP2.id));
    p2Advance();
  }, [currentP2, editedText, markAnsweredLocal, p2Advance, saveResult, speech.st.transcript]);

  /* --------------------------- Phase 4 handlers --------------------------- */

  const currentP4 = p4Queue[p4Index];

  const p4Images = useMemo(() => {
    const imgs = currentP4?.selectionImages?.filter(Boolean) ?? [];
    if (imgs.length === 0) return [];
    const seed = seedFromString(String(currentP4?.id ?? "")) + p4Index;
    return shuffle(imgs, seed).slice(0, 6);
  }, [currentP4?.id, currentP4?.selectionImages, p4Index]);

  const p4Select = useCallback(
    async (selectedPath: string) => {
      if (!currentP4) return;

      const correct = currentP4.correctImagePath ? String(currentP4.correctImagePath) === String(selectedPath) : false;

      await saveResult({
        questionId: String(currentP4.id),
        phase: 4,
        isCorrect: correct,
        selectedImagePath: selectedPath,
        timestamp: Date.now(),
      });

      // Phase 4: "Regardless of correct/incorrect: save result to database, move to next question."
      // We still mark answered to keep "never show again" invariant.
      await markAnsweredLocal(String(currentP4.id));

      setP4Index((i) => i + 1);
    },
    [currentP4, markAnsweredLocal, saveResult],
  );

  /* ------------------------------ Scene configs ------------------------------ */

  const phase1Scene = config?.phase1?.scene;
  const phase3Scene = config?.phase3?.scene;
  const phase5Scene = config?.phase5?.scene;

  /* --------------------------------- UI --------------------------------- */

  if (!config) {
    return (
      <div className="vh-100 vw-100 d-flex align-items-center justify-content-center">
        <div className="spinner-border" role="status" />
      </div>
    );
  }

  return (
    <div className="vh-100 vw-100 d-flex flex-column bg-light">
      {/* Top bar */}
      <div className="container-fluid py-2">
        <div className="d-flex align-items-center justify-content-between gap-3">
          <div className="flex-grow-1">
            <div className="progress" style={{ height: 18 }}>
              <div
                className="progress-bar"
                role="progressbar"
                style={{ width: `${progressPct}%` }}
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                {progressPct}%
              </div>
            </div>
          </div>
          <div className="text-nowrap fw-semibold">
            {answeredCount} / {total}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-grow-1 position-relative">
        {/* PHASE 1 */}
        {phase === 1 && (
          <SceneBuilder
            config={
              phase1Scene ??
              ({
                // minimal fallback scene
                picture_path: "/placeholder.png",
                sound_path: "",
              } as any)
            }
            continueOnEnd={true}
            next={
              <div className="vh-100 vw-100 d-flex align-items-center justify-content-center bg-white">
                <button type="button" className="btn btn-primary btn-lg" onClick={() => setPhase(2)}>
                  Start
                </button>
              </div>
            }
          />
        )}

        {/* PHASE 2 */}
        {phase === 2 && currentP2 && (
          <div className="h-100 w-100 d-flex align-items-center justify-content-center">
            <div className="container-fluid h-100">
              <div className="row h-100 align-items-center">
                <div className="col-12 col-lg-6 d-flex flex-column justify-content-center align-items-center gap-3">
                  <div className="w-100 text-center">
                    <h3 className="m-0">{currentP2.questionText}</h3>
                  </div>

                  <AudioControls src={currentP2.audioPath} />

                  <div
                    className="position-relative bg-white rounded shadow-sm"
                    style={{ width: "min(520px, 95vw)", height: "min(520px, 60vh)" }}
                  >
                    {currentP2.imagePath ? (
                      <Image
                        src={currentP2.imagePath}
                        alt="question image"
                        fill
                        sizes="(max-width: 992px) 95vw, 520px"
                        style={{ objectFit: "contain" }}
                        priority
                      />
                    ) : (
                      <div className="h-100 w-100 d-flex align-items-center justify-content-center text-muted">
                        No imagePath provided
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-12 col-lg-6 d-flex flex-column justify-content-center gap-3">
                  <div className="bg-white rounded shadow-sm p-3">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="fw-semibold">Speech</div>
                      <div className="small text-muted">
                        {speech.st.supported ? "Browser speech UI" : "Speech not supported"}
                      </div>
                    </div>

                    <hr />

                    {/* Mic toggle */}
                    <div className="d-flex flex-wrap gap-2 align-items-center">
                      <button
                        type="button"
                        className={`btn ${speech.st.listening ? "btn-danger" : "btn-outline-danger"}`}
                        onClick={speech.st.listening ? speech.stop : speech.start}
                        disabled={!speech.st.supported}
                      >
                        {speech.st.listening ? "Mic OFF" : "Mic ON"}
                      </button>

                      <div className="text-muted small">
                        {speech.st.error ? `Error: ${speech.st.error}` : speech.st.listening ? "Listening..." : ""}
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="form-label mb-1">Transcript</label>
                      <div className="border rounded p-2 bg-light" style={{ minHeight: 44 }}>
                        {speech.st.transcript || <span className="text-muted">...</span>}
                      </div>
                    </div>

                    {/* After speech => Correct/Incorrect */}
                    {speech.st.transcript && p2Mode !== "edit" && (
                      <div className="mt-3 d-flex flex-wrap gap-2">
                        <button type="button" className="btn btn-success" onClick={p2HandleCorrect}>
                          Correct
                        </button>
                        <button type="button" className="btn btn-outline-danger" onClick={p2HandleIncorrect}>
                          Incorrect
                        </button>
                      </div>
                    )}

                    {/* Edit flow */}
                    {p2Mode === "edit" && (
                      <div className="mt-3">
                        <label className="form-label">Edit answer</label>
                        <input
                          className="form-control form-control-lg"
                          value={editedText}
                          onChange={(e) => setEditedText(e.target.value)}
                          placeholder="Type the intended word"
                          autoFocus
                        />
                        <div className="mt-2 d-flex gap-2">
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={p2SubmitEdit}
                            disabled={!editedText.trim()}
                          >
                            Submit
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => setP2Mode("confirm")}
                          >
                            Cancel
                          </button>
                        </div>

                        {(currentP2.possibleAnswers?.length ?? 0) > 0 && (
                          <div className="mt-2 small text-muted">
                            Valid answers list present: if your edited word is not found, this question is queued to
                            Phase 4.
                          </div>
                        )}
                        {(currentP2.possibleAnswers?.length ?? 0) === 0 && (
                          <div className="mt-2 small text-muted">No possibleAnswers[] for this question.</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Manual skip (kept minimal; remove if not wanted) */}
                  <div className="text-end">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={async () => {
                        if (!currentP2) return;
                        await saveResult({
                          questionId: String(currentP2.id),
                          phase: 2,
                          isCorrect: false,
                          rawSpoken: "",
                          finalAnswer: "",
                          timestamp: Date.now(),
                        });
                        await markAnsweredLocal(String(currentP2.id));
                        p2Advance();
                      }}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PHASE 3 (only if Phase 4 queued questions exist) */}
        {phase === 3 && p4Queue.length > 0 && (
          <SceneBuilder
            config={
              phase3Scene ??
              ({
                picture_path: "/placeholder.png",
                sound_path: "",
              } as any)
            }
            continueOnEnd={true}
            next={
              <div className="vh-100 vw-100 d-flex align-items-center justify-content-center bg-white">
                <button type="button" className="btn btn-primary btn-lg" onClick={() => setPhase(4)}>
                  Continue
                </button>
              </div>
            }
          />
        )}

        {/* PHASE 4 */}
        {phase === 4 && currentP4 && (
          <div className="h-100 w-100 d-flex align-items-center justify-content-center">
            <div className="container-fluid h-100">
              <div className="row h-100 align-items-center">
                <div className="col-12">
                  <div className="d-flex flex-column gap-3">
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                      <h3 className="m-0">{currentP4.questionText}</h3>
                      <AudioControls src={currentP4.audioPath} />
                    </div>

                    <div className="row g-3">
                      {p4Images.map((src, idx) => (
                        <div className="col-6 col-md-4" key={`${src}-${idx}`}>
                          <div
                            className="card shadow-sm h-100"
                            role="button"
                            tabIndex={0}
                            onClick={() => p4Select(src)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") p4Select(src);
                            }}
                            style={{ cursor: "pointer" }}
                          >
                            <div
                              className="position-relative"
                              style={{ width: "100%", height: "22vh", minHeight: 140 }}
                            >
                              <Image
                                src={src}
                                alt="selection option"
                                fill
                                sizes="(max-width: 768px) 50vw, 33vw"
                                style={{ objectFit: "contain" }}
                              />
                            </div>
                            <div className="card-body py-2">
                              <div className="small text-muted">Option {idx + 1}</div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {p4Images.length === 0 && (
                        <div className="col-12">
                          <div className="alert alert-warning m-0">
                            No selectionImages[] provided for this Phase 4 question.
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="text-muted small">
                      Phase 4 always advances after selection. Result is saved regardless of correctness.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PHASE 5 (always at end) */}
        {phase === 5 && (
          <SceneBuilder
            config={
              phase5Scene ??
              ({
                picture_path: "/placeholder.png",
                sound_path: "",
              } as any)
            }
            continueOnEnd={true}
            next={
              <div className="vh-100 vw-100 d-flex align-items-center justify-content-center bg-white">
                <div className="text-center">
                  <h2 className="mb-3">Finished</h2>
                  <div className="text-muted">
                    Answered: {answeredCount} / {total}
                  </div>
                </div>
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
