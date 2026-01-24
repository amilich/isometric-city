const SVG_NS = 'http://www.w3.org/2000/svg';
const SOURCE_PARAM = new URLSearchParams(window.location.search).get('source');
const SOURCE_MODE = SOURCE_PARAM === 'local' ? 'local' : 'production';
const SOURCE_LABEL = SOURCE_MODE === 'local' ? 'Local' : 'Production';
const LOCAL_BASE_URL = 'http://localhost:3000';

const GAMES = [
  {
    id: 'city',
    name: 'IsoCity',
    productionUrl: 'https://iso-city.com',
    localPath: '/',
  },
  {
    id: 'coaster',
    name: 'IsoCoaster',
    productionUrl: 'https://iso-coaster.com',
    localPath: '/coaster',
  },
];

const paneRegistry = new Map();
const gameLookup = new Map(GAMES.map((game) => [game.id, game]));
const sidebarButtons = new Map();

let layoutRoot = null;
let activePaneId = null;

const sidebarRoot = document.getElementById('sidebar-games');
const paneRoot = document.getElementById('pane-root');

function createSvg(size = 20, strokeWidth = 1.6) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', String(strokeWidth));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  return svg;
}

function createHouseIcon(size = 18) {
  const svg = createSvg(size, 1.7);
  const roof = document.createElementNS(SVG_NS, 'path');
  roof.setAttribute('d', 'M3 11l9-7 9 7');
  const body = document.createElementNS(SVG_NS, 'path');
  body.setAttribute('d', 'M5 10v10h14V10');
  const door = document.createElementNS(SVG_NS, 'path');
  door.setAttribute('d', 'M10 20v-5h4v5');
  svg.append(roof, body, door);
  return svg;
}

function createRideIcon(size = 18) {
  const svg = createSvg(size, 1.6);
  const rim = document.createElementNS(SVG_NS, 'circle');
  rim.setAttribute('cx', '12');
  rim.setAttribute('cy', '12');
  rim.setAttribute('r', '7');
  const hub = document.createElementNS(SVG_NS, 'circle');
  hub.setAttribute('cx', '12');
  hub.setAttribute('cy', '12');
  hub.setAttribute('r', '1.5');
  const spokes = document.createElementNS(SVG_NS, 'path');
  spokes.setAttribute('d', 'M12 5v7M19 12h-7M12 19v-7M5 12h7');
  const base = document.createElementNS(SVG_NS, 'path');
  base.setAttribute('d', 'M6 20h12M8 20v-1M16 20v-1');
  svg.append(rim, hub, spokes, base);
  return svg;
}

function createSplitIcon(direction) {
  const svg = createSvg(16, 1.5);
  const frame = document.createElementNS(SVG_NS, 'rect');
  frame.setAttribute('x', '4');
  frame.setAttribute('y', '4');
  frame.setAttribute('width', '16');
  frame.setAttribute('height', '16');
  frame.setAttribute('rx', '2');
  const split = document.createElementNS(SVG_NS, 'path');
  split.setAttribute('d', direction === 'vertical' ? 'M12 4v16' : 'M4 12h16');
  svg.append(frame, split);
  return svg;
}

function createGameIcon(gameId, size) {
  if (gameId === 'city') return createHouseIcon(size);
  if (gameId === 'coaster') return createRideIcon(size);
  const fallback = createSvg(size, 1.6);
  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '12');
  circle.setAttribute('r', '8');
  fallback.append(circle);
  return fallback;
}

function resolveGameUrl(game) {
  if (SOURCE_MODE === 'local') {
    return `${LOCAL_BASE_URL}${game.localPath}`;
  }
  return game.productionUrl;
}

function createPaneId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `pane-${Math.random().toString(36).slice(2, 10)}`;
}

function updateSidebar() {
  const pane = activePaneId ? paneRegistry.get(activePaneId) : null;
  const activeGameId = pane?.activeGameId;
  sidebarButtons.forEach((button, gameId) => {
    button.classList.toggle('is-active', gameId === activeGameId);
  });
}

function setActivePane(paneId) {
  if (paneId === activePaneId) return;
  const previous = activePaneId ? paneRegistry.get(activePaneId) : null;
  if (previous) previous.element.classList.remove('is-active');
  activePaneId = paneId;
  const current = paneRegistry.get(activePaneId);
  if (current) current.element.classList.add('is-active');
  updateSidebar();
}

function updatePaneTitle(pane) {
  const game = gameLookup.get(pane.activeGameId);
  if (!game) return;
  pane.titleText.textContent = game.name;
  while (pane.titleIcon.firstChild) {
    pane.titleIcon.removeChild(pane.titleIcon.firstChild);
  }
  pane.titleIcon.appendChild(createGameIcon(game.id, 14));
}

function setPaneGame(paneId, gameId) {
  const pane = paneRegistry.get(paneId);
  if (!pane || pane.activeGameId === gameId) return;
  const nextFrame = pane.frames.get(gameId);
  if (!nextFrame) return;
  const previousFrame = pane.frames.get(pane.activeGameId);
  if (previousFrame) previousFrame.classList.add('is-hidden');
  nextFrame.classList.remove('is-hidden');
  pane.activeGameId = gameId;
  updatePaneTitle(pane);
  if (paneId === activePaneId) updateSidebar();
}

