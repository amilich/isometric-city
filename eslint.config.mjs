import nextConfig from "eslint-config-next";

const config = [
  ...nextConfig,
  {
    // This repo uses refs/mutable simulation objects heavily for canvas-based games.
    // Keep these rules as warnings to avoid blocking iteration, while still surfacing issues.
    rules: {
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default config;
