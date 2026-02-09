/*"use client";

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
*/
/*
"use client";

import { useState } from "react";
import Phase3Testing from "@/components/private/Phase3Testing";

export default function Page() {
  const [incorrect, setIncorrect] = useState<any[]>([]);

  return (
    <Phase3Testing
      questionnaireConfigPath="/data/test/test1.json"
      categoryId={1}
      sessionId={2}
      storageType="database"
      onComplete={(incorrectQuestions) => {
        console.log("Phase 3 done. Incorrect for next phase:", incorrectQuestions);
        setIncorrect(incorrectQuestions);
      }}
    />
  );
}
*/

"use client";

import React, { useState } from "react";
import Phase3Testing from "@/components/private/Phase3Testing";
import Phase5Testing from "@/components/private/Phase5Testing";

export default function Phase3To5Flow() {
  const [phase, setPhase] = useState<3 | 5>(3);
  const [wrongQuestions, setWrongQuestions] = useState<any[]>([]);

  const storageType = "database" as const; // or "local_storage"
  const categoryId = 1;
  const sessionId = 8; // required for database mode

  if (phase === 3) {
    return (
      <Phase3Testing
        questionnaireConfigPath="/data/test/test1.json"
        categoryId={categoryId}
        storageType={storageType}
        sessionId={storageType === "database" ? sessionId : undefined}
        onComplete={(incorrect) => {
          setWrongQuestions(incorrect);
          setPhase(5);
        }}
      />
    );
  }

  return (
    <Phase5Testing
      wrongQuestions={wrongQuestions}
      categoryId={categoryId}
      storageType={storageType}
      sessionId={storageType === "database" ? sessionId : undefined}
      onComplete={() => {
        // optional: route / show "done"
      }}
    />
  );
}