function createPane(initialGameId) {
  const paneId = createPaneId();
  const paneElement = document.createElement('section');
  paneElement.className = 'pane';
  paneElement.setAttribute('data-pane-id', paneId);
  paneElement.tabIndex = 0;
  paneElement.addEventListener('mousedown', () => setActivePane(paneId));
  paneElement.addEventListener('focusin', () => setActivePane(paneId));

  const header = document.createElement('header');
  header.className = 'pane-header';

  const title = document.createElement('div');
  title.className = 'pane-title';
  const titleIcon = document.createElement('span');
  titleIcon.appendChild(createGameIcon(initialGameId, 14));
  const titleText = document.createElement('span');
  title.append(titleIcon, titleText);

  const actions = document.createElement('div');
  actions.className = 'pane-actions';

  const splitVertical = document.createElement('button');
  splitVertical.type = 'button';
  splitVertical.className = 'pane-action';
  splitVertical.title = 'Split vertically';
  splitVertical.setAttribute('aria-label', 'Split vertically');
  splitVertical.appendChild(createSplitIcon('vertical'));
  splitVertical.addEventListener('click', (event) => {
    event.stopPropagation();
    splitPane(paneId, 'vertical');
  });

  const splitHorizontal = document.createElement('button');
  splitHorizontal.type = 'button';
  splitHorizontal.className = 'pane-action';
  splitHorizontal.title = 'Split horizontally';
  splitHorizontal.setAttribute('aria-label', 'Split horizontally');
  splitHorizontal.appendChild(createSplitIcon('horizontal'));
  splitHorizontal.addEventListener('click', (event) => {
    event.stopPropagation();
    splitPane(paneId, 'horizontal');
  });

  actions.append(splitVertical, splitHorizontal);
  header.append(title, actions);

  const content = document.createElement('div');
  content.className = 'pane-content';
  const frames = new Map();

  GAMES.forEach((game) => {
    const frame = document.createElement('iframe');
    frame.className = 'pane-frame';
    frame.setAttribute('title', `${game.name} pane`);
    frame.setAttribute('loading', 'eager');
    frame.setAttribute('allow', 'fullscreen; gamepad; clipboard-read; clipboard-write');
    frame.src = resolveGameUrl(game);
    if (game.id !== initialGameId) {
      frame.classList.add('is-hidden');
    }
    frames.set(game.id, frame);
    content.appendChild(frame);
  });

  const status = document.createElement('div');
  status.className = 'pane-status';
  status.textContent = SOURCE_LABEL;
  content.appendChild(status);

  paneElement.append(header, content);

  const pane = {
    id: paneId,
    activeGameId: initialGameId,
    element: paneElement,
    titleText,
    titleIcon,
    frames,
  };

  updatePaneTitle(pane);
  paneRegistry.set(paneId, pane);
  return paneId;
}

function renderNode(node) {
  if (node.type === 'pane') {
    const pane = paneRegistry.get(node.paneId);
    return pane ? pane.element : document.createElement('div');
  }
  const container = document.createElement('div');
  container.className = `split ${node.direction === 'vertical' ? 'is-vertical' : 'is-horizontal'}`;
  container.appendChild(renderNode(node.children[0]));
  container.appendChild(renderNode(node.children[1]));
  return container;
}

function renderLayout() {
  while (paneRoot.firstChild) {
    paneRoot.removeChild(paneRoot.firstChild);
  }
  if (!layoutRoot) return;
  paneRoot.appendChild(renderNode(layoutRoot));
}

function splitNode(node, paneId, direction) {
  if (node.type === 'pane' && node.paneId === paneId) {
    const pane = paneRegistry.get(paneId);
    const nextGameId = pane?.activeGameId ?? GAMES[0].id;
    const newPaneId = createPane(nextGameId);
    const newNode = {
      type: 'split',
      direction,
      children: [node, { type: 'pane', paneId: newPaneId }],
    };
    return { node: newNode, didSplit: true, newPaneId };
  }

  if (node.type === 'split') {
    for (let i = 0; i < node.children.length; i += 1) {
      const result = splitNode(node.children[i], paneId, direction);
      if (result.didSplit) {
        const newChildren = [...node.children];
        newChildren[i] = result.node;
        return {
          node: { ...node, children: newChildren },
          didSplit: true,
          newPaneId: result.newPaneId,
        };
      }
    }
  }

  return { node, didSplit: false };
}

function splitPane(paneId, direction) {
  if (!layoutRoot) return;
  const result = splitNode(layoutRoot, paneId, direction);
  if (!result.didSplit) return;
  layoutRoot = result.node;
  renderLayout();
  if (result.newPaneId) {
    setActivePane(result.newPaneId);
  }
}

function buildSidebar() {
  if (!sidebarRoot) return;
  GAMES.forEach((game) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sidebar__button';
    button.title = game.name;
    button.setAttribute('aria-label', `Switch to ${game.name}`);
    button.appendChild(createGameIcon(game.id, 20));
    button.addEventListener('click', () => {
      if (!activePaneId) return;
      setPaneGame(activePaneId, game.id);
    });
    sidebarButtons.set(game.id, button);
    sidebarRoot.appendChild(button);
  });
}

function init() {
  if (!paneRoot) return;
  buildSidebar();
  const initialPaneId = createPane(GAMES[0].id);
  layoutRoot = { type: 'pane', paneId: initialPaneId };
  renderLayout();
  setActivePane(initialPaneId);
}

init();
