/**
 * @ Author: Bc. Adam Božek
 * @ Create Time: 2026-03-06 23:28:04
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

import CategoryAnswersEditor from "@/components/private/CategoryAnswersEditor";

const CONFIG_PATHS: Record<string, string> = {
  marketplace: "/data/marketplace.json",
  mountains: "/data/mountains.json",
  zoo: "/data/zoo.json",
  street: "/data/street.json",
  home: "/data/home.json",
};

type PageProps = {
  params: Promise<{
    categorySlug: string;
  }>;
  searchParams: Promise<{
    sessionId?: string;
    categoryId?: string;
  }>;
};

export default async function CorrectionPage({ params, searchParams }: PageProps) {
  const { categorySlug } = await params;
  const { sessionId: rawSessionId, categoryId: rawCategoryId } = await searchParams;

  const sessionId = Number(rawSessionId);
  const categoryId = Number(rawCategoryId);
  const configPath = CONFIG_PATHS[String(categorySlug).toLowerCase()];

  if (!Number.isFinite(sessionId) || !Number.isFinite(categoryId) || !configPath) {
    return <div className="container py-4">Neplatné údaje opravy.</div>;
  }

  return <CategoryAnswersEditor configPath={configPath} sessionId={sessionId} categoryId={categoryId} />;
}
