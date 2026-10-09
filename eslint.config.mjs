import nextConfig from "eslint-config-next";

const config = [
  {
    ignores: [".glitch-build/**"],
  },
  ...nextConfig,
];

export default config;
