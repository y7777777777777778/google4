/* Platformer Starter — game.js
   - Simple tile-based platformer
   - Place index.html, style.css, game.js together and open index.html
*/

// ---- Basic config ----
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

let W = canvas.width;
let H = canvas.height;

const TILE = 48; // tile pixel size (internal world units)
const GRAVITY = 2000; // px/s^2
const MOVE_SPEED = 260; // px/s
const JUMP_SPEED = 720; // px/s

// UI elements
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');
const messageEl = document.getElementById('message');

// Touch controls
const leftBtn = document.getElementById('left-btn');
const rightBtn = document.getElementById('right-btn');
const jumpBtn = document.getElementById('jump-btn');

// Input state
const input = { left:false, right:false, jump:false };

// Keyboard
window.addEventListener('keydown', e => {
  if(e.key === 'ArrowLeft' || e.key === 'a') input.left = true;
  if(e.key === 'ArrowRight' || e.key === 'd') input.right = true;
  if(e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') input.jump = true;
  if(e.key === 'r') resetLevel();
});
window.addEventListener('keyup', e => {
  if(e.key === 'ArrowLeft' || e.key === 'a') input.left = false;
  if(e.key === 'ArrowRight' || e.key === 'd') input.right = false;
  if(e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') input.jump = false;
});

// Touch controls events
if(leftBtn){ leftBtn.addEventListener('touchstart', e => { e.preventDefault(); input.left = true }, {passive:false}); leftBtn.addEventListener('touchend', e => { e.preventDefault(); input.left = false }, {passive:false})}
if(rightBtn){ rightBtn.addEventListener('touchstart', e => { e.preventDefault(); input.right = true }, {passive:false}); rightBtn.addEventListener('touchend', e => { e.preventDefault(); input.right = false }, {passive:false})}
if(jumpBtn){ jumpBtn.addEventListener('touchstart', e => { e.preventDefault(); input.jump = true }, {passive:false}); jumpBtn.addEventListener('touchend', e => { e.preventDefault(); input.jump = false }, {passive:false})}

// ---- Utility ----
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)) }
function rectsOverlap(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y }

// ---- Levels (tile maps) ----
// 0 = empty, 1 = solid block, 2 = coin, 3 = enemy spawn, 4 = player start, 5 = finish flag
const LEVELS = [
  {
    name: 'Green Meadows',
    tiles: [
      // each row is width 40 ish. we'll define as short rows and compute.
      "000000000000000000000000000000000000",
      "000000000000000000000000000000000000",
      "000000000000000000200000000000000000",
      "000000000000000000011000000000000000",
      "000000000000000000000000000000000000",
      "000000000000000000000000000000000000",
      "000000000000004000000000000000000000",
      "000000000000111111000000000000000000",
      "000000000000000000000000000000000000",
      "000000000000000000000030000000000000",
      "000000000000000011111111000000000000",
      "000000000000000000000000000000000000",
      "000000000020000000000000000000000000",
      "001111111111100000000000000000000000",
      "000000000000000000000000000000000000",
      "000000000000000000000000000000000000",
      "111111111111111111111111111111111111"
    ],
    tileW: 36
  },
  // small second level to demo enemies/coins/finish
  {
    name: 'Cave Run',
    tiles: [
      "000000000000000000000000000000000000",
      "000000000000000000000000000000000000",
      "000020000000000000000000000000000000",
      "000011000000000000000000000000000000",
      "000000000000000000000300000000000000",
      "000000000000000011111100000000000000",
      "000000004000000000000000000000000000",
      "001111111111100000000000000000000000",
      "000000000000000000000000000000000000",
      "000000000000020000000000000000000000",
      "000000000000011111111000000000000000",
      "000000000000000000000000000000000000",
      "000000000030000000000000000000000005",
      "001111111111111111111111111111111111"
    ],
    tileW: 36
  }
];

// world state
let currentLevelIndex = 0;
let world = null;

