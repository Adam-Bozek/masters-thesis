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

  const progressPercentage = durationSeconds > 0 ? clampPercentage((currentTimeSeconds / durationSeconds) * 100) : 0;

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 overflow-hidden bg-white" style={{ touchAction: "manipulation" }}>
      <div className="position-relative w-100 h-100 d-flex align-items-center justify-content-center">
        <div className="w-100 h-100 d-flex flex-wrap align-items-center justify-content-center gap-3 p-3">
          {displayedImagePaths.map((sourcePath, index) => (
            <img key={`${sourcePath}-${index}`} src={sourcePath} alt="" style={displayedImageStyle} />
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
