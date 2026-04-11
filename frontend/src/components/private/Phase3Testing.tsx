/**
 * @ Author: Bc. Adam Božek
 * @ Create Time: 2026-02-09 18:44:02
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
import { phase3RuntimeConfig as sharedPhase3RuntimeConfig } from "./componentRuntimeConfigs";

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

type StorageType = "local_storage" | "database";
type Phase3UiMode = "recording" | "review" | "editing" | "typing";
type DisplayType = "insert" | "add" | "remove" | "remove_last_and_add" | "remove_all_and_add";

type Answer = {
  answerId: number;
  isCorrect: boolean;
  label: string;
  imagePath: string;
};

type SceneTimelineItem = {
  path: string;
  display_time: string | number;
  display_type: DisplayType;
};

type SceneConfigTimeline = {
  sound_path: string;
  pictures: SceneTimelineItem[];
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

type PersistedQuestion = Question & {
  phase3_user_answer?: string;
};

type SpeechRecognitionAlternativeLike = {
  transcript?: string;
};

type SpeechRecognitionResultLike = {
  isFinal?: boolean;
  0?: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorLike = {
  error?: string;
  message?: string;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type Phase3RuntimeConfig = {
  speechLanguage: string;
  speechSilenceTimeoutMs: number;
  swipeThresholdPx: number;
  sceneTimeEpsilonSeconds: number;
  imageFadeDurationMs: number;
  questionType1Prompt: string;
  questionType1AudioPath: string;
  sceneEmptyStateText: string;
};

type Props = {
  questionnaireConfigPath: string;
  categoryId: number;
  storageType: StorageType;
  sessionId?: number;
  guestToken?: string;
  answersPath?: (sessionId: number) => string;
  debug?: boolean;
  config?: Partial<Phase3RuntimeConfig>;
  onComplete?: (incorrectQuestions: Question[]) => void;
};

/* -------------------------------------------------------------------------------------------------
 * Config
 * -----------------------------------------------------------------------------------------------*/

const DEFAULT_ANSWERS_PATH = (sessionId: number) => `/sessions/${sessionId}/answers`;

const DEFAULT_PHASE3_CONFIG: Phase3RuntimeConfig = sharedPhase3RuntimeConfig;

const PHASE3_LOCAL_STORAGE_KEYS = {
  answered: "answered",
  incorrect: "incorrect",
  answersPayload: "answers_payload",
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

function parseTimeToSeconds(value: string | number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }

  const input = String(value).trim();
  if (!input) return 0;

  if (/^\d+$/.test(input)) {
    return Math.max(0, Number(input));
  }

  const parts = input.split(":").map((part) => part.trim());
  if (parts.some((part) => !part || !/^\d+$/.test(part))) {
    return 0;
  }

  const numbers = parts.map(Number);
  if (numbers.length === 2) {
    return numbers[0] * 60 + numbers[1];
  }

  if (numbers.length === 3) {
    return numbers[0] * 3600 + numbers[1] * 60 + numbers[2];
  }

  return 0;
}

