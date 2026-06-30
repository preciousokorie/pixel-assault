'use strict';

// ─── CONSTANTS & COLORS ───────────────────────────────────────────────────────

const W = 800, H = 600;

const C = {
  BG:          '#0a0a0f',
  GRID:        '#0f1520',
  PLR_BODY:    '#3399ff',
  PLR_DIM:     '#1155aa',
  PLR_HI:      '#66bbff',
  PLR_GUN:     '#999999',
  PLR_GUN2:    '#666666',
  PLR_BULL:    '#ffff44',
  ENM_BULL:    '#ff2255',
  HUD_GREEN:   '#33ff88',
  HUD_YEL:     '#ffcc00',
  HUD_RED:     '#ff3333',
  HUD_TEXT:    '#ccffcc',
  HUD_SCORE:   '#ffff88',
};

const ENEMY_CONFIG = {
  grunt: {
    radius: 12, speed: 85, hp: 1, score: 10,
    bodyColor: '#cc2222', innerColor: '#882222', size: 24, eyeColor: '#ff8888'
  },
  runner: {
    radius: 9, speed: 170, hp: 1, score: 25,
    bodyColor: '#ff8800', innerColor: '#cc5500', size: 18, eyeColor: '#ffcc88'
  },
  tank: {
    radius: 18, speed: 42, hp: 5, score: 50,
    bodyColor: '#881199', innerColor: '#553366', size: 36, eyeColor: '#ee88ff'
  },
  shooter: {
    radius: 12, speed: 60, hp: 2, score: 35,
    bodyColor: '#009999', innerColor: '#006666', size: 24, eyeColor: '#88ffff',
    shootRange: 220, shootRate: 2.0
  }
};

// ─── CANVAS SETUP ─────────────────────────────────────────────────────────────

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
canvas.width  = W;
canvas.height = H;

// ─── INPUT ────────────────────────────────────────────────────────────────────

const keys  = {};
const mouse = { x: W / 2, y: H / 2, pressed: false, clicked: false };

document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  if (e.code === 'Enter' && gameState === 'LEVEL_TRANSITION' && transitionTimer > 1.5) nextLevel();
  if ((e.code === 'KeyR' || e.code === 'Enter') && gameState === 'GAME_OVER') gameState = 'MENU';
});
document.addEventListener('keyup',   e => { keys[e.code] = false; });

canvas.addEventListener('mousemove', e => {
  const r  = canvas.getBoundingClientRect();
  mouse.x  = (e.clientX - r.left) * (W / r.width);
  mouse.y  = (e.clientY - r.top)  * (H / r.height);
});
canvas.addEventListener('mousedown', e => {
  if (e.button === 0) { mouse.pressed = true; mouse.clicked = true; }
});
canvas.addEventListener('mouseup', e => {
  if (e.button === 0) mouse.pressed = false;
});

// ─── AUDIO ────────────────────────────────────────────────────────────────────

