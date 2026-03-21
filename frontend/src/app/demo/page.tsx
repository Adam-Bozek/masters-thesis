"use client";

import { CategoryTestingController } from "@/components/private/Controller";

export default function Page() {
  return (
    <CategoryTestingController
      testedCategory="marketplace"
      scenesConfigPath="/data/demo/scenes.json"
      questionnaireConfigPath="/data/demo/questions.json"
      storageType="memory"
      redirectTo="/"
    />
  );
}
