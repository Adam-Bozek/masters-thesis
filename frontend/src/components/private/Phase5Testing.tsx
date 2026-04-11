/**
 * @ Author: Bc. Adam Božek
 * @ Create Time: 2026-02-09 23:33:17
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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import axiosInstance from "@/utilities/AxiosInstance";
import withAuth from "@/utilities/WithAuth";
import { phase5RuntimeConfig as sharedPhase5RuntimeConfig } from "./componentRuntimeConfigs";

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

type StorageType = "local_storage" | "database";
type DisplayType = "insert" | "add" | "remove" | "remove_last_and_add" | "remove_all_and_add";

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

type QuestionType1 = BaseQuestion & {
  questionType: 1;
  answers: Answer[];
};

type QuestionType2 = BaseQuestion & {
  questionType: 2;
  questionText2: string;
  questionAudioPath2: string;
  answers: Answer[];
};

type QuestionType3 = BaseQuestion & {
  questionType: 3;
  config: SceneConfigTimeline | SceneConfigSingle;
};

type QuestionType4 = BaseQuestion & {
  questionType: 4;
  imagePath: string;
};

type Question = QuestionType1 | QuestionType2 | QuestionType3 | QuestionType4;

type SavePayload = {
  category_id: number;
  question_number: number;
  answer_state: string;
  user_answer?: string | null;
};

type Phase5RuntimeConfig = {
  imageFadeDurationMs: number;
  compactGridMaxAnswers: number;
  answerGridGapClass: string;
  answerCardBorderRadiusPx: number;
  answerImageMinHeight: string;
};

type Props = {
  wrongQuestions: Question[];
  categoryId: number;
  storageType: StorageType;
  sessionId?: number;
  guestToken?: string;
  answersPath?: (sessionId: number) => string;
  debug?: boolean;
  config?: Partial<Phase5RuntimeConfig>;
  onComplete?: () => void;
};

/* -------------------------------------------------------------------------------------------------
 * Config
 * -----------------------------------------------------------------------------------------------*/

const DEFAULT_ANSWERS_PATH = (sessionId: number) => `/sessions/${sessionId}/answers`;

const DEFAULT_PHASE5_CONFIG: Phase5RuntimeConfig = sharedPhase5RuntimeConfig;

const PHASE5_LOCAL_STORAGE_KEYS = {
  answered: "answered",
  results: "results",
} as const;

/* -------------------------------------------------------------------------------------------------
 * Helpers
 * -----------------------------------------------------------------------------------------------*/

function getCryptoRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;

  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    return Math.floor(Math.random() * maxExclusive);
  }

  const maxUint32 = 0xffffffff;
  const acceptedRange = Math.floor(maxUint32 / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);

  while (true) {
    cryptoApi.getRandomValues(buffer);
    const candidate = buffer[0] >>> 0;
    if (candidate < acceptedRange) {
      return candidate % maxExclusive;
    }
  }
}

function shuffleArray<T>(items: T[]): T[] {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = getCryptoRandomInt(index + 1);
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }

  return next;
}

function dedupeQuestionsById(questions: Question[]): Question[] {
  const seenIds = new Set<number>();
  const uniqueQuestions: Question[] = [];

  for (const question of questions ?? []) {
    if (!question || typeof question.questionId !== "number") continue;
    if (seenIds.has(question.questionId)) continue;

    seenIds.add(question.questionId);
    uniqueQuestions.push(question);
  }

  return uniqueQuestions;
}

function buildStorageScopeKey(categoryId: number): string {
  return `phase5:${categoryId}`;
}

function buildStorageKey(scopeKey: string, key: (typeof PHASE5_LOCAL_STORAGE_KEYS)[keyof typeof PHASE5_LOCAL_STORAGE_KEYS]): string {
  return `${scopeKey}:${key}`;
}

function getPromptText(question: Question): string {
  return question.questionType === 2 ? question.questionText2 : question.questionText;
}

function getAudioSource(question: Question): string {
  if (question.questionType === 2) {
    return question.questionAudioPath2;
  }

  if (question.questionType === 3) {
    return question.config.sound_path || question.questionAudioPath;
  }

  return question.questionAudioPath;
}

