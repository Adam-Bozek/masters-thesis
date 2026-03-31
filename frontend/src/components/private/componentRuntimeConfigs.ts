/**
 * Centralized runtime configuration for the testing flow components.
 *
 * Usage:
 *   import {
 *     controllerRuntimeConfig,
 *     phase3RuntimeConfig,
 *     phase5RuntimeConfig,
 *     sceneBuilderRuntimeConfig,
 *   } from "@/config/componentRuntimeConfigs";
 *
 *   <Controller config={controllerRuntimeConfig} />
 *   <Phase3Testing config={phase3RuntimeConfig} />
 *   <Phase5Testing config={phase5RuntimeConfig} />
 *   <SceneBuilder runtimeConfig={sceneBuilderRuntimeConfig} />
 */

/* -------------------------------------------------------------------------------------------------
 * Runtime config types
 * -----------------------------------------------------------------------------------------------*/

export type ControllerRuntimeConfig = {
  /** Minimum delay before phase 1 can be shown again for the same category. */
  categoryCooldownHours: number;
  /** Fallback redirect when no explicit redirect target is provided. */
  defaultRedirectPath: string;
  /** Accept the legacy "marketpace" key and map it to "marketplace". */
  tolerateMarketplaceTypo: boolean;
  /** Backend message fragment used when completion fails because no answers exist yet. */
  noAnswersMessageFragment: string;
  /** Backend message fragment used when the category is already completed. */
  alreadyCompletedMessageFragment: string;
  /** Backend message fragment used when the category is already corrected. */
  alreadyCorrectedMessageFragment: string;
  /** Accessible label for the boot loading spinner. */
  bootLoadingAriaLabel: string;
  /** Accessible label for scene-loading states. */
  sceneLoadingAriaLabel: string;
  /** Accessible label for the finalization spinner. */
  finalizingLoadingAriaLabel: string;
  /** Generic top-level error title. */
  genericErrorTitle: string;
  /** Error title shown when a phase scene is missing. */
  sceneMissingTitle: string;
  /** Error title shown when database mode is missing a session id. */
  missingSessionTitle: string;
  /** Error title shown when final completion fails. */
  finalizeErrorTitle: string;
};

export type Phase3RuntimeConfig = {
  /** Browser speech recognition locale. */
  speechLanguage: string;
  /** How long to wait after the user stops speaking before stopping recognition automatically. */
  speechSilenceTimeoutMs: number;
  /** Minimum horizontal swipe distance required to change questions. */
  swipeThresholdPx: number;
  /** Timeline tolerance used when deciding which scene images should already be visible. */
  sceneTimeEpsilonSeconds: number;
  /** Fade duration for lazy-loaded images. */
  imageFadeDurationMs: number;
  /** Prompt text used for question type 1. */
  questionType1Prompt: string;
  /** Audio source used for question type 1. */
  questionType1AudioPath: string;
  /** Placeholder text displayed when a scene currently has no visible images. */
  sceneEmptyStateText: string;
};

export type Phase5RuntimeConfig = {
  /** Fade duration for answer images. */
  imageFadeDurationMs: number;
  /** Maximum answer count that still uses the compact two-column layout. */
  compactGridMaxAnswers: number;
  /** Bootstrap gap classes used by the answer grid. */
  answerGridGapClass: string;
  /** Border radius applied to answer cards. */
  answerCardBorderRadiusPx: number;
  /** Minimum height used by answer images. */
  answerImageMinHeight: string;
};

