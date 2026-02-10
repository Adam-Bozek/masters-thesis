"use client";

import CategoryTestingController from "@/components/private/Controller";

export default function Page() {
  return (
    <CategoryTestingController
      testedCategory="marketplace"
      scenesConfigPath="/data/test/test2.json"
      questionnaireConfigPath="/data/test/test1.json"
      storageType="database"
      debug
      // optional:
      // sessionId={8}
      // redirectTo="/dashboard/category"
    />
  );
}
