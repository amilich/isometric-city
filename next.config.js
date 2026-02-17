const { withGTConfig } = require("gt-next/config");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  reactCompiler: true,
  // PERF: Strip console.log in production (keeps error/warn)
  ...(process.env.NODE_ENV === 'production' && {
    compiler: { removeConsole: { exclude: ['error', 'warn'] } },
  }),
};

module.exports = withGTConfig(nextConfig);