/**
 * @ Author: Bc. Adam Božek
 * @ Create Time: 2026-03-03 09:48:59
 * @ Description: This repository contains a full-stack application suite developed within a master’s thesis.
		 It is designed to support the screening of children using the Slovak
		 implementation of the TEKOS II screening instrument, short version. Copyright (C) 2026  Bc. Adam Božek
 * @ License: This program is free software: you can redistribute it and/or modify it under the terms of
		 the GNU Affero General Public License as published by the Free Software Foundation, either
		 version 3 of the License, or any later version. This program is distributed in the hope
		 that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty
		 of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
		 See the GNU Affero General Public License for more details.
		 You should have received a copy of the GNU Affero General Public License along with this program.
		 If not, see <https://www.gnu.org/licenses/>..
 */

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

  const testedCategory = "zoo";

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
