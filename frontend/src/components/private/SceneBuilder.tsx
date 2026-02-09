"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export type DisplayType = "insert" | "add" | "remove_last_and_add" | "remove_all_and_add";

export type PictureEvent = {
  path: string;
  display_time: string | number; // "0:05" or 5
  display_type: DisplayType;
};

export type SceneConfig = {
  sound_path: string;
  pictures: PictureEvent[];
};

type NormalizedEvent = { path: string; t: number; type: DisplayType };

export type SceneBuilderProps = {
  config: SceneConfig;
  onComplete: () => void;
  onSkip: () => void;
  debug?: boolean;
};

function parseTimeToSeconds(v: string | number): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, v);
  const s = String(v).trim();
  if (!s) return 0;

  const parts = s.split(":").map((p) => p.trim());
  if (parts.some((p) => p === "" || !/^\d+$/.test(p))) return 0;
  const nums = parts.map(Number);

  if (nums.length === 1) return Math.max(0, nums[0]);
  if (nums.length === 2) return Math.max(0, nums[0] * 60 + nums[1]);

  const [h, m, sec] = nums.slice(-3);
  return Math.max(0, h * 3600 + m * 60 + sec);
}

function applyEvent(current: string[], ev: NormalizedEvent): string[] {
  switch (ev.type) {
    case "insert":
      return [ev.path];
    case "add":
      return [...current, ev.path];
    case "remove_last_and_add": {
      const next = current.slice(0, Math.max(0, current.length - 1));
      next.push(ev.path);
      return next;
    }
    case "remove_all_and_add":
      return [ev.path];
    default:
      return current;
  }
}

export default function SceneBuilder({ config, onComplete, onSkip, debug = false }: SceneBuilderProps) {
  const events = useMemo<NormalizedEvent[]>(() => {
    const normalized = (config.pictures ?? []).map((p) => ({
      path: p.path,
      t: parseTimeToSeconds(p.display_time),
      type: p.display_type,
    }));
    normalized.sort((a, b) => a.t - b.t);
    return normalized;
  }, [config]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const displayedRef = useRef<string[]>([]);
  const nextEventIndexRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(-1);

  const [displayed, setDisplayed] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const stopRaf = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const resetTimeline = () => {
    displayedRef.current = [];
    nextEventIndexRef.current = 0;
    lastTimeRef.current = -1;
    setDisplayed([]);
    setCurrentTime(0);
  };

  const step = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const t = audio.currentTime || 0;

    if (Math.abs(t - lastTimeRef.current) > 0.05) {
      lastTimeRef.current = t;
      setCurrentTime(t);
    }

    let idx = nextEventIndexRef.current;
    let list = displayedRef.current;

    while (idx < events.length && events[idx].t <= t + 0.01) {
      list = applyEvent(list, events[idx]);
      idx += 1;
    }

    if (idx !== nextEventIndexRef.current) {
      nextEventIndexRef.current = idx;
      displayedRef.current = list;
      setDisplayed(list);
      if (debug) console.log("[SceneBuilder] applied idx", idx, "t", t, "list", list);
    }

    if (!audio.paused && !audio.ended) rafRef.current = requestAnimationFrame(step);
  };

  const startRaf = () => {
    stopRaf();
    rafRef.current = requestAnimationFrame(step);
  };

  const tryPlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      await audio.play();
      setIsPlaying(true);
      setNeedsGesture(false);
      startRaf();
      if (debug) console.log("[SceneBuilder] playing");
    } catch (e) {
      setIsPlaying(false);
      setNeedsGesture(true);
      if (debug) console.log("[SceneBuilder] autoplay blocked", e);
    }
  };

  const pause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setIsPlaying(false);
    stopRaf();
    if (debug) console.log("[SceneBuilder] paused", audio.currentTime);
  };

  const restart = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    pause();
    resetTimeline();
    audio.currentTime = 0;
    await tryPlay();
  };

  const skip = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    stopRaf();
    resetTimeline();
    onSkip();
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const unique = Array.from(new Set((config.pictures ?? []).map((p) => p.path)));
    unique.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, [config]);

  useEffect(() => {
    stopRaf();
    resetTimeline();
    setNeedsGesture(false);
    setIsPlaying(false);
    setDuration(0);

    const audio = new Audio(config.sound_path);
    audio.preload = "auto";
    audioRef.current = audio;

    const onEnded = () => {
      stopRaf();
      setIsPlaying(false);
      if (debug) console.log("[SceneBuilder] ended");
      onComplete();
    };

    const onLoaded = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      if (debug) console.log("[SceneBuilder] duration", audio.duration);
    };

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("loadedmetadata", onLoaded);

    void tryPlay();

    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.pause();
      audioRef.current = null;
      stopRaf();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.sound_path, events, onComplete, debug]);

  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const count = displayed.length;
  const imgStyle: React.CSSProperties = {
    objectFit: "contain",
    userSelect: "none",
    pointerEvents: "none",
    maxHeight: count <= 1 ? "90vh" : count === 2 ? "80vh" : "70vh",
    maxWidth: count <= 1 ? "95vw" : count === 2 ? "48vw" : "32vw",
  };

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 overflow-hidden bg-white" style={{ touchAction: "manipulation" }}>
      <div className="position-relative w-100 h-100 d-flex align-items-center justify-content-center">
        {/* SIDE-BY-SIDE layout */}
        <div className="w-100 h-100 d-flex flex-wrap align-items-center justify-content-center gap-3 p-3">
          {displayed.map((src, i) => (
            <img key={`${src}-${i}`} src={src} alt="" style={imgStyle} />
          ))}
        </div>

        {/* Autoplay blocked overlay */}
        {needsGesture && (
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
            onClick={() => void tryPlay()}
          >
            <i className="bi bi-play-fill me-2" />
            Ťuknite pre spustenie
          </button>
        )}

        {/* Clean control bar */}
        <div className="position-absolute top-0 start-0 end-0 p-3 d-flex justify-content-center" style={{ zIndex: 40 }}>
          <div className="d-flex gap-2 bg-white rounded-3 shadow-sm border p-2">
            <button type="button" className="btn btn-primary" onClick={() => void tryPlay()} disabled={isPlaying} aria-label="Prehrať">
              <i className="bi bi-play-fill me-2" />
              Prehrať
            </button>

            <button type="button" className="btn btn-outline-primary" onClick={pause} disabled={!isPlaying} aria-label="Pozastaviť">
              <i className="bi bi-pause-fill me-2" />
              Pozastaviť
            </button>

            <button type="button" className="btn btn-outline-secondary" onClick={() => void restart()} aria-label="Reštart">
              <i className="bi bi-arrow-counterclockwise me-2" />
              Reštart
            </button>

            <button type="button" className="btn btn-outline-danger" onClick={skip} aria-label="Preskočiť">
              <i className="bi bi-skip-forward-fill me-2" />
              Preskočiť
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="position-absolute bottom-0 start-0 end-0 p-3" style={{ zIndex: 40 }}>
          <div className="progress" style={{ height: 10 }}>
            <div className="progress-bar" role="progressbar" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