function normalizeTranscript(input: string): string {
  const lower = (input ?? "").trim().toLowerCase();
  const withoutPunctuation = lower.replace(/[^\p{L}\p{N}\s-]+/gu, " ");
  const collapsedWhitespace = withoutPunctuation.replace(/\s+/g, " ").trim();

  return collapsedWhitespace.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function buildStorageScopeKey(categoryId: number, questionnaireConfigPath: string): string {
  return `phase3:${categoryId}:${questionnaireConfigPath}`;
}

function buildStorageKey(scopeKey: string, key: (typeof PHASE3_LOCAL_STORAGE_KEYS)[keyof typeof PHASE3_LOCAL_STORAGE_KEYS]): string {
  return `${scopeKey}:${key}`;
}

function isTimelineSceneConfig(config: SceneConfigTimeline | SceneConfigSingle): config is SceneConfigTimeline {
  return Array.isArray((config as SceneConfigTimeline).pictures);
}

function getQuestionPrompt(question: Question, runtimeConfig: Phase3RuntimeConfig): string {
  if (question.questionType === 1) {
    return runtimeConfig.questionType1Prompt;
  }

  return question.questionText;
}

function getQuestionAudioSource(question: Question, runtimeConfig: Phase3RuntimeConfig): string {
  if (question.questionType === 1) {
    return runtimeConfig.questionType1AudioPath;
  }

  if (question.questionType === 3) {
    return question.config.sound_path || question.questionAudioPath;
  }

  return question.questionAudioPath;
}

function getQuestionStimulusImage(question: Question): string | null {
  if (question.questionType === 1 || question.questionType === 2) {
    const correctAnswer = question.answers.find((answer) => answer.isCorrect);
    return correctAnswer?.imagePath ?? null;
  }

  if (question.questionType === 4) {
    return question.imagePath;
  }

  return null;
}

function applySceneDisplayEvent(currentImages: string[], imagePath: string, displayType: DisplayType): string[] {
  switch (displayType) {
    case "insert":
      return [imagePath];
    case "add":
      return currentImages.includes(imagePath) ? currentImages : [...currentImages, imagePath];
    case "remove":
      return currentImages.filter((currentPath) => currentPath !== imagePath);
    case "remove_last_and_add": {
      const next = currentImages.slice(0, Math.max(0, currentImages.length - 1));
      next.push(imagePath);
      return next;
    }
    case "remove_all_and_add":
      return [imagePath];
    default:
      return currentImages;
  }
}

function getSceneImagesAtTime(config: SceneConfigTimeline | SceneConfigSingle, currentTimeSeconds: number, timeEpsilonSeconds: number): string[] {
  if (!isTimelineSceneConfig(config)) {
    return [config.picture_path];
  }

  const timeline = [...config.pictures]
    .map((item) => ({
      imagePath: item.path,
      displayType: item.display_type,
      timeSeconds: parseTimeToSeconds(item.display_time),
    }))
    .sort((left, right) => left.timeSeconds - right.timeSeconds);

  let activeImages: string[] = [];

  for (const event of timeline) {
    if (event.timeSeconds > currentTimeSeconds + timeEpsilonSeconds) {
      break;
    }

    activeImages = applySceneDisplayEvent(activeImages, event.imagePath, event.displayType);
  }

  return activeImages;
}

function readPhase3LocalState(scopeKey: string): { answeredIds: Set<number>; incorrectIds: number[] } {
  const answeredRaw = localStorage.getItem(buildStorageKey(scopeKey, PHASE3_LOCAL_STORAGE_KEYS.answered));
  const incorrectRaw = localStorage.getItem(buildStorageKey(scopeKey, PHASE3_LOCAL_STORAGE_KEYS.incorrect));

  return {
    answeredIds: answeredRaw ? new Set<number>(JSON.parse(answeredRaw)) : new Set<number>(),
    incorrectIds: incorrectRaw ? (JSON.parse(incorrectRaw) as number[]) : [],
  };
}

function persistPhase3LocalUiState(scopeKey: string, answeredIds: Set<number>, incorrectQuestions: Question[]): void {
  localStorage.setItem(buildStorageKey(scopeKey, PHASE3_LOCAL_STORAGE_KEYS.answered), JSON.stringify(Array.from(answeredIds)));
  localStorage.setItem(
    buildStorageKey(scopeKey, PHASE3_LOCAL_STORAGE_KEYS.incorrect),
    JSON.stringify(incorrectQuestions.map((question) => question.questionId)),
  );
}

function persistPhase3LocalAnswer(scopeKey: string, payload: SavePayload): void {
  const answersKey = buildStorageKey(scopeKey, PHASE3_LOCAL_STORAGE_KEYS.answersPayload);
  const previous = localStorage.getItem(answersKey);
  const storedAnswers = previous ? JSON.parse(previous) : {};

  storedAnswers[String(payload.question_number)] = {
    ...payload,
    saved_at: new Date().toISOString(),
  };

  localStorage.setItem(answersKey, JSON.stringify(storedAnswers));
}

/* -------------------------------------------------------------------------------------------------
 * Hooks
 * -----------------------------------------------------------------------------------------------*/

function useBrowserSpeechRecognition(language: string) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [finalText, setFinalText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    const browserWindow = window as Window & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    };

    const SpeechRecognitionApi = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!SpeechRecognitionApi) {
      setSupported(false);
      recognitionRef.current = null;
      return;
    }

    const recognition = new SpeechRecognitionApi();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event) => {
      let nextInterimText = "";
      let nextFinalText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript ?? "";

        if (result?.isFinal) {
          nextFinalText += `${transcript} `;
        } else {
          nextInterimText += `${transcript} `;
        }
      }

      if (nextInterimText) {
        setInterimText(nextInterimText.trim());
      }

      if (nextFinalText) {
        setFinalText((previous) => `${previous ? `${previous} ` : ""}${nextFinalText.trim()}`);
        setInterimText("");
      }
    };

    recognition.onerror = (event) => {
      const nextError = String(event?.error ?? event?.message ?? "").trim() || "speech_recognition_error";
      console.error("[Phase3] Speech recognition failed", event);
      setError(nextError);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    setSupported(true);

    return () => {
      try {
        recognition.stop();
      } catch {
        // Nothing to clean up if the recognition instance already stopped.
      }
    };
  }, [language]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;

    setFinalText("");
    setInterimText("");
    setError(null);
    setListening(true);

    try {
      recognitionRef.current.start();
    } catch (caughtError) {
      const nextError = String((caughtError as Error)?.message ?? "").trim() || "speech_recognition_start_failed";
      setError(nextError);
      setListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;

    try {
      recognitionRef.current.stop();
    } catch {
      // The browser may throw if stop() is called after recognition already ended.
    }

    setListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setFinalText("");
    setInterimText("");
  }, []);

  return {
    error,
    finalText,
    interimText,
    listening,
    resetTranscript,
    startListening,
    stopListening,
    supported,
  };
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

