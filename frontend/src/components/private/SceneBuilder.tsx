"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

export type DisplayType = "add" | "remove" | "remove_all_and_add" | "insert";

type SingleConfig = {
  picture_path: string;
  sound_path: string;
};

type MultiPictureItem = {
  path: string;
  display_time: string; // keep as string so JSON can be "00:05" etc.
  display_type: DisplayType;
};

type MultiConfig = {
  sound_path: string;
  pictures: MultiPictureItem[];
};

export type SceneConfig = SingleConfig | MultiConfig;

type SceneBuilderProps = {
  config: SceneConfig;
  next?: React.ReactNode;
  autoplay?: boolean;
  alt?: string;
  onEnded?: () => void;
  insertFallbackPath?: string;
  continueOnEnd?: boolean;
};

type Event = {
  at: number;
  path: string;
  type: DisplayType;
};

function parseTimeToSeconds(input: string): number {
  const s = (input ?? "").trim();
  if (!s) return 0;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.max(0, Number(s));

  const parts = s.split(":").map((p) => p.trim());
  if (parts.some((p) => p === "" || !/^\d+(\.\d+)?$/.test(p))) return 0;

  if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
  if (parts.length === 3) return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);

  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}

function isSingleConfig(c: SceneConfig): c is SingleConfig {
  return "picture_path" in c;
}

export default function SceneBuilder({
  config,
  next,
  autoplay = true,
  alt = "obrázok scény",
  onEnded,
  insertFallbackPath,
  continueOnEnd = true,
}: SceneBuilderProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { events, soundPath } = useMemo(() => {
    if (isSingleConfig(config)) {
      return {
        soundPath: config.sound_path,
        events: [{ at: 0, path: config.picture_path, type: "remove_all_and_add" as const }],
      };
    }

    const evs: Event[] = (config.pictures ?? [])
      .map((item) => ({
        at: parseTimeToSeconds(item.display_time),
        path: item.path,
        type: item.display_type,
      }))
      .sort((a, b) => a.at - b.at);

    return { soundPath: config.sound_path, events: evs };
  }, [config]);

  const [stack, setStack] = useState<string[]>([]);
  const [ended, setEnded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [runId, setRunId] = useState(0);
  const [continued, setContinued] = useState(false);

  const [dynamicFallback, setDynamicFallback] = useState<string | undefined>(insertFallbackPath);

  useEffect(() => {
    setDynamicFallback(insertFallbackPath);
  }, [insertFallbackPath]);

  const computeVisible = useCallback(
    (current: string[]) => (current.length > 0 ? current : dynamicFallback ? [dynamicFallback] : []),
    [dynamicFallback],
  );

  const restart = useCallback(
    (shouldAutoplay: boolean) => {
      setEnded(false);
      setContinued(false);
      setIsPlaying(shouldAutoplay);
      setRunId((x) => x + 1);

      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }

      setDynamicFallback(insertFallbackPath);

      let base: string[] = [];
      const zeroEvents = [...events].filter((e) => e.at <= 0);

      for (const ev of zeroEvents) {
        if (ev.type === "add") base = [...base, ev.path];
        else if (ev.type === "remove") base = [...base.slice(0, Math.max(0, base.length - 1)), ev.path];
        else if (ev.type === "remove_all_and_add") base = [ev.path];
        else if (ev.type === "insert") {
          setDynamicFallback(ev.path);
          if (base.length === 0) base = [ev.path];
        }
      }

      setStack(base);

      if (shouldAutoplay && audio) {
        audio
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    },
    [events, insertFallbackPath],
  );

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }, []);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    restart(autoplay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, soundPath]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let lastAppliedIndex = -1;

    const onTimeUpdate = () => {
      const t = audio.currentTime;

      while (lastAppliedIndex + 1 < events.length && events[lastAppliedIndex + 1].at <= t) {
        lastAppliedIndex++;
        const ev = events[lastAppliedIndex];

        if (ev.type === "insert") {
          setDynamicFallback(ev.path);
          setStack((prev) => (prev.length === 0 ? [ev.path] : prev));
          continue;
        }

        setStack((prev) => {
          if (ev.type === "add") return [...prev, ev.path];
          if (ev.type === "remove") {
            const trimmed = prev.slice(0, Math.max(0, prev.length - 1));
            return [...trimmed, ev.path];
          }
          return [ev.path];
        });
      }

      setStack((prev) => (prev.length === 0 && dynamicFallback ? [dynamicFallback] : prev));
    };

    const onAudioEnded = () => {
      setEnded(true);
      setIsPlaying(false);
      onEnded?.();
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onAudioEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onAudioEnded);
    };
  }, [events, dynamicFallback, onEnded, runId]);

  if (ended && next && continueOnEnd && continued) return <>{next}</>;
  if (ended && next && !continueOnEnd) return <>{next}</>;

  const visibleImages = computeVisible(stack);

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 bg-white" style={{ zIndex: 9999 }}>
      <div className="container-fluid h-100">
        <div className="row h-100 justify-content-center">
          <div className="col-12 d-flex flex-column align-items-center justify-content-center">
            <div className="d-flex flex-row justify-content-center align-items-center gap-3 flex-wrap">
              {visibleImages.map((src, idx) => (
                <div key={`${src}-${idx}`} className="position-relative" style={{ width: "min(420px, 90vw)", height: "min(420px, 70vh)" }}>
                  <Image src={src} alt={alt} fill sizes="(max-width: 768px) 90vw, 420px" priority={idx === 0} style={{ objectFit: "contain" }} />
                </div>
              ))}
            </div>

            <div className="mt-4 d-flex flex-wrap gap-2 justify-content-center">
              {!ended && (
                <>
                  <button type="button" className="btn btn-primary" onClick={isPlaying ? pause : play}>
                    {isPlaying ? "Pozastaviť" : "Prehrať"}
                  </button>

                  <button type="button" className="btn btn-outline-primary" onClick={() => restart(false)}>
                    Prehrať znova
                  </button>
                </>
              )}

              {ended && next && continueOnEnd && (
                <>
                  <button type="button" className="btn btn-success" onClick={() => setContinued(true)}>
                    Pokračovať
                  </button>
                  <button type="button" className="btn btn-outline-primary" onClick={() => restart(true)}>
                    Prehrať znova
                  </button>
                </>
              )}

              {ended && !next && (
                <button type="button" className="btn btn-outline-primary" onClick={() => restart(true)}>
                  Prehrať znova
                </button>
              )}
            </div>

            <audio ref={audioRef} src={soundPath} preload="auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