// ---- Entities ----
class Player {
  constructor(x,y){
    this.x = x; this.y = y;
    this.w = TILE*0.7; this.h = TILE*0.95;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.facing = 1;
  }
  update(dt){
    // horizontal movement
    let target = 0;
    if(input.left) target -= MOVE_SPEED;
    if(input.right) target += MOVE_SPEED;

    // simple acceleration
    const accel = 2000;
    this.vx += (target - this.vx) * clamp(accel*dt / Math.max(1, Math.abs(target - this.vx)), 0, 1);

    // jump
    if(input.jump && this.onGround){
      this.vy = -JUMP_SPEED;
      this.onGround = false;
    }

    // gravity
    this.vy += GRAVITY * dt;

    // limit velocity
    this.vx = clamp(this.vx, -700, 700);
    this.vy = clamp(this.vy, -1500, 1500);

    // move & collision
    const nextX = this.x + this.vx * dt;
    const nextY = this.y + this.vy * dt;

    // horizontal collision
    this.x = nextX;
    if(collisionWithWorld(this)) {
      // step back and zero vx
      this.x = this.x - this.vx * dt;
      this.vx = 0;
    }

    // vertical collision
    this.y = nextY;
    if(collisionWithWorld(this)) {
      // collided
      if(this.vy > 0){
        // landed on ground
        this.onGround = true;
      }
      this.y = this.y - this.vy * dt;
      this.vy = 0;
    } else {
      this.onGround = false;
    }

    if(this.vx !== 0) this.facing = this.vx > 0 ? 1 : -1;
  }
  draw(ctx,cam){
    const sx = this.x - cam.x, sy = this.y - cam.y;
    // body
    ctx.fillStyle = "#ff6b6b";
    roundRect(ctx, sx, sy, this.w, this.h, 6, true, false);
    // eye
    ctx.fillStyle = "#222";
    ctx.fillRect(sx + (this.facing<0?6:this.w-12), sy + 10, 6,6);
  }
}

class Enemy {
  constructor(x,y,range=200){
    this.x = x; this.y = y; this.w = TILE*0.8; this.h = TILE*0.85;
    this.vx = 80; this.range = range; this.startX = x;
  }
  update(dt){
    // simple patrolling
    this.x += this.vx * dt;
    if(Math.abs(this.x - this.startX) > this.range){
      this.vx *= -1;
    }
    // gravity & ground collision
    this.vy = (this.vy || 0) + GRAVITY * dt;
    this.y += this.vy * dt;
    if(collisionWithWorld(this)){
      this.y -= this.vy * dt;
      this.vy = 0;
    }
  }
  draw(ctx,cam){
    ctx.fillStyle = "#334155";
    ctx.fillRect(this.x - cam.x, this.y - cam.y, this.w, this.h);
  }
}

class Coin {
  constructor(x,y){
    this.x = x; this.y = y; this.w = TILE*0.5; this.h = TILE*0.5;
    this.collected = false;
    this.timer = Math.random()*Math.PI*2;
  }
  update(dt){
    this.timer += dt*6;
  }
  draw(ctx,cam){
    if(this.collected) return;
    const sx = this.x - cam.x, sy = this.y - cam.y;
    // bobbing effect
    const bob = Math.sin(this.timer) * 6;
    ctx.fillStyle = "#ffd166";
    roundRect(ctx, sx, sy + bob, this.w, this.h, 6, true, false);
  }
}

// ---- World helpers ----
function buildWorld(levelIndex){
  const levelSpec = LEVELS[levelIndex];
  const tiles = levelSpec.tiles;
  const rows = tiles.length;
  const cols = tiles[0].length;
  const worldObj = {
    name: levelSpec.name,
    cols, rows, tileSize: TILE,
    solids: [], coins: [], enemies: [], playerStart: {x: TILE*2, y: TILE* (rows-5)},
    finish: null
  };

  for(let r=0;r<rows;r++){
    const row = tiles[r];
    for(let c=0;c<cols;c++){
      const ch = row[c] || '0';
      const x = c * TILE, y = r * TILE;
      if(ch === '1'){
        worldObj.solids.push({x,y,w:TILE,h:TILE});
      } else if(ch === '2'){
        worldObj.coins.push(new Coin(x + (TILE- TILE*0.5)/2, y + (TILE - TILE*0.5)/2));
      } else if(ch === '3'){
        worldObj.enemies.push(new Enemy(x, y, TILE*4));
      } else if(ch === '4'){
        worldObj.playerStart = {x: x + 8, y: y - TILE*0.2};
      } else if(ch === '5'){
        worldObj.finish = {x,y,w:TILE,h:TILE};
      }
    }
  }
  return worldObj;
}

function collisionWithWorld(entity){
  // check collision with any solid tile
  const A = {x:entity.x, y:entity.y, w:entity.w, h:entity.h};
  for(const s of world.solids){
    if(rectsOverlap(A,s)) return true;
  }
  return false;
}

// camera
const camera = {x:0,y:0,w:W,h:H};
function updateCamera(target){
  // center player with soft follow
  const targetX = target.x + target.w/2 - camera.w/2;
  const targetY = target.y + target.h/2 - camera.h/2;
  camera.x += (targetX - camera.x) * 0.12;
  camera.y += (targetY - camera.y) * 0.12;
  // clamp to world bounds
  const maxX = world.cols * TILE - camera.w;
  const maxY = world.rows * TILE - camera.h;
  camera.x = clamp(camera.x, 0, Math.max(0, maxX));
  camera.y = clamp(camera.y, 0, Math.max(0, maxY));
}

