#!/usr/bin/env node
import { deployGlitchGame } from './deploy-glitch-game.mjs';

deployGlitchGame('coaster', {
  deploy: process.argv.includes('--deploy'),
  wait: process.argv.includes('--wait'),
  skipBuild: process.argv.includes('--skip-build'),
  version: process.argv.find((arg) => arg.startsWith('--version='))?.split('=')[1],
}).catch((error) => {
  console.error(error);
  process.exit(1);
});

