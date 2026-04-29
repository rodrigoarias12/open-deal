/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native deps + plugin SDKs with non-bundleable transitive deps
  // (e.g., openclaw → @napi-rs/canvas via the PDF extraction bundle).
  // Keeping them external means Vercel ships the original modules and
  // Node resolves them at runtime — what we want for server routes
  // that import the agent's plugin loader.
  serverExternalPackages: [
    "@anthropic-ai/sdk",
    "@anthropic-ai/bedrock-sdk",
    "@keeperhub/wallet",
    "ethers",
    "openclaw",
    "@napi-rs/canvas",
    "@0gfoundation/0g-ts-sdk",
    "typebox",
  ],
};

export default nextConfig;
