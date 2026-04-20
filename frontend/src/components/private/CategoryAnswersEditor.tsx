/**
 * @ Author: Bc. Adam Božek
 * @ Create Time: 2026-03-06 22:27:51
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

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import "@/components/css/global.css";
import styles from "@/components/css/home.module.css";
import Header from "@/components/private/Header";
import axiosInstance from "@/utilities/AxiosInstance";
import withAuth from "@/utilities/WithAuth";

type QuestionAnswerOption = {
  answerId: number;
  isCorrect: boolean;
  label: string;
  imagePath: string;
};

type QuestionType1 = {
  questionId: number;
  questionType: 1;
  questionText: string;
  questionAudioPath: string;
  acceptedTranscripts: string[];
  answers: QuestionAnswerOption[];
};

type QuestionType2 = {
  questionId: number;
  questionType: 2;
  questionText: string;
  questionText2: string;
  questionAudioPath: string;
  questionAudioPath2: string;
  acceptedTranscripts: string[];
  answers: QuestionAnswerOption[];
};

type QuestionType3 = {
  questionId: number;
  questionType: 3;
  questionText: string;
  questionAudioPath: string;
  acceptedTranscripts: string[];
  config: Record<string, unknown>;
};

type QuestionType4 = {
  questionId: number;
  questionType: 4;
  questionText: string;
  questionAudioPath: string;
  acceptedTranscripts: string[];
  imagePath: string;
};

type Question = QuestionType1 | QuestionType2 | QuestionType3 | QuestionType4;

type BackendAnswer = {
  id: number;
  category_id: number;
  question_number: number;
  answer_state: string;
  user_answer: string | null;
  answered_at: string | null;
};

type AnswerMode = "tri" | "boolean";

type EditableRow = {
  backendAnswerId: number | null;
  questionNumber: number;
  questionType: Question["questionType"];
  questionText: string;
  correctAnswer: string;
  alternativeAnswers: string[];
  answerMode: AnswerMode;
  answeredAt: string | null;

  originalState: string;
  currentState: string;

  originalUserAnswer: string;
  currentUserAnswer: string;
};

type Props = {
  configPath: string;
  sessionId: number;
  categoryId: number;
};

const TRI_STATE_OPTIONS = [
  { value: "1", label: "Rozumie a hovorí" },
  { value: "2", label: "Rozumie" },
  { value: "3", label: "Nerozumie" },
] as const;

const BOOLEAN_STATE_OPTIONS = [
  { value: "true", label: "Áno" },
  { value: "false", label: "Nie" },
] as const;

const normalizeText = (value: string | null | undefined): string => (value ?? "").trim();

const normalizeCompare = (value: string | null | undefined): string => normalizeText(value).toLowerCase();

const getErrorMessage = (error: unknown, fallback: string): string => {
  const axiosError = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };

  const responseMessage = axiosError?.response?.data?.message;
  if (typeof responseMessage === "string" && responseMessage.trim()) {
    return responseMessage;
  }

  if (typeof axiosError?.message === "string" && axiosError.message.trim()) {
    return axiosError.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};

const formatDateTime = (iso: string | null) => {
  if (!iso) return "-";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return date.toLocaleString("sk-SK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getAnswerMode = (question: Question, rawState: string | null | undefined): AnswerMode => {
  const normalized = String(rawState ?? "").toLowerCase();

  if (normalized === "true" || normalized === "false") {
    return "boolean";
  }

  if (question.questionType === 3 || question.questionType === 4) {
    return "boolean";
  }

  return "tri";
};

const getAcceptedTranscriptVariants = (question: Question): string[] => {
  if (!Array.isArray(question.acceptedTranscripts)) return [];

  const unique = new Map<string, string>();

  for (const item of question.acceptedTranscripts) {
    if (typeof item !== "string") continue;

    const trimmed = item.trim();
    if (!trimmed) continue;

    const key = normalizeCompare(trimmed);
    if (!unique.has(key)) {
      unique.set(key, trimmed);
    }
  }

  return Array.from(unique.values());
};

const getCorrectAnswerMeta = (
  question: Question,
): {
  correctAnswer: string;
  alternativeAnswers: string[];
} => {
  const transcriptVariants = getAcceptedTranscriptVariants(question);

  if (question.questionType === 1 || question.questionType === 2) {
    const correct = question.answers.find((answer) => answer.isCorrect);
    const correctAnswer = normalizeText(correct?.label) || transcriptVariants[0] || "—";

    return {
      correctAnswer,
      alternativeAnswers: transcriptVariants.filter((item) => normalizeCompare(item) !== normalizeCompare(correctAnswer)),
    };
  }

  const correctAnswer = transcriptVariants[0] ?? "—";

  return {
    correctAnswer,
    alternativeAnswers: transcriptVariants.filter((item) => normalizeCompare(item) !== normalizeCompare(correctAnswer)),
  };
};

const getQuestionTitle = (question: Question): string => {
  if (question.questionType === 1) {
    return "Čo je na tomto obrázku?";
  } else if (question.questionType === 2) {
    return `${question.questionText}`;
  }

  return question.questionText;
};

const getStateLabel = (mode: AnswerMode, value: string): string => {
  const options = mode === "tri" ? TRI_STATE_OPTIONS : BOOLEAN_STATE_OPTIONS;
  return options.find((option) => option.value === value)?.label ?? "Nevybrané";
};

const isRowEdited = (row: EditableRow): boolean => {
  return row.originalState !== row.currentState || normalizeText(row.originalUserAnswer) !== normalizeText(row.currentUserAnswer);
};

const buildRows = (questionsConfig: Question[], backendAnswers: BackendAnswer[], categoryId: number): EditableRow[] => {
  const answersByQuestionNumber = new Map<number, BackendAnswer>();

  for (const answer of backendAnswers) {
    if (Number(answer.category_id) !== Number(categoryId)) continue;
    answersByQuestionNumber.set(Number(answer.question_number), answer);
  }

  return [...questionsConfig]
    .sort((left, right) => left.questionId - right.questionId)
    .map((question) => {
      const backendAnswer = answersByQuestionNumber.get(question.questionId);
      const state = backendAnswer?.answer_state ?? "";
      const { correctAnswer, alternativeAnswers } = getCorrectAnswerMeta(question);

      return {
        backendAnswerId: backendAnswer?.id ?? null,
        questionNumber: question.questionId,
        questionType: question.questionType,
        questionText: getQuestionTitle(question),
        correctAnswer,
        alternativeAnswers,
        answerMode: getAnswerMode(question, state),
        answeredAt: backendAnswer?.answered_at ?? null,

        originalState: state,
        currentState: state,

        originalUserAnswer: backendAnswer?.user_answer ?? "",
        currentUserAnswer: backendAnswer?.user_answer ?? "",
      };
    });
};

const CategoryAnswersEditor = ({ configPath, sessionId, categoryId }: Props) => {
  const router = useRouter();

  const [questionsConfig, setQuestionsConfig] = useState<Question[]>([]);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveBusy, setSaveBusy] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const loadPageData = useCallback(async () => {
    try {
      setLoading(true);
      setPageError(null);

      const configResponse = await fetch(configPath, { cache: "no-store" });
      if (!configResponse.ok) {
        throw new Error("Nepodarilo sa načítať konfiguračný JSON.");
      }

      const configData = (await configResponse.json()) as Question[];
      setQuestionsConfig(configData);

      const answersResponse = await axiosInstance.get<BackendAnswer[] | { answers?: BackendAnswer[] }>(`/sessions/${sessionId}/answers`);
      const raw = answersResponse.data;
      const answers = Array.isArray(raw) ? raw : Array.isArray(raw?.answers) ? raw.answers : [];

      setRows(buildRows(configData, answers, categoryId));
    } catch (error: unknown) {
      setPageError(getErrorMessage(error, "Nepodarilo sa načítať údaje pre korekciu."));
      setQuestionsConfig([]);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [categoryId, configPath, sessionId]);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  const changedRows = useMemo(() => rows.filter(isRowEdited), [rows]);

  const stats = useMemo(() => {
    const total = rows.length;
    const edited = changedRows.length;
    const tri = rows.filter((row) => row.answerMode === "tri").length;
    const bool = rows.filter((row) => row.answerMode === "boolean").length;

    return { total, edited, tri, bool };
  }, [changedRows.length, rows]);

  const updateRow = useCallback((questionNumber: number, updater: (row: EditableRow) => EditableRow) => {
    setRows((previous) =>
      previous.map((row) => {
        if (row.questionNumber !== questionNumber) return row;
        return updater(row);
      }),
    );
  }, []);

  const handleStateToggle = (questionNumber: number, value: string, checked: boolean) => {
    updateRow(questionNumber, (row) => ({
      ...row,
      currentState: checked ? value : "",
    }));
  };

  const handleUserAnswerChange = (questionNumber: number, value: string) => {
    updateRow(questionNumber, (row) => ({
      ...row,
      currentUserAnswer: value,
    }));
  };

  const handleResetRow = (questionNumber: number) => {
    updateRow(questionNumber, (row) => ({
      ...row,
      currentState: row.originalState,
      currentUserAnswer: row.originalUserAnswer,
    }));
  };

  const markCategoryCorrected = async () => {
    await axiosInstance.patch(`/sessions/${sessionId}/categories/${categoryId}/correct`);
  };

  const handleSave = async () => {
    if (saveBusy) return;

    setPageError(null);

    const invalidRow = changedRows.find((row) => !row.currentState);
    if (invalidRow) {
      setPageError(`Otázka ${invalidRow.questionNumber} nemá vybraný stav odpovede.`);
      return;
    }

    try {
      setSaveBusy(true);

      if (changedRows.length > 0) {
        await Promise.all(
          changedRows.map((row) =>
            axiosInstance.post(`/sessions/${sessionId}/answers`, {
              category_id: categoryId,
              question_number: row.questionNumber,
              answer_state: row.currentState,
              user_answer: normalizeText(row.currentUserAnswer) || null,
            }),
          ),
        );
      }

      await markCategoryCorrected();

      router.push("/dashboard");
      router.refresh();
    } catch (error: unknown) {
      setPageError(getErrorMessage(error, "Nepodarilo sa uložiť zmeny."));
    } finally {
      setSaveBusy(false);
    }
  };

  const handleCategoryTranslation = (categoryId: number): string => {
    switch (categoryId) {
      case 1:
        return "Obchod";
      case 2:
        return "Hory";
      case 3:
        return "ZOO";
      case 4:
        return "Ulica";
      case 5:
        return "Domov";
      default:
        return `Kategória ${categoryId}`;
    }
  };

  return (
    <>
      <Header />

      <main className={`container d-flex flex-column align-items-start pb-4 ${styles.editorPage}`}>
        <div className="glass p-3 p-lg-4 mb-4 w-100">
          <div className="d-flex flex-column gap-3">
            <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
              <div className="d-flex flex-column gap-1">
                <h1 className={`${styles.dashTitle} mb-3`}>Korekcia odpovedí</h1>
                <div className="d-flex flex-wrap gap-2 small">
                  <span className="status-pill status-pill--info">Test č. {sessionId}</span>
                  <span className="status-pill status-pill--info">Kategória: {handleCategoryTranslation(categoryId)}</span>
                  <span className="status-pill status-pill--info">Počet otázok: {stats.total}</span>
                  <span className="status-pill status-pill--active">Zmenené: {stats.edited}</span>
                </div>
              </div>
            </div>

            <div className="d-flex flex-column gap-3">
              <p className={`${styles.editorLead} mb-0`}>
                Označte pri každom slove, či ho dieťa <strong>rozumie a hovorí</strong>, iba <strong>rozumie</strong>, alebo mu{" "}
                <strong>nerozumie</strong>.
              </p>

              <div className="anon-grid" style={{ maxWidth: "100%" }}>
                <section className="info-card compact-card text-start">
                  <h4>Rozumie a hovorí</h4>
                  <p className="mb-0">Dieťa slovo pozná a bežne ho používa.</p>
                </section>

                <section className="info-card compact-card text-start">
                  <h4>Rozumie</h4>
                  <p className="mb-0">Dieťa význam pozná, ale slovo samo nepovie.</p>
                </section>

                <section className="info-card compact-card text-start">
                  <h4>Nerozumie</h4>
                  <p className="mb-0">Dieťa slovo nepozná alebo mu nerozumie.</p>
                </section>

                <section className="info-card compact-card text-start">
                  <h4>Započítajte aj detskú výslovnosť</h4>
                  <p className="mb-0">Slovo označte aj vtedy, ak ho dieťa vyslovuje inak, napríklad „čimy“ namiesto „čižmy“.</p>
                </section>

                <section className="info-card compact-card text-start anon-grid__wide">
                  <h4>Dôležité</h4>
                  <p className="mb-0">
                    Nemusí ovládať všetky slová. Zohľadnite aj výrazy používané doma. Ak doma hovoríte napríklad „gauč“, stále označte slovo
                    „sedačka“.
                  </p>
                </section>
              </div>
            </div>
          </div>

          {pageError && (
            <div className="alert alert-danger mt-3 mb-0" role="alert">
              {pageError}
            </div>
          )}
        </div>

        <div className="glass p-3 p-lg-4 w-100">
          {loading ? (
            <div className="d-flex justify-content-center py-5">
              <div className="spinner-border" role="status" aria-label="Načítavam" />
            </div>
          ) : rows.length === 0 || questionsConfig.length === 0 ? (
            <p className="mb-0">V tejto kategórii nie sú žiadne otázky.</p>
          ) : (
            <>
              <div
                className="d-none d-xl-grid mb-3 px-2 small fw-semibold text-muted"
                style={{ gridTemplateColumns: "80px 2fr 1.2fr 1.2fr 1.8fr 1.8fr" }}
              >
                <div>Otázka</div>
                <div>Zadanie</div>
                <div>Správna odpoveď</div>
                <div>Pôvodná odpoveď</div>
                <div>Upravená odpoveď</div>
                <div>Stav</div>
              </div>

              <div className="category-list">
                {rows.map((row) => {
                  const edited = isRowEdited(row);
                  const stateOptions = row.answerMode === "tri" ? TRI_STATE_OPTIONS : BOOLEAN_STATE_OPTIONS;

                  return (
                    <div
                      key={row.questionNumber}
                      className="category-list-item"
                      style={{
                        gridTemplateColumns: "1fr",
                        borderColor: edited ? "rgba(249, 115, 22, 0.65)" : undefined,
                        background: edited ? "rgba(249, 115, 22, 0.10)" : undefined,
                        boxShadow: edited ? "inset 0 0 0 1px rgba(249,115,22,0.18), 0 10px 22px rgba(249,115,22,0.10)" : undefined,
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gap: "1rem",
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          width: "100%",
                        }}
                      >
                        <div className="category-main">
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <span className="badge bg-light text-dark border">#{row.questionNumber}</span>
                            {edited && <span className="badge text-bg-warning">Zmenené</span>}
                          </div>
                          <div className="fw-semibold">{row.questionText}</div>
                          <div className="small text-muted">Posledná odpoveď: {formatDateTime(row.answeredAt)}</div>
                        </div>

                        <div className="category-main">
                          <div className="small text-muted">Správna odpoveď</div>
                          <div className="fw-semibold">{row.correctAnswer}</div>
                          {row.alternativeAnswers.length > 0 && (
                            <div className="small text-muted">Alternatívy: {row.alternativeAnswers.join(", ")}</div>
                          )}
                        </div>

                        <div className="category-main">
                          <div className="small text-muted">Pôvodná odpoveď používateľa</div>
                          <div className="fw-semibold">{normalizeText(row.originalUserAnswer) || "—"}</div>
                          <div className="small text-muted">
                            Pôvodný stav: <span className="fw-semibold">{getStateLabel(row.answerMode, row.originalState)}</span>
                          </div>
                        </div>

                        <div className="category-main">
                          <div className="small text-muted">Upravená odpoveď</div>
                          <input
                            className="form-control glass-input"
                            value={row.currentUserAnswer}
                            onChange={(event) => handleUserAnswerChange(row.questionNumber, event.target.value)}
                            placeholder="Upraviť odpoveď používateľa"
                            disabled={saveBusy}
                          />

                          {edited && (
                            <div className="small" style={{ color: "#c2410c" }}>
                              Zmena textu: <strong>{normalizeText(row.originalUserAnswer) || "—"}</strong> →{" "}
                              <strong>{normalizeText(row.currentUserAnswer) || "—"}</strong>
                            </div>
                          )}
                        </div>

                        <div className="category-main">
                          <div className="small text-muted">Stav odpovede</div>

                          <div className="d-flex flex-column gap-2">
                            {stateOptions.map((option) => (
                              <label key={option.value} className="d-flex align-items-center gap-2">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  checked={row.currentState === option.value}
                                  onChange={(event) => handleStateToggle(row.questionNumber, option.value, event.target.checked)}
                                  disabled={saveBusy}
                                />
                                <span>{option.label}</span>
                              </label>
                            ))}
                          </div>

                          {edited && (
                            <div className="small" style={{ color: "#c2410c" }}>
                              Zmena stavu: <strong>{getStateLabel(row.answerMode, row.originalState)}</strong> →{" "}
                              <strong>{getStateLabel(row.answerMode, row.currentState)}</strong>
                            </div>
                          )}

                          <div className="pt-2">
                            {edited && (
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                onClick={() => handleResetRow(row.questionNumber)}
                                disabled={!edited || saveBusy}
                              >
                                Vrátiť pôvodné
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mt-4 pt-2">
                <div className="small text-muted">
                  {changedRows.length === 0
                    ? "Neboli vykonané žiadne zmeny. Kategória bude iba označená ako skontrolovaná."
                    : `Na uloženie čaká ${changedRows.length} upravených odpovedí.`}
                </div>

                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => {
                      router.push("/dashboard");
                      router.refresh();
                    }}
                    disabled={saveBusy}
                  >
                    Späť na dashboard
                  </button>

                  <button type="button" className="btn btn-primary" onClick={() => void handleSave()} disabled={saveBusy}>
                    {saveBusy ? "Ukladám..." : changedRows.length === 0 ? "Označiť ako skontrolovanú" : "Uložiť zmeny"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
};

export default withAuth(CategoryAnswersEditor);
