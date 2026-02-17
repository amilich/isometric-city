import nextConfig from "eslint-config-next";

const config = [
  ...nextConfig,
  {
    rules: {
      // This repo intentionally uses some state-in-effect patterns in game systems.
      // Keep them as warnings so lint doesn't block development/CI.
      'react-hooks/set-state-in-effect': 'warn',
      // Many simulation/render loops mutate ref-backed objects for performance.
      // Treat as warnings to avoid fighting the architecture.
      'react-hooks/immutability': 'warn',
      // The game loops commonly sync refs during render for perf; don't block lint.
      'react-hooks/refs': 'warn',
    },
  },
];

export default config;
