// Centralized, typed environment access. Server-only.
function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  databaseUrl: req("DATABASE_URL", "postgresql://cl:cl_dev_password@localhost:15432/continue_leads"),
  sessionSecret: req("SESSION_SECRET", "dev-only-insecure-secret-change-me"),
  cookieSecure: (process.env.COOKIE_SECURE ?? "false") === "true",
  storageDriver: process.env.STORAGE_DRIVER ?? "local",
  storageRoot: process.env.STORAGE_ROOT ?? ".data/site-store",
  contentProvider: process.env.CONTENT_PROVIDER ?? "mock",
  embeddingsDriver: process.env.EMBEDDINGS_DRIVER ?? "local",
  embeddingDim: Number(process.env.EMBEDDING_DIM ?? "256"),

  // Real provider credentials (used when the matching driver is selected)
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  claudeModel: process.env.CLAUDE_MODEL ?? "claude-sonnet-5",
  claudeMaxTokens: Number(process.env.CLAUDE_MAX_TOKENS ?? "3000"),
  voyageApiKey: process.env.VOYAGE_API_KEY ?? "",
  voyageModel: process.env.VOYAGE_MODEL ?? "voyage-3-lite",
  awsRegion: process.env.AWS_REGION ?? "us-east-1",
  s3Bucket: process.env.S3_BUCKET ?? "",
  cloudfrontDistributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID ?? "",
  sentryDsn: process.env.SENTRY_DSN ?? "",
  similarityBlock: Number(process.env.SIMILARITY_BLOCK ?? "0.85"),
  similarityWarn: Number(process.env.SIMILARITY_WARN ?? "0.75"),
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000",
};
