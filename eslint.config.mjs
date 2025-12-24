import nextConfig from "eslint-config-next";

const config = [...nextConfig];

// This codebase intentionally uses mutable refs/objects in game loops for performance.
// Next's React Compiler / react-hooks lint rules flag these patterns as errors, but
// ref-based mutation is the desired approach here.
config.push({
  rules: {
    "react-hooks/immutability": "off",
    "react-hooks/preserve-manual-memoization": "off",
  },
});

export default config;
