#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGlitchArtifact, parseGameKey } from './build-glitch-artifact.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function deployGlitchGame(gameKey, options = {}) {
  const { artifactDir, version, title } = await buildGlitchArtifact(gameKey, {
    skipBuild: options.skipBuild,
    version: options.version,
    buildType: options.buildType,
  });

  const deployToken = process.env[title.deployTokenEnv] || process.env.GLITCH_TITLE_TOKEN;
  if (!deployToken) {
    throw new Error(`Missing ${title.deployTokenEnv}. Deploy tokens are intentionally not stored in this repository.`);
  }

  const commonArgs = [
    'deploy',
    artifactDir,
    '--title', title.titleId,
    '--token', deployToken,
    '--version', version,
    '--entry', 'server.js',
    '--type', 'node',
    '--build-type', options.buildType || 'production',
  ];

  run(path.join(ROOT, 'node_modules', '.bin', 'glitch-deploy'), [...commonArgs, '--dry-run']);

  if (!options.deploy) {
    console.log(`Dry run passed for ${title.titleName}. Re-run with --deploy to upload.`);
    return;
  }

  const deployArgs = options.wait ? [...commonArgs, '--wait'] : commonArgs;
  run(path.join(ROOT, 'node_modules', '.bin', 'glitch-deploy'), deployArgs);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}.`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const gameKey = parseGameKey(process.argv[2] || 'isocity');
  deployGlitchGame(gameKey, {
    deploy: process.argv.includes('--deploy'),
    wait: process.argv.includes('--wait'),
    skipBuild: process.argv.includes('--skip-build'),
    version: process.argv.find((arg) => arg.startsWith('--version='))?.split('=')[1],
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