let audioCtx = null;

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playSound(freq, type, duration, vol = 0.2) {
  if (!audioCtx) return;
  try {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (_) {}
}

// ─── CLASSES ──────────────────────────────────────────────────────────────────

class Player {
  constructor() {
    this.x           = W / 2;
    this.y           = H / 2;
    this.radius      = 14;
    this.speed       = 210;
    this.hp          = 100;
    this.maxHp       = 100;
    this.angle       = 0;
    this.shootCooldown = 0;
    this.shootRate   = 0.18;
    this.invincible  = 0;
  }

  update(dt) {
    let dx = 0, dy = 0;
    if (keys['ArrowLeft']  || keys['KeyA']) dx -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) dx += 1;
    if (keys['ArrowUp']    || keys['KeyW']) dy -= 1;
    if (keys['ArrowDown']  || keys['KeyS']) dy += 1;

    if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }

    this.x = Math.max(this.radius, Math.min(W - this.radius, this.x + dx * this.speed * dt));
    this.y = Math.max(this.radius, Math.min(H - this.radius, this.y + dy * this.speed * dt));

    this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);

    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if (mouse.pressed && this.shootCooldown === 0) {
      const gx = this.x + Math.cos(this.angle) * 20;
      const gy = this.y + Math.sin(this.angle) * 20;
      bullets.push(new Bullet(gx, gy, this.angle, 'player'));
      spawnMuzzleFlash(gx, gy, this.angle);
      this.shootCooldown = this.shootRate;
      playSound(780, 'square', 0.055, 0.12);
    }

    if (this.invincible > 0) this.invincible -= dt;
  }

  takeDamage(amount) {
    if (this.invincible > 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this.invincible = 1.0;
    triggerShake(9, 0.28);
    playSound(110, 'sine', 0.35, 0.3);
    if (this.hp <= 0) gameOver();
  }

  draw() {
    if (this.invincible > 0 && Math.floor(this.invincible * 10) % 2 === 0) return;
    const x = this.x, y = this.y;

    // Body
    ctx.fillStyle = C.PLR_BODY;
    ctx.fillRect(x - 10, y - 10, 20, 20);
    // Shadow stripe (lower depth)
    ctx.fillStyle = C.PLR_DIM;
    ctx.fillRect(x - 8, y + 4, 16, 6);
    // Highlight (top-left corner)
    ctx.fillStyle = C.PLR_HI;
    ctx.fillRect(x - 8, y - 8, 7, 3);
    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 5, y - 4, 3, 3);
    ctx.fillRect(x + 2, y - 4, 3, 3);
    ctx.fillStyle = '#001133';
    ctx.fillRect(x - 4, y - 3, 2, 2);
    ctx.fillRect(x + 3, y - 3, 2, 2);

    // Rotating gun arm
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.angle);
    ctx.fillStyle = C.PLR_GUN;
    ctx.fillRect(8, -3, 14, 6);
    ctx.fillStyle = C.PLR_GUN2;
    ctx.fillRect(8, -3, 13, 2);
    ctx.restore();
  }
}

class Enemy {
  constructor(x, y, type) {
    const cfg        = ENEMY_CONFIG[type];
    this.x           = x;
    this.y           = y;
    this.type        = type;
    this.radius      = cfg.radius;
    this.speed       = cfg.speed;
    this.hp          = cfg.hp;
    this.maxHp       = cfg.hp;
    this.score       = cfg.score;
    this.bodyColor   = cfg.bodyColor;
    this.innerColor  = cfg.innerColor;
    this.size        = cfg.size;
    this.eyeColor    = cfg.eyeColor;
    this.dead        = false;
    this.hitFlash    = 0;
    this.zigzagAngle = Math.random() * Math.PI * 2;
    this.vx          = 0;
    this.vy          = 0;
    this.gunAngle    = 0;
    this.shootTimer  = cfg.shootRate  || 0;
    this.shootRange  = cfg.shootRange || 0;
    this.shootRate   = cfg.shootRate  || 0;
  }

  update(dt) {
    if (!player) return;
    const dx    = player.x - this.x;
    const dy    = player.y - this.y;
    const dist  = Math.hypot(dx, dy) || 1;
    const angle = Math.atan2(dy, dx);

    if (this.type === 'grunt') {
      this.x += Math.cos(angle) * this.speed * dt;
      this.y += Math.sin(angle) * this.speed * dt;
    } else if (this.type === 'runner') {
      this.zigzagAngle += dt * 4.5;
      const perp   = angle + Math.PI / 2;
      const zigzag = Math.sin(this.zigzagAngle) * 55;
      this.vx = Math.cos(angle) * this.speed + Math.cos(perp) * zigzag;
      this.vy = Math.sin(angle) * this.speed + Math.sin(perp) * zigzag;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    } else if (this.type === 'tank') {
      this.x += Math.cos(angle) * this.speed * dt;
      this.y += Math.sin(angle) * this.speed * dt;
    } else if (this.type === 'shooter') {
      this.gunAngle = angle;
      if (dist > this.shootRange) {
        this.x += Math.cos(angle) * this.speed * dt;
        this.y += Math.sin(angle) * this.speed * dt;
      } else {
        this.shootTimer -= dt;
        if (this.shootTimer <= 0) {
          const bx = this.x + Math.cos(angle) * (this.size / 2 + 4);
          const by = this.y + Math.sin(angle) * (this.size / 2 + 4);
          bullets.push(new Bullet(bx, by, angle, 'enemy'));
          this.shootTimer = this.shootRate;
          playSound(280, 'sawtooth', 0.08, 0.1);
        }
      }
    }

    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.hitFlash = 0.1;
    if (this.hp <= 0) {
      this.dead = true;
      score += this.score;
      spawnDeathExplosion(this.x, this.y, this.type);
      playSound(180, 'sawtooth', 0.18, 0.18);
    }
  }

