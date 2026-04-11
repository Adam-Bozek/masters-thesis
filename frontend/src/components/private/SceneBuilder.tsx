/**
 * @ Author: Bc. Adam Božek
 * @ Create Time: 2026-02-09 16:28:15
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
import { sceneBuilderRuntimeConfig as sharedSceneBuilderRuntimeConfig } from "./componentRuntimeConfigs";

export type DisplayType = "insert" | "add" | "remove_last_and_add" | "remove_all_and_add";

export type PictureEvent = {
  path: string;
  display_time: string | number;
  display_type: DisplayType;
};

export type SceneConfig = {
  sound_path: string;
  pictures: PictureEvent[];
};

export type SceneBuilderRuntimeConfig = {
  autoplayPromptText: string;
  playButtonLabel: string;
  pauseButtonLabel: string;
  restartButtonLabel: string;
  skipButtonLabel: string;
  bodyOverflowMode: string;
  currentTimeUpdateThresholdSeconds: number;
  eventTriggerEpsilonSeconds: number;
  progressBarHeightPx: number;
  singleImageMaxHeight: string;
  dualImageMaxHeight: string;
  multiImageMaxHeight: string;
  singleImageMaxWidth: string;
  dualImageMaxWidth: string;
  multiImageMaxWidth: string;
};

type NormalizedPictureEvent = {
  path: string;
  timeSeconds: number;
  displayType: DisplayType;
};

export type SceneBuilderProps = {
  config: SceneConfig;
  onComplete: () => void;
  onSkip: () => void;
  debug?: boolean;
  runtimeConfig?: Partial<SceneBuilderRuntimeConfig>;
};

const DEFAULT_RUNTIME_CONFIG: SceneBuilderRuntimeConfig = sharedSceneBuilderRuntimeConfig;

function parseTimeToSeconds(value: string | number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }

  const normalizedValue = String(value).trim();
  if (!normalizedValue) {
    return 0;
  }

  const parts = normalizedValue.split(":").map((part) => part.trim());
  if (parts.some((part) => part === "" || !/^\d+$/.test(part))) {
    return 0;
  }

  const numericParts = parts.map(Number);

  if (numericParts.length === 1) {
    return Math.max(0, numericParts[0]);
  }

  if (numericParts.length === 2) {
    return Math.max(0, numericParts[0] * 60 + numericParts[1]);
  }

  const [hours, minutes, seconds] = numericParts.slice(-3);
  return Math.max(0, hours * 3600 + minutes * 60 + seconds);
}

function normalizePictureEvents(pictures: PictureEvent[]): NormalizedPictureEvent[] {
  return [...pictures]
    .map((picture) => ({
      path: picture.path,
      timeSeconds: parseTimeToSeconds(picture.display_time),
      displayType: picture.display_type,
    }))
    .sort((left, right) => left.timeSeconds - right.timeSeconds);
}

function applyPictureEvent(currentPaths: string[], event: NormalizedPictureEvent): string[] {
  switch (event.displayType) {
    // "insert" is treated as replacing the current scene with a single image,
    // which matches the original component behavior.
    case "insert":
      return [event.path];
    case "add":
      return [...currentPaths, event.path];
    case "remove_last_and_add": {
      const nextPaths = currentPaths.slice(0, Math.max(0, currentPaths.length - 1));
      nextPaths.push(event.path);
      return nextPaths;
    }
    case "remove_all_and_add":
      return [event.path];
    default:
      return currentPaths;
  }
}

function clampPercentage(value: number): number {
  return Math.min(100, Math.max(0, value));
}

type ViewportSize = {
  width: number;
  height: number;
};

type ImageStageLayout = {
  gridStyle: React.CSSProperties;
  itemStyle: React.CSSProperties;
  imageStyle: React.CSSProperties;
};

function getBestGridColumnCount(displayedImageCount: number, availableWidth: number, availableHeight: number, gapPx: number): number {
  if (displayedImageCount <= 1 || availableWidth <= 0 || availableHeight <= 0) {
    return 1;
  }

  const maxColumns = Math.min(displayedImageCount, availableWidth < 700 ? 2 : availableWidth < 1200 ? 3 : 4);

  let bestColumnCount = 1;
  let bestScore = -1;

  for (let columnCount = 1; columnCount <= maxColumns; columnCount += 1) {
    const rowCount = Math.ceil(displayedImageCount / columnCount);
    const cellWidth = (availableWidth - gapPx * (columnCount - 1)) / columnCount;
    const cellHeight = (availableHeight - gapPx * (rowCount - 1)) / rowCount;
    const score = Math.min(cellWidth, cellHeight);

    if (score > bestScore) {
      bestScore = score;
      bestColumnCount = columnCount;
    }
  }

  return bestColumnCount;
}

function getImageStageLayout(displayedImageCount: number, viewportSize: ViewportSize, runtimeConfig: SceneBuilderRuntimeConfig): ImageStageLayout {
  const stagePaddingX = 16;
  const stageTopPadding = 88;
  const stageBottomPadding = 64;
  const gapPx = 12;

  const availableWidth = Math.max(0, viewportSize.width - stagePaddingX * 2);
  const availableHeight = Math.max(0, viewportSize.height - stageTopPadding - stageBottomPadding);
  const safeDisplayedImageCount = Math.max(1, displayedImageCount);
  const columnCount = getBestGridColumnCount(safeDisplayedImageCount, availableWidth, availableHeight, gapPx);
  const rowCount = Math.ceil(safeDisplayedImageCount / columnCount);
  const isSingleImage = safeDisplayedImageCount <= 1;
  const isDualImage = safeDisplayedImageCount === 2;

  return {
    gridStyle: {
      width: "100%",
      height: "100%",
      padding: `${stageTopPadding}px ${stagePaddingX}px ${stageBottomPadding}px`,
      display: "grid",
      gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
      gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))`,
      gap: `${gapPx}px`,
      overflow: "hidden",
    },
    itemStyle: {
      minWidth: 0,
      minHeight: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    imageStyle: {
      width: isSingleImage || isDualImage ? "auto" : "100%",
      height: isSingleImage || isDualImage ? "auto" : "100%",
      maxHeight: isSingleImage
        ? `min(100%, ${runtimeConfig.singleImageMaxHeight})`
        : isDualImage
          ? `min(100%, ${runtimeConfig.dualImageMaxHeight})`
          : "100%",
      maxWidth: isSingleImage
        ? `min(100%, ${runtimeConfig.singleImageMaxWidth})`
        : isDualImage
          ? `min(100%, ${runtimeConfig.dualImageMaxWidth})`
          : "100%",
      objectFit: "contain",
      userSelect: "none",
      pointerEvents: "none",
    },
  };
}

function getDisplayedImageStyle(displayedImageCount: number, runtimeConfig: SceneBuilderRuntimeConfig): React.CSSProperties {
  const isSingleImage = displayedImageCount <= 1;
  const isDualImage = displayedImageCount === 2;

  return {
    objectFit: "contain",
    userSelect: "none",
    pointerEvents: "none",
    maxHeight: isSingleImage
      ? runtimeConfig.singleImageMaxHeight
      : isDualImage
        ? runtimeConfig.dualImageMaxHeight
        : runtimeConfig.multiImageMaxHeight,
    maxWidth: isSingleImage ? runtimeConfig.singleImageMaxWidth : isDualImage ? runtimeConfig.dualImageMaxWidth : runtimeConfig.multiImageMaxWidth,
  };
}

function debugLog(debug: boolean, ...args: unknown[]) {
  if (debug) {
    console.log("[SceneBuilder]", ...args);
  }
}

function preloadUniqueImages(pictures: PictureEvent[]) {
  const uniquePaths = Array.from(new Set(pictures.map((picture) => picture.path)));

  uniquePaths.forEach((sourcePath) => {
    const image = new Image();
    image.src = sourcePath;
  });
}

type AutoplayOverlayProps = {
  isVisible: boolean;
  buttonLabel: string;
  onResume: () => void;
};

function AutoplayOverlay({ isVisible, buttonLabel, onResume }: AutoplayOverlayProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <button
      type="button"
      className="btn btn-primary btn-lg shadow"
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 50,
      }}
      onClick={onResume}
    >
      <i className="bi bi-play-fill me-2" />
      {buttonLabel}
    </button>
  );
}

type PlaybackControlsProps = {
  isPlaying: boolean;
  playLabel: string;
  pauseLabel: string;
  restartLabel: string;
  skipLabel: string;
  onPlay: () => void;
  onPause: () => void;
  onRestart: () => void;
  onSkip: () => void;
};

function PlaybackControls({ isPlaying, playLabel, pauseLabel, restartLabel, skipLabel, onPlay, onPause, onRestart, onSkip }: PlaybackControlsProps) {
  return (
    <div className="position-absolute top-0 start-0 end-0 p-3 d-flex justify-content-center" style={{ zIndex: 40 }}>
      <div className="d-flex gap-2 bg-white rounded-3 shadow-sm border p-2">
        <button type="button" className="btn btn-primary" onClick={onPlay} disabled={isPlaying} aria-label={playLabel}>
          <i className="bi bi-play-fill me-2" />
          {playLabel}
        </button>

        <button type="button" className="btn btn-outline-primary" onClick={onPause} disabled={!isPlaying} aria-label={pauseLabel}>
          <i className="bi bi-pause-fill me-2" />
          {pauseLabel}
        </button>

        <button type="button" className="btn btn-outline-secondary" onClick={onRestart} aria-label={restartLabel}>
          <i className="bi bi-arrow-counterclockwise me-2" />
          {restartLabel}
        </button>

        <button type="button" className="btn btn-outline-danger" onClick={onSkip} aria-label={skipLabel}>
          <i className="bi bi-skip-forward-fill me-2" />
          {skipLabel}
        </button>
      </div>
    </div>
  );
}

type PlaybackProgressProps = {
  progressPercentage: number;
  heightPx: number;
};

function PlaybackProgress({ progressPercentage, heightPx }: PlaybackProgressProps) {
  return (
    <div className="position-absolute bottom-0 start-0 end-0 p-3" style={{ zIndex: 40 }}>
      <div className="progress" style={{ height: heightPx }}>
        <div className="progress-bar" role="progressbar" style={{ width: `${progressPercentage}%` }} />
      </div>
    </div>
  );
}

function SceneBuilder({ config, onComplete, onSkip, debug = false, runtimeConfig: runtimeConfigOverride }: SceneBuilderProps) {
  const runtimeConfig = useMemo<SceneBuilderRuntimeConfig>(() => ({ ...DEFAULT_RUNTIME_CONFIG, ...runtimeConfigOverride }), [runtimeConfigOverride]);

  const normalizedEvents = useMemo<NormalizedPictureEvent[]>(() => normalizePictureEvents(config.pictures ?? []), [config.pictures]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const displayedImagePathsRef = useRef<string[]>([]);
  const nextEventIndexRef = useRef(0);
  const lastReportedTimeRef = useRef(-1);

  const [displayedImagePaths, setDisplayedImagePaths] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [viewportSize, setViewportSize] = useState<ViewportSize>({ width: 0, height: 0 });

  const stopAnimationLoop = useCallback(() => {
    if (animationFrameRef.current != null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const resetPlaybackTimeline = useCallback(() => {
    displayedImagePathsRef.current = [];
    nextEventIndexRef.current = 0;
    lastReportedTimeRef.current = -1;
    setDisplayedImagePaths([]);
    setCurrentTimeSeconds(0);
  }, []);

  const startAnimationLoop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    stopAnimationLoop();

    const tick = () => {
      const currentAudio = audioRef.current;
      if (!currentAudio) {
        return;
      }

      const playbackTimeSeconds = currentAudio.currentTime || 0;

      if (Math.abs(playbackTimeSeconds - lastReportedTimeRef.current) > runtimeConfig.currentTimeUpdateThresholdSeconds) {
        lastReportedTimeRef.current = playbackTimeSeconds;
        setCurrentTimeSeconds(playbackTimeSeconds);
      }

      let nextEventIndex = nextEventIndexRef.current;
      let nextDisplayedImages = displayedImagePathsRef.current;

      while (
        nextEventIndex < normalizedEvents.length &&
        normalizedEvents[nextEventIndex].timeSeconds <= playbackTimeSeconds + runtimeConfig.eventTriggerEpsilonSeconds
      ) {
        nextDisplayedImages = applyPictureEvent(nextDisplayedImages, normalizedEvents[nextEventIndex]);
        nextEventIndex += 1;
      }

      if (nextEventIndex !== nextEventIndexRef.current) {
        nextEventIndexRef.current = nextEventIndex;
        displayedImagePathsRef.current = nextDisplayedImages;
        setDisplayedImagePaths(nextDisplayedImages);
        debugLog(debug, "applied events", {
          nextEventIndex,
          playbackTimeSeconds,
          nextDisplayedImages,
        });
      }

      if (!currentAudio.paused && !currentAudio.ended) {
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  }, [debug, normalizedEvents, runtimeConfig.currentTimeUpdateThresholdSeconds, runtimeConfig.eventTriggerEpsilonSeconds, stopAnimationLoop]);

  const startPlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
      setNeedsUserGesture(false);
      startAnimationLoop();
      debugLog(debug, "playing");
    } catch (error) {
      setIsPlaying(false);
      setNeedsUserGesture(true);
      debugLog(debug, "autoplay blocked", error);
    }
  }, [debug, startAnimationLoop]);

  const pausePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.pause();
    setIsPlaying(false);
    stopAnimationLoop();
    debugLog(debug, "paused", audio.currentTime);
  }, [debug, stopAnimationLoop]);

  const restartPlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    pausePlayback();
    resetPlaybackTimeline();
    audio.currentTime = 0;
    await startPlayback();
  }, [pausePlayback, resetPlaybackTimeline, startPlayback]);

  const skipPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    stopAnimationLoop();
    resetPlaybackTimeline();
    onSkip();
  }, [onSkip, resetPlaybackTimeline, stopAnimationLoop]);

  useEffect(() => {
    const previousOverflowMode = document.body.style.overflow;
    document.body.style.overflow = runtimeConfig.bodyOverflowMode;

    return () => {
      document.body.style.overflow = previousOverflowMode;
    };
  }, [runtimeConfig.bodyOverflowMode]);

  useEffect(() => {
    preloadUniqueImages(config.pictures ?? []);
  }, [config.pictures]);

  useEffect(() => {
    const updateViewportSize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateViewportSize();
    window.addEventListener("resize", updateViewportSize);

    return () => {
      window.removeEventListener("resize", updateViewportSize);
    };
  }, []);

  useEffect(() => {
    stopAnimationLoop();
    resetPlaybackTimeline();
    setNeedsUserGesture(false);
    setIsPlaying(false);
    setDurationSeconds(0);

    const audio = new Audio(config.sound_path);
    audio.preload = "auto";
    audioRef.current = audio;

    const handleEnded = () => {
      stopAnimationLoop();
      setIsPlaying(false);
      debugLog(debug, "ended");
      onComplete();
    };

    const handleLoadedMetadata = () => {
      const safeDurationSeconds = Number.isFinite(audio.duration) ? audio.duration : 0;
      setDurationSeconds(safeDurationSeconds);
      debugLog(debug, "duration", safeDurationSeconds);
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);

    void startPlayback();

    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.pause();
      audioRef.current = null;
      stopAnimationLoop();
    };
  }, [config.sound_path, debug, onComplete, resetPlaybackTimeline, startPlayback, stopAnimationLoop]);

  const displayedImageStyle = useMemo(
    () => getDisplayedImageStyle(displayedImagePaths.length, runtimeConfig),
    [displayedImagePaths.length, runtimeConfig],
  );

  const imageStageLayout = useMemo(
    () => getImageStageLayout(displayedImagePaths.length, viewportSize, runtimeConfig),
    [displayedImagePaths.length, runtimeConfig, viewportSize],
  );

  const progressPercentage = durationSeconds > 0 ? clampPercentage((currentTimeSeconds / durationSeconds) * 100) : 0;

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 overflow-hidden bg-white" style={{ touchAction: "manipulation" }}>
      <div className="position-relative w-100 h-100 d-flex align-items-center justify-content-center">
        <div style={imageStageLayout.gridStyle}>
          {displayedImagePaths.map((sourcePath, index) => (
            <div key={`${sourcePath}-${index}`} style={imageStageLayout.itemStyle}>
              <img
                src={sourcePath}
                alt=""
                style={{
                  ...displayedImageStyle,
                  ...imageStageLayout.imageStyle,
                }}
              />
            </div>
          ))}
        </div>

        <AutoplayOverlay
          isVisible={needsUserGesture}
          buttonLabel={runtimeConfig.autoplayPromptText}
          onResume={() => {
            void startPlayback();
          }}
        />

        <PlaybackControls
          isPlaying={isPlaying}
          playLabel={runtimeConfig.playButtonLabel}
          pauseLabel={runtimeConfig.pauseButtonLabel}
          restartLabel={runtimeConfig.restartButtonLabel}
          skipLabel={runtimeConfig.skipButtonLabel}
          onPlay={() => {
            void startPlayback();
          }}
          onPause={pausePlayback}
          onRestart={() => {
            void restartPlayback();
          }}
          onSkip={skipPlayback}
        />

        <PlaybackProgress progressPercentage={progressPercentage} heightPx={runtimeConfig.progressBarHeightPx} />
      </div>
    </div>
  );
}

export default SceneBuilder;