function readAnsweredIdsFromLocalStorage(scopeKey: string): Set<number> {
  const raw = localStorage.getItem(buildStorageKey(scopeKey, PHASE5_LOCAL_STORAGE_KEYS.answered));
  return raw ? new Set<number>(JSON.parse(raw)) : new Set<number>();
}

function persistAnsweredIdsToLocalStorage(scopeKey: string, answeredIds: Set<number>): void {
  localStorage.setItem(buildStorageKey(scopeKey, PHASE5_LOCAL_STORAGE_KEYS.answered), JSON.stringify(Array.from(answeredIds)));
}

function persistResultToLocalStorage(scopeKey: string, payload: SavePayload): void {
  const resultsKey = buildStorageKey(scopeKey, PHASE5_LOCAL_STORAGE_KEYS.results);
  const previous = localStorage.getItem(resultsKey);
  const storedResults = previous ? JSON.parse(previous) : {};

  storedResults[String(payload.question_number)] = {
    ...payload,
    saved_at: new Date().toISOString(),
  };

  localStorage.setItem(resultsKey, JSON.stringify(storedResults));
}

function padAnswersToFullRows(answers: Answer[], columns: number): Array<Answer | null> {
  const remainder = answers.length % columns;
  const placeholdersNeeded = remainder === 0 ? 0 : columns - remainder;
  return [...answers, ...Array(placeholdersNeeded).fill(null)] as Array<Answer | null>;
}

/* -------------------------------------------------------------------------------------------------
 * Presentational components
 * -----------------------------------------------------------------------------------------------*/