  draw() {
    const x = this.x, y = this.y, s = this.size, half = s / 2;
    const flash = this.hitFlash > 0;

    // Outer body
    ctx.fillStyle = flash ? '#ffffff' : this.bodyColor;
    ctx.fillRect(x - half, y - half, s, s);

    // Inner body
    ctx.fillStyle = flash ? this.bodyColor : this.innerColor;
    const inset = this.type === 'tank' ? 4 : 3;
    ctx.fillRect(x - half + inset, y - half + inset, s - inset * 2, s - inset * 2);

    // Eyes
    const eSz  = this.type === 'tank' ? 5 : 3;
    const eOff = this.type === 'tank' ? 7 : 5;
    ctx.fillStyle = this.eyeColor;
    ctx.fillRect(x - eOff, y - half + inset + 2, eSz, eSz);
    ctx.fillRect(x + eOff - eSz, y - half + inset + 2, eSz, eSz);

    // Runner trailing speed lines
    if (this.type === 'runner') {
      const spd = Math.hypot(this.vx, this.vy);
      if (spd > 1) {
        ctx.save();
        const nx = -this.vx / spd, ny = -this.vy / spd;
        ctx.strokeStyle = this.innerColor;
        for (let i = 0; i < 3; i++) {
          const len = 6 + i * 5;
          ctx.globalAlpha = 0.5 - i * 0.13;
          ctx.lineWidth = 1.5 - i * 0.4;
          ctx.beginPath();
          ctx.moveTo(x + nx * (half + 1 + i * 2), y + ny * (half + 1 + i * 2));
          ctx.lineTo(x + nx * (half + 1 + i * 2 + len), y + ny * (half + 1 + i * 2 + len));
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Tank HP bar
    if (this.type === 'tank') {
      const bx = x - half, by = y - half - 9;
      ctx.fillStyle = '#222';
      ctx.fillRect(bx, by, s, 5);
      ctx.fillStyle = this.hp > this.maxHp * 0.5 ? C.HUD_GREEN : C.HUD_RED;
      ctx.fillRect(bx, by, s * (this.hp / this.maxHp), 5);
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, s, 5);
    }

    // Shooter gun barrel
    if (this.type === 'shooter') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.gunAngle);
      ctx.fillStyle = '#447777';
      ctx.fillRect(half - 2, -2, 10, 4);
      ctx.restore();
    }
  }
}

class Bullet {
  constructor(x, y, angle, owner) {
    this.x      = x;
    this.y      = y;
    this.owner  = owner;
    const spd   = owner === 'player' ? 440 : 195;
    this.vx     = Math.cos(angle) * spd;
    this.vy     = Math.sin(angle) * spd;
    this.radius = owner === 'player' ? 4 : 5;
    this.damage = owner === 'player' ? 1 : 20;
    this.color  = owner === 'player' ? C.PLR_BULL : C.ENM_BULL;
    this.dead   = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < -25 || this.x > W + 25 || this.y < -25 || this.y > H + 25) this.dead = true;
  }

  draw() {
    // Glow halo
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
    ctx.fillStyle = this.color + '33';
    ctx.fill();
    // Core
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    // Bright center
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
}

