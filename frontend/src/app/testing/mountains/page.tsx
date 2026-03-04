"use client";

import CategoryTestingController from "@/components/private/Controller";

export default function Page() {
  return (
    <CategoryTestingController
      testedCategory="mountains"
      scenesConfigPath="/data/demo/scenes.json"
      questionnaireConfigPath="/data/demo/questions.json"
      storageType="database"
      debug
      // optional:
      // sessionId={8}
      // redirectTo="/dashboard/category"
    />
  );
}
