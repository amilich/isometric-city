#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_ROOT = path.join(ROOT, '.glitch-build');

export const TITLES = {
  isocity: {
    titleId: 'ed2b4375-3918-4916-8736-aae299226363',
    titleName: 'IsoCity',
    deployTokenEnv: 'GLITCH_ISOCITY_DEPLOY_TOKEN',
    runtimeTokenEnv: 'GLITCH_ISOCITY_TITLE_TOKEN',
    publicRuntimeTokenEnv: 'NEXT_PUBLIC_GLITCH_ISOCITY_TITLE_TOKEN',
  },
  coaster: {
    titleId: 'e51bcfd1-ffda-4038-b124-b4cb090fb8a7',
    titleName: 'IsoCoaster',
    deployTokenEnv: 'GLITCH_COASTER_DEPLOY_TOKEN',
    runtimeTokenEnv: 'GLITCH_COASTER_TITLE_TOKEN',
    publicRuntimeTokenEnv: 'NEXT_PUBLIC_GLITCH_COASTER_TITLE_TOKEN',
  },
};

export function parseGameKey(value) {
  if (value === 'isocity' || value === 'city') return 'isocity';
  if (value === 'coaster' || value === 'isocoaster' || value === 'rollercoaster') return 'coaster';
  throw new Error(`Unknown Glitch game key "${value}". Use "isocity" or "coaster".`);
}

export function buildVersion() {
  const packageJson = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const now = new Date();
  const stamp = [
    String(now.getUTCFullYear()).slice(2),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    String(now.getUTCHours()).padStart(2, '0'),
    String(now.getUTCMinutes()).padStart(2, '0'),
  ].join('');
  return `${packageJson.version}-${stamp}`.slice(0, 20);
}

export async function buildGlitchArtifact(gameKey, options = {}) {
  const title = TITLES[gameKey];
  if (!title) throw new Error(`No Glitch title config for ${gameKey}.`);

  const version = options.version || buildVersion();
  const artifactDir = path.join(DIST_ROOT, gameKey);
  const runtimeToken = process.env[title.publicRuntimeTokenEnv] || process.env[title.runtimeTokenEnv] || '';
  const isocityRuntimeToken = process.env.NEXT_PUBLIC_GLITCH_ISOCITY_TITLE_TOKEN || process.env.GLITCH_ISOCITY_TITLE_TOKEN || '';
  const coasterRuntimeToken = process.env.NEXT_PUBLIC_GLITCH_COASTER_TITLE_TOKEN || process.env.GLITCH_COASTER_TITLE_TOKEN || '';
  const buildEnv = {
    ...process.env,
    NEXT_PUBLIC_GLITCH_ENABLED: '1',
    NEXT_PUBLIC_GLITCH_GAME_KEY: gameKey,
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_GLITCH_ISOCITY_TITLE_ID: TITLES.isocity.titleId,
    NEXT_PUBLIC_GLITCH_COASTER_TITLE_ID: TITLES.coaster.titleId,
    NEXT_PUBLIC_GLITCH_ISOCITY_TITLE_TOKEN: isocityRuntimeToken,
    NEXT_PUBLIC_GLITCH_COASTER_TITLE_TOKEN: coasterRuntimeToken,
    [title.publicRuntimeTokenEnv]: runtimeToken,
  };

  if (!options.skipBuild) {
    run('npm', ['run', 'build'], { env: buildEnv });
  }

  await rm(artifactDir, { recursive: true, force: true });
  await mkdir(artifactDir, { recursive: true });
  const standaloneRoot = await findStandaloneServerRoot(path.join(ROOT, '.next', 'standalone'));
  await cp(standaloneRoot, artifactDir, { recursive: true });
  await cp(path.join(ROOT, 'package-lock.json'), path.join(artifactDir, 'package-lock.json'));
  await mkdir(path.join(artifactDir, '.next'), { recursive: true });
  await cp(path.join(ROOT, '.next', 'static'), path.join(artifactDir, '.next', 'static'), { recursive: true });
  await cp(path.join(ROOT, 'public'), path.join(artifactDir, 'public'), { recursive: true });
  await writeFile(path.join(artifactDir, 'Dockerfile'), [
    'FROM node:20-alpine',
    'WORKDIR /app',
    'ENV NODE_ENV=production',
    'ENV NEXT_TELEMETRY_DISABLED=1',
    'ENV HOSTNAME=0.0.0.0',
    'ENV PORT=3000',
    'COPY . .',
    'RUN rm -rf node_modules && npm ci --omit=dev',
    'EXPOSE 3000',
    'CMD ["node", "server.js"]',
    '',
  ].join('\n'));

  await writeFile(path.join(artifactDir, 'glitch.deploy.json'), JSON.stringify({
    title_id: title.titleId,
    version,
    entry_point: 'server.js',
    deployment_type: 'node',
    build_type: options.buildType || 'production',
    custom_variables: {
      dockerfile: 'Dockerfile',
      build_context: '.',
      game_key: gameKey,
      next_standalone: true,
      runtime: 'next',
      target_port: 3000,
    },
  }, null, 2));

  return { artifactDir, version, title };
}

async function findStandaloneServerRoot(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  if (entries.some((entry) => entry.isFile() && entry.name === 'server.js')) {
    return directory;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const found = await findStandaloneServerRoot(path.join(directory, entry.name)).catch(() => null);
    if (found) return found;
  }
  throw new Error(`Could not find server.js under ${directory}.`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}.`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const gameKey = parseGameKey(process.argv[2] || 'isocity');
  const skipBuild = process.argv.includes('--skip-build');
  const versionArg = process.argv.find((arg) => arg.startsWith('--version='));
  buildGlitchArtifact(gameKey, {
    skipBuild,
    version: versionArg?.split('=')[1],
  }).then(({ artifactDir, version }) => {
    console.log(`Built ${gameKey} Glitch artifact ${version}: ${artifactDir}`);
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