function ScenePreview({
  audioTimeSeconds,
  config,
  runtimeConfig,
}: {
  audioTimeSeconds: number;
  config: SceneConfigTimeline | SceneConfigSingle;
  runtimeConfig: Phase3RuntimeConfig;
}) {
  const activeImages = useMemo(
    () => getSceneImagesAtTime(config, audioTimeSeconds, runtimeConfig.sceneTimeEpsilonSeconds),
    [audioTimeSeconds, config, runtimeConfig.sceneTimeEpsilonSeconds],
  );

  if (activeImages.length <= 1) {
    return (
      <div className="w-100 h-100" style={{ position: "relative" }}>
        {activeImages[0] ? (
          <LoadingImageFill
            src={activeImages[0]}
            alt=""
            sizes="100vw"
            fadeDurationMs={runtimeConfig.imageFadeDurationMs}
            style={{ objectFit: "contain" }}
            priority
          />
        ) : (
          <div className="w-100 h-100 d-flex align-items-center justify-content-center text-muted">{runtimeConfig.sceneEmptyStateText}</div>
        )}
      </div>
    );
  }

  const isTwoItemLayout = activeImages.length === 2;

  return (
    <div className="w-100 h-100 d-flex flex-wrap align-items-center justify-content-center" style={{ gap: 10, padding: 10 }}>
      {activeImages.map((imagePath, index) => (
        <div
          key={`${imagePath}-${index}`}
          style={{
            position: "relative",
            flex: isTwoItemLayout ? "0 0 48%" : "0 0 32%",
            height: isTwoItemLayout ? "92%" : "48%",
            minHeight: 140,
          }}
        >
          <LoadingImageFill
            src={imagePath}
            alt=""
            sizes={isTwoItemLayout ? "48vw" : "32vw"}
            fadeDurationMs={runtimeConfig.imageFadeDurationMs}
            style={{ objectFit: "contain" }}
          />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Component
 * -----------------------------------------------------------------------------------------------*/

function Phase3Testing({
  questionnaireConfigPath,
  categoryId,
  storageType,
  sessionId,
  guestToken,
  answersPath,
  debug = false,
  config,
  onComplete,
}: Props) {
  const runtimeConfig = useMemo(
    () => ({
      ...DEFAULT_PHASE3_CONFIG,
      ...(config ?? {}),
    }),
    [config],
  );

  const useLocalStorage = storageType === "local_storage";
  const useDatabase = storageType === "database";
  const guestHeaders = useMemo(() => (guestToken ? ({ "X-Guest-Token": guestToken, Authorization: " " } as const) : undefined), [guestToken]);
  const localScopeKey = useMemo(() => buildStorageScopeKey(categoryId, questionnaireConfigPath), [categoryId, questionnaireConfigPath]);

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
  const [incorrectQuestions, setIncorrectQuestions] = useState<PersistedQuestion[]>([]);
  const [saveBusy, setSaveBusy] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [uiMode, setUiMode] = useState<Phase3UiMode>("recording");
  const [editableText, setEditableText] = useState("");
  const [audioTimeSeconds, setAudioTimeSeconds] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const wasListeningRef = useRef(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const {
    error: speechError,
    finalText,
    interimText,
    listening,
    resetTranscript,
    startListening,
    stopListening,
    supported,
  } = useBrowserSpeechRecognition(runtimeConfig.speechLanguage);

  const orderedQuestions = useMemo(() => {
    const questionById = new Map(questions.map((question) => [question.questionId, question]));
    return questionOrder.map((questionId) => questionById.get(questionId)).filter(Boolean) as Question[];
  }, [questionOrder, questions]);

  const remainingQuestions = useMemo(
    () => orderedQuestions.filter((question) => !answeredIds.has(question.questionId)),
    [answeredIds, orderedQuestions],
  );

  const activeQuestion = remainingQuestions[activeIndex] ?? null;
  const totalQuestions = orderedQuestions.length;
  const answeredCount = answeredIds.size;
  const progressPercent = totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const liveTranscript = `${finalText}${finalText && interimText ? " " : ""}${interimText}`.trim();
  const canNavigate = uiMode === "recording" && !saveBusy && !listening;
  const showEditInput = uiMode === "editing";
  const showTypingInput = uiMode === "typing";

  const isRecordingMode = uiMode === "recording";
  const isReviewMode = uiMode === "review";
  const isTypingMode = uiMode === "typing";
  const isEditingMode = uiMode === "editing";
  const hasTranscript = Boolean(liveTranscript.trim());
  const hasEditableText = Boolean(editableText.trim());

  const playAudio = useCallback(async () => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    try {
      await audioElement.play();
    } catch (caughtError) {
      if (debug) {
        console.debug("[Phase3] Audio playback was blocked until a user gesture", caughtError);
      }
    }
  }, [debug]);

  const pauseAudio = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const togglePlayPause = useCallback(async () => {
    if (audioPlaying) {
      pauseAudio();
      return;
    }

    await playAudio();
  }, [audioPlaying, pauseAudio, playAudio]);

  const replayAudio = useCallback(async () => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    audioElement.pause();
    audioElement.currentTime = 0;
    setAudioTimeSeconds(0);
    await playAudio();
  }, [playAudio]);

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
    async (question: Question, userAnswer: string) => {
      const normalizedUserAnswer = normalizeTranscript(userAnswer);
      const acceptedAnswers = (question.acceptedTranscripts ?? []).map(normalizeTranscript);
      const isCorrect = acceptedAnswers.includes(normalizedUserAnswer);
      const isBooleanQuestion = question.questionType === 3 || question.questionType === 4;
      const shouldPersist = isBooleanQuestion || isCorrect;

      const payload: SavePayload | null = shouldPersist
        ? {
            category_id: categoryId,
            question_number: question.questionId,
            answer_state: isBooleanQuestion ? String(isCorrect) : "1",
            user_answer: userAnswer || null,
          }
        : null;

      setSaveBusy(true);

      try {
        if (payload) {
          if (useLocalStorage) {
            persistPhase3LocalAnswer(localScopeKey, payload);
          } else if (useDatabase) {
            await saveResultToDatabase(payload);
          }
        }

        const nextAnsweredIds = new Set(answeredIds);
        nextAnsweredIds.add(question.questionId);

        let nextIncorrectQuestions = incorrectQuestions;
        if (!isBooleanQuestion && !isCorrect) {
          const enrichedQuestion: PersistedQuestion = {
            ...question,
            phase3_user_answer: userAnswer,
          };

          const existingIndex = nextIncorrectQuestions.findIndex((incorrectQuestion) => incorrectQuestion.questionId === question.questionId);

          if (existingIndex >= 0) {
            const next = [...nextIncorrectQuestions];
            next[existingIndex] = enrichedQuestion;
            nextIncorrectQuestions = next;
          } else {
            nextIncorrectQuestions = [...nextIncorrectQuestions, enrichedQuestion];
          }
        }

        setAnsweredIds(nextAnsweredIds);
        setIncorrectQuestions(nextIncorrectQuestions);

        if (useLocalStorage) {
          persistPhase3LocalUiState(localScopeKey, nextAnsweredIds, nextIncorrectQuestions);
        }

        const remainingAfterCurrent = remainingQuestions.length - 1;
        if (remainingAfterCurrent <= 0) {
          onComplete?.(nextIncorrectQuestions);
        } else {
          setActiveIndex((currentIndex) => Math.min(currentIndex, remainingAfterCurrent - 1));
        }
      } catch (caughtError) {
        console.error("[Phase3] Saving the answer failed", caughtError);
      } finally {
        setSaveBusy(false);
      }
    },
    [
      answeredIds,
      categoryId,
      incorrectQuestions,
      localScopeKey,
      onComplete,
      remainingQuestions.length,
      saveResultToDatabase,
      useDatabase,
      useLocalStorage,
    ],
  );

  useEffect(() => {
    const loadQuestions = async () => {
      setLoading(true);

      try {
        const response = await fetch(questionnaireConfigPath, { cache: "no-store" });
        const json = (await response.json()) as Question[];
        const validQuestions = Array.isArray(json)
          ? json.filter((question): question is Question => typeof question?.questionId === "number" && typeof question?.questionType === "number")
          : [];

        setQuestions(validQuestions);
        setQuestionOrder(shuffleArray(validQuestions.map((question) => question.questionId)));

        if (useLocalStorage) {
          const localState = readPhase3LocalState(localScopeKey);
          setAnsweredIds(localState.answeredIds);
          setIncorrectQuestions(validQuestions.filter((question) => localState.incorrectIds.includes(question.questionId)) as PersistedQuestion[]);
        } else {
          setAnsweredIds(new Set());
          setIncorrectQuestions([]);
        }

        setActiveIndex(0);
      } catch (caughtError) {
        console.error("[Phase3] Loading the questionnaire failed", caughtError);
        setQuestions([]);
        setQuestionOrder([]);
        setAnsweredIds(new Set());
        setIncorrectQuestions([]);
        setActiveIndex(0);
      } finally {
        setLoading(false);
      }
    };

    void loadQuestions();
  }, [localScopeKey, questionnaireConfigPath, useLocalStorage]);

  useEffect(() => {
    if (!useDatabase || !sessionId || !questions.length || !questionOrder.length) {
      return;
    }

    const hydrateFromDatabase = async () => {
      const readUrl = (answersPath ?? DEFAULT_ANSWERS_PATH)(sessionId);
      const response = await axiosInstance.get(readUrl, {
        headers: getGuestRequestHeaders(),
      });
      const rawData = response?.data;
      const rows = Array.isArray(rawData) ? rawData : Array.isArray(rawData?.answers) ? rawData.answers : [];

      const nextAnsweredIds = new Set<number>();
      for (const row of rows) {
        if (Number(row?.category_id) !== Number(categoryId)) continue;

        const questionNumber = Number(row?.question_number);
        if (!Number.isFinite(questionNumber)) continue;

        nextAnsweredIds.add(questionNumber);
      }

      setAnsweredIds(nextAnsweredIds);
      setIncorrectQuestions([]);
      setActiveIndex(0);
    };

    hydrateFromDatabase().catch((caughtError) => {
      console.error("[Phase3] Database hydration failed", caughtError);
    });
  }, [answersPath, categoryId, getGuestRequestHeaders, questionOrder.length, questions.length, sessionId, useDatabase]);

  useEffect(() => {
    if (activeIndex < remainingQuestions.length) return;
    setActiveIndex(Math.max(0, remainingQuestions.length - 1));
  }, [activeIndex, remainingQuestions.length]);

  useEffect(() => {
    if (!activeQuestion) return;

    setUiMode("recording");
    setEditableText("");
    resetTranscript();
    setAudioTimeSeconds(0);
    setAudioPlaying(false);

    const audioElement = audioRef.current;
    if (!audioElement) return;

    audioElement.pause();
    audioElement.currentTime = 0;
  }, [activeQuestion, resetTranscript]);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const handleTimeUpdate = () => {
      setAudioTimeSeconds(audioElement.currentTime || 0);
    };

    const handlePlay = () => setAudioPlaying(true);
    const handlePause = () => setAudioPlaying(false);
    const handleEnded = () => setAudioPlaying(false);

    audioElement.addEventListener("timeupdate", handleTimeUpdate);
    audioElement.addEventListener("seeked", handleTimeUpdate);
    audioElement.addEventListener("play", handlePlay);
    audioElement.addEventListener("pause", handlePause);
    audioElement.addEventListener("ended", handleEnded);

    return () => {
      audioElement.removeEventListener("timeupdate", handleTimeUpdate);
      audioElement.removeEventListener("seeked", handleTimeUpdate);
      audioElement.removeEventListener("play", handlePlay);
      audioElement.removeEventListener("pause", handlePause);
      audioElement.removeEventListener("ended", handleEnded);
    };
  }, [activeQuestion?.questionId]);

  useEffect(() => {
    if (!listening) {
      if (silenceTimerRef.current !== null) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      return;
    }

    if (!liveTranscript) {
      return;
    }

    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
    }

    silenceTimerRef.current = window.setTimeout(() => {
      stopListening();
    }, runtimeConfig.speechSilenceTimeoutMs);

    return () => {
      if (silenceTimerRef.current !== null) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };
  }, [listening, liveTranscript, runtimeConfig.speechSilenceTimeoutMs, stopListening]);

  useEffect(() => {
    const wasListening = wasListeningRef.current;
    wasListeningRef.current = listening;

    if (!wasListening || listening) return;
    if (uiMode !== "recording") return;
    if (!liveTranscript) return;

    setUiMode("review");
  }, [listening, liveTranscript, uiMode]);

  const goToPreviousQuestion = () => {
    if (!canNavigate) return;
    setActiveIndex((currentIndex) => Math.max(0, currentIndex - 1));
  };

  const goToNextQuestion = () => {
    if (!canNavigate) return;
    setActiveIndex((currentIndex) => Math.min(remainingQuestions.length - 1, currentIndex + 1));
  };

  const handleTouchStart: React.TouchEventHandler<HTMLDivElement> = (event) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;
    const endX = event.changedTouches[0]?.clientX ?? null;
    const endY = event.changedTouches[0]?.clientY ?? null;

    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (startX === null || startY === null || endX === null || endY === null) return;

    const deltaX = endX - startX;
    const deltaY = endY - startY;
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    if (Math.abs(deltaX) < runtimeConfig.swipeThresholdPx) return;

    if (deltaX > 0) {
      goToPreviousQuestion();
    } else {
      goToNextQuestion();
    }
  };

  const buttonClassName = (variant: "primary" | "outline-primary" | "outline-secondary" | "success" | "outline-success") =>
    `btn btn-${variant} rounded-pill px-3`;

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
            Žiadne otázky
          </div>
          <div className="text-muted small">{questionnaireConfigPath}</div>
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
        <div className="text-muted small">Nesprávne pre ďalšiu fázu: {incorrectQuestions.length}</div>
      </div>
    );
  }

  const promptText = getQuestionPrompt(activeQuestion, runtimeConfig);
  const audioSource = getQuestionAudioSource(activeQuestion, runtimeConfig);
  const stimulusImagePath = getQuestionStimulusImage(activeQuestion);
  const isSceneQuestion = activeQuestion.questionType === 3;

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
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
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
            {isSceneQuestion ? (
              <div className="w-100 h-100">
                <ScenePreview config={activeQuestion.config} audioTimeSeconds={audioTimeSeconds} runtimeConfig={runtimeConfig} />
              </div>
            ) : stimulusImagePath ? (
              <div style={{ position: "relative", width: "min(86vw, 1100px)", height: "52dvh", maxHeight: "52dvh" }}>
                <LoadingImageFill
                  src={stimulusImagePath}
                  alt=""
                  sizes="(max-width: 1100px) 86vw, 1100px"
                  fadeDurationMs={runtimeConfig.imageFadeDurationMs}
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
          <div className="d-flex flex-column align-items-center mb-4" style={{ maxWidth: 1280, margin: "0 auto", gap: 10 }}>
            {!showEditInput && !showTypingInput ? (
              <div className="w-100 text-center" style={{ minHeight: 40 }}>
                <div className="text-muted" style={{ fontSize: 16, marginBottom: 2 }}>
                  Prepis
                </div>
                <div style={{ fontSize: "clamp(1.35rem, 1.9vw, 2.1rem)", lineHeight: 1.1, wordBreak: "break-word" }}>
                  {liveTranscript ? (
                    <>
                      <span className="fw-semibold">{finalText}</span>
                      {interimText ? <span className="text-muted"> {interimText}</span> : null}
                    </>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-100 text-center" style={{ maxWidth: 760 }}>
                <div className="text-muted" style={{ fontSize: 16, marginBottom: 6 }}>
                  {showEditInput ? "Upravte prepis" : "Napíšte odpoveď"}
                </div>
                <input
                  className="form-control form-control-lg"
                  value={editableText}
                  onChange={(event) => setEditableText(event.target.value)}
                  disabled={saveBusy}
                  placeholder={showEditInput ? "Upravte rozpoznaný text" : "Napíšte odpoveď"}
                />
              </div>
            )}

            <div className="d-flex flex-wrap justify-content-center gap-2">
              {isRecordingMode && !listening && supported && !speechError && (
                <button
                  type="button"
                  className={buttonClassName("success")}
                  disabled={saveBusy}
                  onClick={() => {
                    pauseAudio();
                    startListening();
                  }}
                >
                  <i className="bi bi-mic-fill me-2" />
                  Nahrávať
                </button>
              )}

              {isRecordingMode && listening && supported && !speechError && (
                <button
                  type="button"
                  className={buttonClassName("outline-success")}
                  disabled={saveBusy}
                  onClick={() => {
                    stopListening();
                    setUiMode("review");
                  }}
                >
                  <i className="bi bi-stop-fill me-2" />
                  Stop
                </button>
              )}

              {isRecordingMode && !listening && (
                <button
                  type="button"
                  className={buttonClassName("outline-primary")}
                  disabled={saveBusy}
                  onClick={() => {
                    stopListening();
                    setEditableText(liveTranscript);
                    setUiMode("typing");
                  }}
                >
                  <i className="bi bi-keyboard me-2" />
                  Napísať
                </button>
              )}

              {isRecordingMode && !listening && hasTranscript && (
                <button
                  type="button"
                  className={buttonClassName("outline-secondary")}
                  disabled={saveBusy}
                  onClick={() => {
                    stopListening();
                    resetTranscript();
                  }}
                >
                  <i className="bi bi-x-circle me-2" />
                  Vymazať
                </button>
              )}
            </div>

            {!supported && <div className="text-danger small text-center">Tento prehliadač nepodporuje rozpoznávanie reči. Použite písanie.</div>}

            {speechError && <div className="text-danger small text-center">Rozpoznávanie reči nie je dostupné ({speechError}). Použite písanie.</div>}

            {isReviewMode && (
              <div className="d-flex flex-wrap justify-content-center gap-2">
                <button
                  type="button"
                  className={buttonClassName("primary")}
                  disabled={saveBusy || !hasTranscript}
                  onClick={() => void finalizeAnswer(activeQuestion, liveTranscript)}
                >
                  <i className="bi bi-check-lg me-2" />
                  Prepis je správny
                </button>

                <button
                  type="button"
                  className={buttonClassName("outline-primary")}
                  disabled={saveBusy || !hasTranscript}
                  onClick={() => {
                    setEditableText(liveTranscript);
                    setUiMode("editing");
                  }}
                >
                  <i className="bi bi-pencil me-2" />
                  Prepis je nesprávny
                </button>

                <button
                  type="button"
                  className={buttonClassName("outline-secondary")}
                  disabled={saveBusy}
                  onClick={() => {
                    setUiMode("recording");
                    stopListening();
                    resetTranscript();
                  }}
                >
                  <i className="bi bi-arrow-repeat me-2" />
                  Znova nahrať
                </button>
              </div>
            )}

            {isTypingMode && (
              <div className="d-flex flex-wrap justify-content-center gap-2">
                <button
                  type="button"
                  className={buttonClassName("outline-secondary")}
                  disabled={saveBusy}
                  onClick={() => {
                    setUiMode("recording");
                    stopListening();
                    resetTranscript();
                    setEditableText("");
                  }}
                >
                  <i className="bi bi-mic-fill me-2" />
                  Mikrofón
                </button>

                <button
                  type="button"
                  className={buttonClassName("primary")}
                  disabled={saveBusy || !hasEditableText}
                  onClick={() => void finalizeAnswer(activeQuestion, editableText.trim())}
                >
                  <i className="bi bi-save2 me-2" />
                  {saveBusy ? "Ukladám…" : "Uložiť"}
                </button>
              </div>
            )}

            {isEditingMode && (
              <div className="d-flex flex-wrap justify-content-center gap-2">
                <button
                  type="button"
                  className={buttonClassName("outline-secondary")}
                  disabled={saveBusy}
                  onClick={() => {
                    setUiMode("recording");
                    stopListening();
                    resetTranscript();
                    setEditableText("");
                  }}
                >
                  <i className="bi bi-arrow-repeat me-2" />
                  Znova nahrať
                </button>

                <button
                  type="button"
                  className={buttonClassName("primary")}
                  disabled={saveBusy || !hasEditableText}
                  onClick={() => void finalizeAnswer(activeQuestion, editableText.trim())}
                >
                  <i className="bi bi-save2 me-2" />
                  {saveBusy ? "Ukladám…" : "Uložiť"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { Phase3Testing };

export default withAuth(Phase3Testing);
