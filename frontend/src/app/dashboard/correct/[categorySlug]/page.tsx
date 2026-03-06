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
