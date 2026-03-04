"use client";

import { useMemo } from "react";
import CategoryTestingController from "@/components/private/Controller";

type PageProps = {
  params: { categoryname: string };
  searchParams?: { sessionId?: string };
};

export default function Page({ params, searchParams }: PageProps) {
  const sessionId = useMemo(() => {
    const raw = searchParams?.sessionId;
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }, [searchParams?.sessionId]);

  const testedCategory = "street";

  return (
    <CategoryTestingController
      testedCategory={testedCategory}
      scenesConfigPath="/data/scene_config.json"
      questionnaireConfigPath={`/data/${testedCategory}.json`}
      storageType="database"
      sessionId={sessionId}
      debug
      // optional:
      // redirectTo="/dashboard/category"
      // sessionId={sessionId}
    />
  );
}
