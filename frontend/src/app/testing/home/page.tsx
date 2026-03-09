"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import withAuth from "@/utilities/WithAuth";
import CategoryTestingController from "@/components/private/Controller";

function Page() {
  const searchParams = useSearchParams();

  const sessionId = useMemo(() => {
    const raw = searchParams.get("sessionId");
    if (!raw) return undefined;

    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }, [searchParams]);

  const testedCategory = "home";

  return (
    <CategoryTestingController
      testedCategory={testedCategory}
      scenesConfigPath="/data/scene_config.json"
      questionnaireConfigPath={`/data/${testedCategory}.json`}
      storageType="database"
      debug
      sessionId={sessionId}
    />
  );
}

export default withAuth(Page);
