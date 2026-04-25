/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    "@anthropic-ai/sdk",
    "@anthropic-ai/bedrock-sdk",
    "@keeperhub/wallet",
    "ethers",
  ],
};

export default nextConfig;