function LoadingImageFill({
  src,
  alt,
  sizes,
  fadeDurationMs,
  style,
  priority,
}: {
  src: string;
  alt: string;
  sizes: string;
  fadeDurationMs: number;
  style?: React.CSSProperties;
  priority?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [src]);

  return (
    <>
      {!loaded && (
        <div className="position-absolute top-50 start-50 translate-middle">
          <div className="spinner-border" role="status" aria-label="Loading">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        onLoadingComplete={() => setLoaded(true)}
        style={{
          ...(style ?? {}),
          opacity: loaded ? 1 : 0,
          transition: `opacity ${fadeDurationMs}ms ease`,
        }}
      />
    </>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Component
 * -----------------------------------------------------------------------------------------------*/

function Phase5Testing({ wrongQuestions, categoryId, storageType, sessionId, guestToken, answersPath, debug = false, config, onComplete }: Props) {
  const runtimeConfig = useMemo(
    () => ({
      ...DEFAULT_PHASE5_CONFIG,
      ...(config ?? {}),
    }),
    [config],
  );

  const useLocalStorage = storageType === "local_storage";
  const useDatabase = storageType === "database";
  const guestHeaders = useMemo(() => (guestToken ? ({ "X-Guest-Token": guestToken, Authorization: " " } as const) : undefined), [guestToken]);
  const localScopeKey = useMemo(() => buildStorageScopeKey(categoryId), [categoryId]);

  const getGuestRequestHeaders = useCallback((): Record<string, string> | undefined => {
    if (!sessionId) return undefined;

    if (guestToken && guestToken.trim()) {
      return {
        "X-Guest-Token": guestToken.trim(),
        Authorization: " ",
      };
    }

    if (typeof window === "undefined") return undefined;

    const storedGuestSessionId = localStorage.getItem("guestSessionId");
    const storedGuestToken = localStorage.getItem("guestSessionToken");

    if (storedGuestSessionId === String(sessionId) && storedGuestToken) {
      return {
        "X-Guest-Token": storedGuestToken,
        Authorization: " ",
      };
    }

    return undefined;
  }, [guestToken, sessionId]);

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionOrder, setQuestionOrder] = useState<number[]>([]);
  const [answeredIds, setAnsweredIds] = useState<Set<number>>(new Set());
  const [activeIndex, setActiveIndex] = useState(0);
  const [saveBusy, setSaveBusy] = useState(false);
  const [shuffledAnswersByQuestionId, setShuffledAnswersByQuestionId] = useState<Record<number, Answer[]>>({});
  const [audioPlaying, setAudioPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const orderedQuestions = useMemo(() => {
    const questionById = new Map(questions.map((question) => [question.questionId, question]));
    return questionOrder.map((questionId) => questionById.get(questionId)).filter(Boolean) as Question[];
  }, [questionOrder, questions]);

  const remainingQuestions = useMemo(
    () => orderedQuestions.filter((question) => !answeredIds.has(question.questionId)),
    [answeredIds, orderedQuestions],
  );

  const activeQuestion = remainingQuestions[activeIndex] ?? null;
  const totalQuestions = questions.length;
  const answeredCount = answeredIds.size;
  const progressPercent = totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const canNavigate = !saveBusy;

  const togglePlayPause = useCallback(async () => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    if (audioElement.paused) {
      try {
        await audioElement.play();
      } catch (caughtError) {
        if (debug) {
          console.debug("[Phase5] Audio playback was blocked until a user gesture", caughtError);
        }
      }
      return;
    }

    audioElement.pause();
  }, [debug]);

  const replayAudio = useCallback(async () => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    audioElement.pause();
    audioElement.currentTime = 0;
    setAudioPlaying(false);

    try {
      await audioElement.play();
    } catch (caughtError) {
      if (debug) {
        console.debug("[Phase5] Audio playback was blocked until a user gesture", caughtError);
      }
    }
  }, [debug]);

  const saveResultToDatabase = useCallback(
    async (payload: SavePayload) => {
      if (!sessionId) {
        throw new Error("Chýba sessionId");
      }

      const saveUrl = (answersPath ?? DEFAULT_ANSWERS_PATH)(sessionId);
      await axiosInstance.post(saveUrl, payload, {
        headers: getGuestRequestHeaders(),
      });
    },
    [answersPath, getGuestRequestHeaders, sessionId],
  );

  const finalizeAnswer = useCallback(
    async (question: QuestionType1 | QuestionType2, selectedAnswer: Answer) => {
      if (saveBusy) return;

      const isCorrect = Boolean(selectedAnswer.isCorrect);
      const payload: SavePayload = {
        category_id: categoryId,
        question_number: question.questionId,
        answer_state: isCorrect ? "2" : "3",
        user_answer: (question as Question & { phase3_user_answer?: string }).phase3_user_answer ?? null,
      };

      setSaveBusy(true);

      try {
        if (useLocalStorage) {
          persistResultToLocalStorage(localScopeKey, payload);
        } else if (useDatabase) {
          await saveResultToDatabase(payload);
        }

        const nextAnsweredIds = new Set(answeredIds);
        nextAnsweredIds.add(question.questionId);

        setAnsweredIds(nextAnsweredIds);
        if (useLocalStorage) {
          persistAnsweredIdsToLocalStorage(localScopeKey, nextAnsweredIds);
        }

        const remainingAfterCurrent = remainingQuestions.length - 1;
        if (remainingAfterCurrent <= 0) {
          onComplete?.();
        } else {
          setActiveIndex((currentIndex) => Math.min(currentIndex, remainingAfterCurrent - 1));
        }
      } catch (caughtError) {
        console.error("[Phase5] Saving the answer failed", caughtError);
      } finally {
        setSaveBusy(false);
      }
    },
    [answeredIds, categoryId, localScopeKey, onComplete, remainingQuestions.length, saveBusy, saveResultToDatabase, useDatabase, useLocalStorage],
  );

  useEffect(() => {
    setLoading(true);

    try {
      const uniqueQuestions = dedupeQuestionsById(wrongQuestions);
      const randomizedQuestionOrder = shuffleArray(uniqueQuestions.map((question) => question.questionId));
      const answersByQuestionId: Record<number, Answer[]> = {};

      for (const question of uniqueQuestions) {
        if (question.questionType === 1 || question.questionType === 2) {
          answersByQuestionId[question.questionId] = shuffleArray(question.answers ?? []);
        }
      }

      setQuestions(uniqueQuestions);
      setQuestionOrder(randomizedQuestionOrder);
      setShuffledAnswersByQuestionId(answersByQuestionId);

      if (useLocalStorage) {
        setAnsweredIds(readAnsweredIdsFromLocalStorage(localScopeKey));
      } else {
        setAnsweredIds(new Set());
      }

      setActiveIndex(0);
    } catch (caughtError) {
      console.error("[Phase5] Loading input questions failed", caughtError);
      setQuestions([]);
      setQuestionOrder([]);
      setShuffledAnswersByQuestionId({});
      setAnsweredIds(new Set());
      setActiveIndex(0);
    } finally {
      setLoading(false);
    }
  }, [localScopeKey, useLocalStorage, wrongQuestions]);

  useEffect(() => {
    if (!useDatabase || !sessionId || !questions.length) {
      return;
    }

    const hydrateFromDatabase = async () => {
      const readUrl = (answersPath ?? DEFAULT_ANSWERS_PATH)(sessionId);
      const response = await axiosInstance.get(readUrl, {
        headers: getGuestRequestHeaders(),
      });
      const rawData = response?.data;
      const rows = Array.isArray(rawData) ? rawData : Array.isArray(rawData?.answers) ? rawData.answers : [];
      const relevantQuestionIds = new Set(questions.map((question) => question.questionId));
      const nextAnsweredIds = new Set<number>();

      for (const row of rows) {
        if (Number(row?.category_id) !== Number(categoryId)) continue;

        const questionNumber = Number(row?.question_number);
        if (!Number.isFinite(questionNumber)) continue;
        if (!relevantQuestionIds.has(questionNumber)) continue;

        nextAnsweredIds.add(questionNumber);
      }

      setAnsweredIds(nextAnsweredIds);
      setActiveIndex(0);
    };

    hydrateFromDatabase().catch((caughtError) => {
      console.error("[Phase5] Database hydration failed", caughtError);
    });
  }, [answersPath, categoryId, getGuestRequestHeaders, questions, sessionId, useDatabase]);

  useEffect(() => {
    if (activeIndex < remainingQuestions.length) return;
    setActiveIndex(Math.max(0, remainingQuestions.length - 1));
  }, [activeIndex, remainingQuestions.length]);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const handlePlay = () => setAudioPlaying(true);
    const handlePause = () => setAudioPlaying(false);
    const handleEnded = () => setAudioPlaying(false);

    audioElement.addEventListener("play", handlePlay);
    audioElement.addEventListener("pause", handlePause);
    audioElement.addEventListener("ended", handleEnded);

    return () => {
      audioElement.removeEventListener("play", handlePlay);
      audioElement.removeEventListener("pause", handlePause);
      audioElement.removeEventListener("ended", handleEnded);
    };
  }, [activeQuestion?.questionId]);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    audioElement.pause();
    audioElement.currentTime = 0;
    setAudioPlaying(false);
  }, [activeQuestion?.questionId]);

  const goToPreviousQuestion = () => {
    if (!canNavigate) return;
    setActiveIndex((currentIndex) => Math.max(0, currentIndex - 1));
  };

  const goToNextQuestion = () => {
    if (!canNavigate) return;
    setActiveIndex((currentIndex) => Math.min(remainingQuestions.length - 1, currentIndex + 1));
  };

  const buttonClassName = (variant: "primary" | "outline-primary" | "outline-secondary") => `btn btn-${variant} rounded-pill px-3`;

  if (useDatabase && !sessionId) {
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

  if (!totalQuestions) {
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

  if (!activeQuestion) {
    return (
      <div className="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-white p-3 text-center">
        <div className="fw-semibold" style={{ fontSize: "1.25rem" }}>
          Dokončené
        </div>
        <div className="text-muted small">
          Zodpovedané: {answeredCount}/{totalQuestions}
        </div>
      </div>
    );
  }

  if (!(activeQuestion.questionType === 1 || activeQuestion.questionType === 2)) {
    return (
      <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-white p-3 text-center">
        <div>
          <div className="fw-semibold" style={{ fontSize: "1.25rem" }}>
            Nepodporovaný typ otázky vo fáze 5
          </div>
          <div className="text-muted small">questionType: {activeQuestion.questionType}</div>
        </div>
      </div>
    );
  }

  const promptText = getPromptText(activeQuestion);
  const audioSource = getAudioSource(activeQuestion);
  const answersForUi = shuffledAnswersByQuestionId[activeQuestion.questionId] ?? activeQuestion.answers;
  const columns = answersForUi.length <= runtimeConfig.compactGridMaxAnswers ? 2 : 3;
  const paddedAnswers = padAnswersToFullRows(answersForUi, columns);
  const answerGridClassName =
    columns === 2 ? `row row-cols-2 ${runtimeConfig.answerGridGapClass}` : `row row-cols-2 row-cols-sm-3 ${runtimeConfig.answerGridGapClass}`;
  const answerCardPadding = "clamp(6px, 1.1vw, 10px)";

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 bg-white" style={{ overflow: "hidden" }}>
      <div className="w-100 px-2" style={{ paddingTop: 6 }}>
        <div className="d-flex align-items-center gap-2">
          <div className="progress flex-grow-1" style={{ height: 8, borderRadius: 999 }}>
            <div
              className="progress-bar"
              role="progressbar"
              style={{ width: `${progressPercent}%` }}
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <div className="small text-muted" style={{ minWidth: 72, textAlign: "right" }}>
            {answeredCount}/{totalQuestions}
          </div>
        </div>
      </div>

      <audio ref={audioRef} src={audioSource} preload="auto" style={{ display: "none" }} />

      <div
        className="w-100 h-100"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 34px)",
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
                <button type="button" className={buttonClassName("outline-primary")} onClick={() => void togglePlayPause()} disabled={saveBusy}>
                  <i className={`bi ${audioPlaying ? "bi-pause-fill" : "bi-play-fill"} me-2`} />
                  {audioPlaying ? "Pauza" : "Prehrať"}
                </button>

                <button type="button" className={buttonClassName("outline-secondary")} onClick={() => void replayAudio()} disabled={saveBusy}>
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
            onClick={goToPreviousQuestion}
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
            onClick={goToNextQuestion}
            disabled={!canNavigate || activeIndex >= remainingQuestions.length - 1}
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
              opacity: activeIndex >= remainingQuestions.length - 1 || !canNavigate ? 0.35 : 0.9,
              zIndex: 20,
            }}
          >
            <i className="bi bi-chevron-right" style={{ fontSize: 24 }} />
          </button>

          <div className="w-100 h-100 d-flex align-items-center justify-content-center" style={{ maxWidth: 1440, margin: "0 auto" }}>
            <div className="container-fluid" style={{ maxWidth: 1280 }}>
              <div className={answerGridClassName}>
                {paddedAnswers.map((answer, index) => {
                  if (!answer) {
                    return (
                      <div className="col" key={`placeholder-${index}`} style={{ visibility: "hidden" }}>
                        <div
                          style={{
                            borderRadius: runtimeConfig.answerCardBorderRadiusPx,
                            padding: 10,
                            border: "1px solid rgba(0,0,0,0.12)",
                          }}
                        >
                          <div style={{ position: "relative", width: "100%", height: runtimeConfig.answerImageMinHeight }} />
                          <div className="mt-2" style={{ height: 22 }} />
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="col" key={answer.answerId}>
                      <button
                        type="button"
                        disabled={saveBusy}
                        onClick={() => void finalizeAnswer(activeQuestion, answer)}
                        className="w-100 text-start"
                        style={{
                          border: "1px solid rgba(0,0,0,0.12)",
                          background: "white",
                          borderRadius: runtimeConfig.answerCardBorderRadiusPx,
                          padding: answerCardPadding,
                        }}
                      >
                        <div
                          style={{
                            position: "relative",
                            width: "100%",
                            height: runtimeConfig.answerImageMinHeight,
                            borderRadius: 10,
                            overflow: "hidden",
                          }}
                        >
                          <LoadingImageFill
                            src={answer.imagePath}
                            alt={answer.label ?? ""}
                            sizes="(max-width: 768px) 45vw, (max-width: 1200px) 28vw, 22vw"
                            fadeDurationMs={runtimeConfig.imageFadeDurationMs}
                            style={{ objectFit: "contain" }}
                          />
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Phase5Testing };

export default withAuth(Phase5Testing);