export type SceneBuilderRuntimeConfig = {
  /** Label shown when autoplay is blocked and a user gesture is required. */
  autoplayPromptText: string;
  /** Main play button label. */
  playButtonLabel: string;
  /** Pause button label. */
  pauseButtonLabel: string;
  /** Restart button label. */
  restartButtonLabel: string;
  /** Skip button label. */
  skipButtonLabel: string;
  /** Body overflow mode used while the fullscreen scene player is mounted. */
  bodyOverflowMode: string;
  /** Minimum audio time delta before the UI updates its displayed current time. */
  currentTimeUpdateThresholdSeconds: number;
  /** Small tolerance for triggering timeline events slightly before exact audio time alignment. */
  eventTriggerEpsilonSeconds: number;
  /** Progress bar height. */
  progressBarHeightPx: number;
  /** Single-image max height. */
  singleImageMaxHeight: string;
  /** Two-image max height. */
  dualImageMaxHeight: string;
  /** Three-or-more-images max height. */
  multiImageMaxHeight: string;
  /** Single-image max width. */
  singleImageMaxWidth: string;
  /** Two-image max width. */
  dualImageMaxWidth: string;
  /** Three-or-more-images max width. */
  multiImageMaxWidth: string;
};

export type TestingComponentRuntimeConfigs = {
  controller: ControllerRuntimeConfig;
  phase3: Phase3RuntimeConfig;
  phase5: Phase5RuntimeConfig;
  sceneBuilder: SceneBuilderRuntimeConfig;
};

/* -------------------------------------------------------------------------------------------------
 * Default runtime configs
 * -----------------------------------------------------------------------------------------------*/

export const controllerRuntimeConfig: ControllerRuntimeConfig = {
  categoryCooldownHours: 3,
  defaultRedirectPath: "/dashboard",
  tolerateMarketplaceTypo: true,
  noAnswersMessageFragment: "no answers",
  alreadyCompletedMessageFragment: "already completed",
  alreadyCorrectedMessageFragment: "already corrected",
  bootLoadingAriaLabel: "Načítavam",
  sceneLoadingAriaLabel: "Načítavam konfiguráciu",
  finalizingLoadingAriaLabel: "Dokončujem",
  genericErrorTitle: "Chyba",
  sceneMissingTitle: "Chýba konfigurácia scény",
  missingSessionTitle: "Chýba sessionId",
  finalizeErrorTitle: "Nepodarilo sa dokončiť kategóriu",
};

export const phase3RuntimeConfig: Phase3RuntimeConfig = {
  speechLanguage: "sk-SK",
  speechSilenceTimeoutMs: 1300,
  swipeThresholdPx: 55,
  sceneTimeEpsilonSeconds: 0.01,
  imageFadeDurationMs: 120,
  questionType1Prompt: "Čo je na tomto obrázku?",
  questionType1AudioPath: "/sounds/testing/čjnto.mp3",
  sceneEmptyStateText: "Scéna je pripravená",
};

export const phase5RuntimeConfig: Phase5RuntimeConfig = {
  imageFadeDurationMs: 120,
  compactGridMaxAnswers: 4,
  answerGridGapClass: "g-2 g-sm-3",
  answerCardBorderRadiusPx: 14,
  answerImageMinHeight: "clamp(92px, 22vh, 280px)",
};

export const sceneBuilderRuntimeConfig: SceneBuilderRuntimeConfig = {
  autoplayPromptText: "Ťuknite pre spustenie",
  playButtonLabel: "Prehrať",
  pauseButtonLabel: "Pozastaviť",
  restartButtonLabel: "Reštart",
  skipButtonLabel: "Preskočiť",
  bodyOverflowMode: "hidden",
  currentTimeUpdateThresholdSeconds: 0.05,
  eventTriggerEpsilonSeconds: 0.01,
  progressBarHeightPx: 10,
  singleImageMaxHeight: "90vh",
  dualImageMaxHeight: "80vh",
  multiImageMaxHeight: "70vh",
  singleImageMaxWidth: "95vw",
  dualImageMaxWidth: "48vw",
  multiImageMaxWidth: "32vw",
};

/* -------------------------------------------------------------------------------------------------
 * Grouped export
 * -----------------------------------------------------------------------------------------------*/

export const testingComponentRuntimeConfigs: TestingComponentRuntimeConfigs = {
  controller: controllerRuntimeConfig,
  phase3: phase3RuntimeConfig,
  phase5: phase5RuntimeConfig,
  sceneBuilder: sceneBuilderRuntimeConfig,
};

export default testingComponentRuntimeConfigs;