"use client";

import React, { useMemo, useState } from "react";
import SceneBuilder, { SceneConfig } from "../../components/private/SceneBuilder";

export default function Page() {
  const scenes = useMemo<SceneConfig[]>(
    () => [
      {
        sound_path: "/sounds/1.mp3",
        pictures: [
          { path: "/images/testing/marketplace/scenes/game_intro_1.gif", display_time: "0:00", display_type: "insert" },
          { path: "/images/testing/marketplace/scenes/game_intro_2.gif", display_time: "0:05", display_type: "remove_all_and_add" },
          { path: "/images/testing/marketplace/scenes/game_intro_3.jpg", display_time: "0:10", display_type: "add" },
          { path: "/images/testing/marketplace/scenes/game_intro_4.jpg", display_time: "0:15", display_type: "add" },
        ],
      },
    ],
    [],
  );

  const [idx, setIdx] = useState(0);

  if (idx >= scenes.length) {
    return (
      <div className="p-4">
        <h1>Scenes finished</h1>
      </div>
    );
  }

  return <SceneBuilder config={scenes[idx]} onComplete={() => setIdx((v) => v + 1)} onSkip={() => setIdx((v) => v + 1)} debug />;
}