class Particle {
  constructor(x, y, vx, vy, color, life, size) {
    this.x       = x;
    this.y       = y;
    this.vx      = vx;
    this.vy      = vy;
    this.color   = color;
    this.life    = life;
    this.maxLife = life;
    this.size    = size;
    this.dead    = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    const f  = Math.pow(0.9, dt * 60);
    this.vx *= f;
    this.vy *= f;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  draw() {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = this.color;
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

// ─── LEVEL DATA ───────────────────────────────────────────────────────────────

const LEVELS = [
  { waves: [
    { type: 'grunt', count: 5, interval: 2.0 }
  ]},
  { waves: [
    { type: 'grunt',  count: 6, interval: 1.5 },
    { type: 'runner', count: 4, interval: 1.0 }
  ]},
  { waves: [
    { type: 'grunt',  count: 8,  interval: 1.2 },
    { type: 'runner', count: 5,  interval: 0.8 },
    { type: 'tank',   count: 2,  interval: 3.5 }
  ]},
  { waves: [
    { type: 'grunt',   count: 8,  interval: 1.0 },
    { type: 'shooter', count: 3,  interval: 2.5 },
    { type: 'runner',  count: 6,  interval: 0.7 },
    { type: 'tank',    count: 2,  interval: 3.0 }
  ]},
  { waves: [
    { type: 'runner',  count: 10, interval: 0.5 },
    { type: 'grunt',   count: 12, interval: 0.8 },
    { type: 'shooter', count: 4,  interval: 2.0 },
    { type: 'tank',    count: 3,  interval: 2.5 }
  ]},
  { waves: [
    { type: 'shooter', count: 5,  interval: 1.8 },
    { type: 'runner',  count: 12, interval: 0.4 },
    { type: 'tank',    count: 5,  interval: 2.2 },
    { type: 'grunt',   count: 15, interval: 0.6 }
  ]}
];

function generateLevel(n) {
  const s = n - 6;
  return { waves: [
    { type: 'grunt',   count: 10 + s * 3,  interval: Math.max(0.28, 0.8  - s * 0.05) },
    { type: 'runner',  count: 8  + s * 2,  interval: Math.max(0.2,  0.5  - s * 0.03) },
    { type: 'tank',    count: 3  + s,       interval: Math.max(1.0,  2.5  - s * 0.1)  },
    { type: 'shooter', count: 4  + s,       interval: Math.max(0.9,  2.0  - s * 0.1)  }
  ]};
}

function getLevelData(n) {
  return n <= LEVELS.length ? LEVELS[n - 1] : generateLevel(n);
}

function buildSpawnQueue(levelData) {
  const pools = levelData.waves.map(w =>
    Array.from({ length: w.count }, () => ({ type: w.type, interval: w.interval }))
  );
  const result = [];
  let any = true;
  while (any) {
    any = false;
    for (const pool of pools) {
      if (pool.length > 0) { result.push(pool.shift()); any = true; }
    }
  }
  return result;
}

// ─── GAME STATE ───────────────────────────────────────────────────────────────

let gameState      = 'MENU';
let player         = null;
let enemies        = [];
let bullets        = [];
let particles      = [];
let score          = 0;
let level          = 1;
let hiScore        = parseInt(localStorage.getItem('pixelAssaultHi') || '0', 10);
let spawnQueue     = [];
let spawnTimer     = 0;
let shakeTime      = 0;
let shakeIntensity = 0;
let transitionTimer = 0;
let menuGhosts     = [];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function triggerShake(intensity, duration) {
  shakeIntensity = Math.max(shakeIntensity, intensity);
  shakeTime      = Math.max(shakeTime, duration);
}

function randomEdgePos() {
  const margin = 35;
  switch (Math.floor(Math.random() * 4)) {
    case 0: return { x: Math.random() * W, y: -margin };
    case 1: return { x: W + margin,         y: Math.random() * H };
    case 2: return { x: Math.random() * W, y: H + margin };
    default:return { x: -margin,            y: Math.random() * H };
  }
}

function spawnEnemy(type) {
  const pos = randomEdgePos();
  enemies.push(new Enemy(pos.x, pos.y, type));
}

function spawnDeathExplosion(x, y, type) {
  const colorSets = {
    grunt:   ['#ff4444', '#ff7733', '#ffaa00', '#ffffff'],
    runner:  ['#ff8800', '#ffcc00', '#ff5500', '#ffffff'],
    tank:    ['#dd00ff', '#9900cc', '#ff55ff', '#ffffff'],
    shooter: ['#00ffdd', '#00aaaa', '#88ffff', '#ffffff'],
  };
  const colors = colorSets[type];
  const count  = type === 'tank' ? 18 : 11;
  for (let i = 0; i < count; i++) {
    const a   = (Math.PI * 2 * i / count) + (Math.random() - 0.5) * 0.9;
    const spd = 65 + Math.random() * 130;
    particles.push(new Particle(
      x, y,
      Math.cos(a) * spd, Math.sin(a) * spd,
      colors[Math.floor(Math.random() * colors.length)],
      0.3 + Math.random() * 0.5,
      2  + Math.random() * 5
    ));
  }
}

function spawnMuzzleFlash(x, y, angle) {
  for (let i = 0; i < 5; i++) {
    const spread = (Math.random() - 0.5) * 0.9;
    const spd    = 70 + Math.random() * 80;
    const color  = i < 2 ? '#ffffff' : '#ffff44';
    particles.push(new Particle(
      x, y,
      Math.cos(angle + spread) * spd,
      Math.sin(angle + spread) * spd,
      color, 0.07 + Math.random() * 0.06, 1.5 + Math.random() * 2.5
    ));
  }
}

// ─── GAME MANAGEMENT ──────────────────────────────────────────────────────────

function startGame() {
  initAudio();
  player     = new Player();
  enemies    = [];
  bullets    = [];
  particles  = [];
  score      = 0;
  level      = 1;
  shakeTime  = 0;
  startLevel();
  gameState  = 'PLAYING';
}

function startLevel() {
  enemies    = [];
  bullets    = [];
  spawnQueue = buildSpawnQueue(getLevelData(level));
  spawnTimer = 0.8;
}

function checkLevelComplete() {
  if (spawnQueue.length === 0 && enemies.length === 0) {
    score          += level * 150;
    transitionTimer = 0;
    gameState       = 'LEVEL_TRANSITION';
    bullets         = bullets.filter(b => b.owner !== 'enemy');
    playSound(440, 'triangle', 0.6, 0.22);
  }
}

function nextLevel() {
  level++;
  if (player) player.hp = Math.min(player.maxHp, player.hp + 25);
  startLevel();
  gameState = 'PLAYING';
}

function gameOver() {
  if (score > hiScore) {
    hiScore = score;
    localStorage.setItem('pixelAssaultHi', String(hiScore));
  }
  gameState = 'GAME_OVER';
}

// ─── COLLISION ────────────────────────────────────────────────────────────────

function circlesOverlap(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  const r  = a.radius + b.radius;
  return dx * dx + dy * dy < r * r;
}

function checkCollisions() {
  for (const b of bullets) {
    if (b.dead) continue;
    if (b.owner === 'player') {
      for (const e of enemies) {
        if (e.dead) continue;
        if (circlesOverlap(b, e)) {
          b.dead = true;
          e.takeDamage(b.damage);
          break;
        }
      }
    } else {
      if (player && circlesOverlap(b, player)) {
        b.dead = true;
        player.takeDamage(b.damage);
      }
    }
  }

  if (player) {
    for (const e of enemies) {
      if (e.dead) continue;
      if (circlesOverlap(e, player)) {
        e.dead = true;
        spawnDeathExplosion(e.x, e.y, e.type);
        player.takeDamage(25);
      }
    }
  }
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

function updateGame(dt) {
  spawnTimer -= dt;
  if (spawnTimer <= 0 && spawnQueue.length > 0) {
    const entry = spawnQueue.shift();
    spawnEnemy(entry.type);
    spawnTimer = entry.interval;
  }

  if (player) player.update(dt);
  for (const e of enemies)   e.update(dt);
  for (const b of bullets)   b.update(dt);
  for (const p of particles) p.update(dt);

  checkCollisions();

  enemies   = enemies.filter(e => !e.dead);
  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);

  if (shakeTime > 0) shakeTime -= dt;

  if (gameState === 'PLAYING') checkLevelComplete();
}

function updateMenu(dt) {
  for (const g of menuGhosts) {
    const a = Math.atan2(H / 2 - g.y, W / 2 - g.x);
    g.x += Math.cos(a) * g.speed * dt;
    g.y += Math.sin(a) * g.speed * dt;
    if (Math.hypot(g.x - W / 2, g.y - H / 2) < 50) {
      const pos = randomEdgePos();
      g.x = pos.x; g.y = pos.y;
    }
  }

  const btnX = W / 2 - 95, btnY = H / 2 + 50, btnW = 190, btnH = 48;
  const hover = mouse.x > btnX && mouse.x < btnX + btnW &&
                mouse.y > btnY && mouse.y < btnY + btnH;
  if (hover && mouse.clicked) startGame();
}

function updateTransition(dt) {
  transitionTimer += dt;
  if (transitionTimer > 1.5 && mouse.clicked) nextLevel();
}

function updateGameOver() {
  if (mouse.clicked) gameState = 'MENU';
}

// ─── RENDER ───────────────────────────────────────────────────────────────────

function renderBackground() {
  ctx.fillStyle = C.BG;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.GRID;
  ctx.lineWidth = 1;
  const g = 40;
  for (let x = 0; x <= W; x += g) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += g) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}

function renderScanlines() {
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
}

function renderGame() {
  renderBackground();

  const shaking = shakeTime > 0;
  if (shaking) {
    ctx.save();
    ctx.translate(
      (Math.random() - 0.5) * shakeIntensity * 2,
      (Math.random() - 0.5) * shakeIntensity * 2
    );
  }

  for (const p of particles) p.draw();
  for (const e of enemies)   e.draw();
  if (player) player.draw();
  for (const b of bullets)   b.draw();

  if (shaking) ctx.restore();

  renderScanlines();
  renderHUD();
}

function renderHUD() {
  if (!player) return;
  const bx = 12, by = 14, bw = 160, bh = 16;

  // HP bar
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(bx, by, bw, bh);
  const pct   = player.hp / player.maxHp;
  const color = pct > 0.5 ? C.HUD_GREEN : pct > 0.25 ? C.HUD_YEL : C.HUD_RED;
  ctx.fillStyle = color;
  ctx.fillRect(bx, by, bw * pct, bh);
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`HP  ${player.hp} / ${player.maxHp}`, bx + 5, by + 11);

  // Level (center)
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = C.HUD_TEXT;
  ctx.fillText(`LEVEL  ${level}`, W / 2, 26);

  // Score (right)
  ctx.textAlign = 'right';
  ctx.font = 'bold 15px monospace';
  ctx.fillStyle = C.HUD_SCORE;
  ctx.fillText(`SCORE  ${String(score).padStart(6, '0')}`, W - 12, 26);

  // Enemies remaining (bottom-right)
  ctx.textAlign = 'right';
  ctx.font = '12px monospace';
  ctx.fillStyle = '#ff8888';
  ctx.fillText(`ENEMIES  ${enemies.length + spawnQueue.length}`, W - 12, H - 14);
}

function drawOutlinedText(text, x, y, mainColor, shadowColor, size) {
  ctx.font      = `bold ${size}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillStyle = shadowColor;
  ctx.fillText(text, x + 3, y + 3);
  ctx.fillText(text, x - 3, y + 3);
  ctx.fillText(text, x + 3, y - 3);
  ctx.fillText(text, x - 3, y - 3);
  ctx.fillStyle = mainColor;
  ctx.fillText(text, x, y);
}

function renderMenu() {
  renderBackground();

  // Ghost enemies drift across menu
  ctx.globalAlpha = 0.28;
  for (const g of menuGhosts) g.draw();
  ctx.globalAlpha = 1;

  renderScanlines();

  ctx.textAlign = 'center';

  // Title
  drawOutlinedText('PIXEL',   W / 2, H / 2 - 72, '#00ffcc', '#003322', 68);
  drawOutlinedText('ASSAULT', W / 2, H / 2 - 8,  '#ffcc00', '#332200', 62);

  // Subtext
  ctx.font      = '13px monospace';
  ctx.fillStyle = '#446688';
  ctx.fillText('TOP-DOWN SHOOTER', W / 2, H / 2 + 28);

  // Start button
  const btnX = W / 2 - 95, btnY = H / 2 + 50, btnW = 190, btnH = 48;
  const hover = mouse.x > btnX && mouse.x < btnX + btnW &&
                mouse.y > btnY && mouse.y < btnY + btnH;
  ctx.fillStyle   = hover ? '#2255aa' : '#1a3a5a';
  ctx.fillRect(btnX, btnY, btnW, btnH);
  ctx.strokeStyle = hover ? '#88ccff' : '#3399ff';
  ctx.lineWidth   = 2;
  ctx.strokeRect(btnX, btnY, btnW, btnH);
  ctx.fillStyle   = '#ffffff';
  ctx.font        = 'bold 19px monospace';
  ctx.fillText('START GAME', W / 2, btnY + 31);

  // Controls
  ctx.font      = '12px monospace';
  ctx.fillStyle = '#446688';
  ctx.fillText('ARROWS / WASD — move', W / 2, H / 2 + 124);
  ctx.fillText('MOUSE AIM  +  LEFT CLICK — shoot', W / 2, H / 2 + 144);

  // High score
  ctx.fillStyle = C.HUD_SCORE;
  ctx.font      = '13px monospace';
  ctx.fillText(`BEST  ${String(hiScore).padStart(6, '0')}`, W / 2, H / 2 + 172);
}

function renderTransition() {
  ctx.fillStyle = 'rgba(0,0,0,0.68)';
  ctx.fillRect(0, 0, W, H);

  drawOutlinedText('LEVEL COMPLETE!', W / 2, H / 2 - 44, '#33ff88', '#004422', 44);

  ctx.textAlign = 'center';
  ctx.font      = 'bold 22px monospace';
  ctx.fillStyle = C.HUD_SCORE;
  ctx.fillText(`LEVEL  ${level}  CLEARED`, W / 2, H / 2 + 16);

  ctx.font      = '16px monospace';
  ctx.fillStyle = C.HUD_TEXT;
  ctx.fillText(`SCORE  ${String(score).padStart(6, '0')}`, W / 2, H / 2 + 48);

  if (transitionTimer > 1.5) {
    const blink = Math.floor(transitionTimer * 3) % 2 === 0;
    ctx.fillStyle = blink ? '#ffffff' : '#888888';
    ctx.font      = '14px monospace';
    ctx.fillText('CLICK OR PRESS ENTER TO CONTINUE', W / 2, H / 2 + 94);
  }
}

function renderGameOver() {
  ctx.fillStyle = 'rgba(70, 0, 0, 0.78)';
  ctx.fillRect(0, 0, W, H);

  drawOutlinedText('GAME OVER', W / 2, H / 2 - 44, '#ff3333', '#440000', 58);

  ctx.textAlign = 'center';
  ctx.font      = '20px monospace';
  ctx.fillStyle = '#ffaaaa';
  ctx.fillText(`FINAL SCORE  ${String(score).padStart(6, '0')}`, W / 2, H / 2 + 18);

  if (score > 0 && score >= hiScore) {
    ctx.fillStyle = '#ffff44';
    ctx.font      = 'bold 16px monospace';
    ctx.fillText('NEW HIGH SCORE!', W / 2, H / 2 + 52);
  }

  ctx.font      = '13px monospace';
  ctx.fillStyle = '#ff8888';
  ctx.fillText('PRESS  R / ENTER  OR CLICK TO MENU', W / 2, H / 2 + 90);
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

function initMenuGhosts() {
  const types = ['grunt', 'runner', 'tank', 'shooter'];
  for (let i = 0; i < 28; i++) {
    const pos = randomEdgePos();
    const g   = new Enemy(pos.x, pos.y, types[i % types.length]);
    g.speed   = 18 + Math.random() * 22;
    menuGhosts.push(g);
  }
}

initMenuGhosts();

// ─── MAIN LOOP ────────────────────────────────────────────────────────────────

let lastTime = 0;

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime  = timestamp;

  switch (gameState) {
    case 'MENU':
      updateMenu(dt);
      renderMenu();
      break;
    case 'PLAYING':
      updateGame(dt);
      renderGame();
      break;
    case 'LEVEL_TRANSITION':
      updateGame(dt);
      updateTransition(dt);
      renderGame();
      renderTransition();
      break;
    case 'GAME_OVER':
      updateGameOver();
      renderGame();
      renderGameOver();
      break;
  }

  mouse.clicked = false;
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
