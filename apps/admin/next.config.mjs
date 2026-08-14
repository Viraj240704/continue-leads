/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle for a small production container image.
  output: "standalone",
  // Keep development artifacts isolated from production builds. Sharing `.next`
  // lets a concurrent `next build` replace the dev server's module table.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  // The app lives in a pnpm monorepo; trace files from the workspace root.
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
  // Hide the floating Next.js dev-tools "N" indicator (dev only; never in production).
  devIndicators: false,
  // pg is a native/node dependency — keep it external to the server bundle.
  serverExternalPackages: ["pg", "bcryptjs", "@anthropic-ai/sdk", "@aws-sdk/client-s3"],
};

export default nextConfig;