// draw world
function drawWorld(ctx){
  // background grid
  ctx.fillStyle = "#9cd1e8";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // draw solids
  ctx.fillStyle = "#2b2d42";
  for(const s of world.solids){
    ctx.fillRect(s.x - camera.x, s.y - camera.y, s.w, s.h);
  }

  // finish flag
  if(world.finish){
    ctx.fillStyle = "#06d6a0";
    ctx.fillRect(world.finish.x - camera.x + 10, world.finish.y - camera.y + 10, world.finish.w - 20, world.finish.h - 20);
  }

  // coins
  for(const c of world.coins) c.draw(ctx, camera);

  // enemies
  for(const e of world.enemies) e.draw(ctx, camera);
}

// ---- Game state ----
let player, score=0, lives=3, lastTime=0, running=true, levelCleared=false;

function initLevel(index){
  world = buildWorld(index);
  player = new Player(world.playerStart.x, world.playerStart.y);
  score = 0;
  levelCleared = false;
  levelEl.textContent = `Level: ${index+1}`;
  updateHud();
}

function updateHud(){
  scoreEl.textContent = `Score: ${score}`;
  livesEl.textContent = `Lives: ${lives}`;
}

// reset current level (respawn player)
function resetLevel(){
  player = new Player(world.playerStart.x, world.playerStart.y);
  lives -= 1;
  if(lives < 0){
    // game over — reset everything
    showMessage("Game Over — R to restart");
    currentLevelIndex = 0;
    lives = 3;
    initLevel(currentLevelIndex);
  } else {
    updateHud();
    showMessage(`You Died — Lives: ${lives}`, 1200);
  }
}

// show center message (ms optional)
let msgTimer = 0;
function showMessage(text, ms=0){
  messageEl.textContent = text;
  messageEl.classList.remove('hidden');
  if(ms>0){
    clearTimeout(msgTimer);
    msgTimer = setTimeout(()=> messageEl.classList.add('hidden'), ms);
  }
}

// main update
function gameUpdate(dt){
  if(!running) return;
  player.update(dt);
  // update enemies
  for(const e of world.enemies) e.update(dt);

  // coins collect
  for(const c of world.coins){
    if(c.collected) continue;
    if(rectsOverlap({x:player.x,y:player.y,w:player.w,h:player.h},{x:c.x,y:c.y,w:c.w,h:c.h})){
      c.collected = true;
      score += 10;
      updateHud();
    }
  }

  // enemy collision
  for(const e of world.enemies){
    if(rectsOverlap({x:player.x,y:player.y,w:player.w,h:player.h},{x:e.x,y:e.y,w:e.w,h:e.h})){
      // simple logic: if player above enemy (falling) enemy dies, else player dies
      if(player.vy > 200){
        // stomp
        const idx = world.enemies.indexOf(e);
        if(idx>=0) world.enemies.splice(idx,1);
        score += 30;
        player.vy = -JUMP_SPEED*0.5;
        updateHud();
      } else {
        // player dies (respawn)
        resetLevel();
        return;
      }
    }
  }

  // finish detection
  if(world.finish && rectsOverlap({x:player.x,y:player.y,w:player.w,h:player.h}, world.finish)){
    levelCleared = true;
    currentLevelIndex++;
    if(currentLevelIndex >= LEVELS.length){
      showMessage("Congratulations! You cleared all levels! R to restart", 0);
      running = false;
    } else {
      initLevel(currentLevelIndex);
      showMessage(`Level ${currentLevelIndex+1} start`, 1000);
    }
  }

  // out of bounds
  if(player.y > world.rows * TILE + 200){
    resetLevel();
  }

  // camera
  updateCamera(player);
}

// main draw
function gameDraw(){
  // scale drawing to canvas CSS size
  // (we rely on canvas internal size set via attributes for crispness)
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawWorld(ctx);
  // draw player
  player.draw(ctx, camera);
}

// utility: rounded rect
function roundRect(ctx, x, y, w, h, r, fill=true, stroke=false){
  if(typeof r === 'undefined') r=6;
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
  if(fill) ctx.fill();
  if(stroke) ctx.stroke();
}

// main loop
function loop(ts){
  if(!lastTime) lastTime = ts;
  const dt = Math.min(0.035, (ts-lastTime)/1000);
  lastTime = ts;
  gameUpdate(dt);
  gameDraw();
  requestAnimationFrame(loop);
}

// resizing canvas to remain crisp
function resizeCanvas(){
  // keep 16:9 internal resolution matching element attr
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(960 * scale);
  canvas.height = Math.floor(540 * scale);
  ctx.setTransform(scale,0,0,scale,0,0);
  W = canvas.width/scale; H = canvas.height/scale;
  camera.w = W; camera.h = H;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// initialize
initLevel(currentLevelIndex);
requestAnimationFrame(loop);

// expose some debug global (optional)
window._GAME = {world, player, restart: () => initLevel(currentLevelIndex)};
