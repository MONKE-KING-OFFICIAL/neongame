/**
 * Neon Overdrive - Core Game Script
 * This file handles the rendering loop, physics, and game state.
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const ui = {
    menu: document.getElementById('menu'),
    gameOver: document.getElementById('game-over'),
    upgradeScreen: document.getElementById('upgrade-screen'),
    upgradeList: document.getElementById('upgrade-list'),
    score: document.getElementById('score'),
    level: document.getElementById('level'),
    healthFill: document.getElementById('health-fill'),
    xpFill: document.getElementById('xp-fill'),
    finalScore: document.getElementById('final-score')
};

// --- Game State Variables ---
let width, height;
let particles = [];
let bullets = [];
let enemies = [];
let frame = 0;
let isGaming = false;
let isPaused = false;
let score = 0;
let level = 1;
let xp = 0;
let xpToNext = 100;

const keys = {};
const mouse = { x: 0, y: 0, down: false };

// --- Player Configuration ---
const player = {
    x: 0,
    y: 0,
    radius: 15,
    speed: 5,
    health: 100,
    maxHealth: 100,
    fireRate: 20,
    fireTimer: 0,
    bulletSpeed: 10,
    bulletDamage: 1,
    multishot: 1,
    pierce: 0
};

// --- Initial Setup & Input ---
function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    if (!isGaming) {
        player.x = width / 2;
        player.y = height / 2;
    }
}

window.addEventListener('resize', resize);
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);
window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
window.addEventListener('mousedown', () => mouse.down = true);
window.addEventListener('mouseup', () => mouse.down = false);

resize();

// --- Game Classes ---

class Particle {
    constructor(x, y, color, speed = 2, size = 2) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * (Math.random() * speed);
        this.vy = Math.sin(angle) * (Math.random() * speed);
        this.life = 1.0;
        this.decay = 0.01 + Math.random() * 0.02;
        this.color = color;
        this.size = size;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
    }
    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class Bullet {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * player.bulletSpeed;
        this.vy = Math.sin(angle) * player.bulletSpeed;
        this.radius = 4;
        this.life = 100;
        this.pierce = player.pierce;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
    }
    draw() {
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00f2ff';
        ctx.fillStyle = '#00f2ff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Enemy {
    constructor() {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.max(width, height) * 0.6;
        this.x = width / 2 + Math.cos(angle) * dist;
        this.y = height / 2 + Math.sin(angle) * dist;
        
        this.type = Math.random() > 0.8 ? 'tank' : 'scout';
        if (this.type === 'tank') {
            this.hp = 5 + (level * 2);
            this.speed = 1.5 + (level * 0.1);
            this.radius = 25;
            this.color = '#ff0055';
            this.xp = 25;
        } else {
            this.hp = 1 + (level * 0.5);
            this.speed = 3 + (level * 0.2);
            this.radius = 12;
            this.color = '#ffaa00';
            this.xp = 10;
        }
    }
    update() {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;
    }
    draw() {
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        if (this.type === 'tank') {
            ctx.rect(this.x - this.radius, this.y - this.radius, this.radius*2, this.radius*2);
        } else {
            ctx.moveTo(this.x, this.y - this.radius);
            ctx.lineTo(this.x + this.radius, this.y + this.radius);
            ctx.lineTo(this.x - this.radius, this.y + this.radius);
            ctx.closePath();
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
}

// --- Game Functions ---

function createExplosion(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color, 5, 3));
    }
}

function spawnBullet() {
    const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    if (player.multishot === 1) {
        bullets.push(new Bullet(player.x, player.y, angle));
    } else {
        const spread = 0.2;
        const startAngle = angle - (spread * (player.multishot - 1)) / 2;
        for (let i = 0; i < player.multishot; i++) {
            bullets.push(new Bullet(player.x, player.y, startAngle + i * spread));
        }
    }
}

function update() {
    if (!isGaming || isPaused) return;

    // Movement
    if (keys['KeyW'] || keys['ArrowUp']) player.y -= player.speed;
    if (keys['KeyS'] || keys['ArrowDown']) player.y += player.speed;
    if (keys['KeyA'] || keys['ArrowLeft']) player.x -= player.speed;
    if (keys['KeyD'] || keys['ArrowRight']) player.x += player.speed;

    player.x = Math.max(player.radius, Math.min(width - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(height - player.radius, player.y));

    // Fire Logic
    if (mouse.down && player.fireTimer <= 0) {
        spawnBullet();
        player.fireTimer = player.fireRate;
    }
    if (player.fireTimer > 0) player.fireTimer--;

    // Bullet Updates
    bullets.forEach((b, i) => {
        b.update();
        if (b.life <= 0 || b.x < 0 || b.x > width || b.y < 0 || b.y > height) {
            bullets.splice(i, 1);
        }
    });

    // Enemy Spawning
    if (frame % Math.max(20, 100 - level * 5) === 0) {
        enemies.push(new Enemy());
    }

    // Enemy Updates & Collisions
    enemies.forEach((e, ei) => {
        e.update();
        
        bullets.forEach((b, bi) => {
            const dist = Math.hypot(e.x - b.x, e.y - b.y);
            if (dist < e.radius + b.radius) {
                e.hp -= player.bulletDamage;
                createExplosion(b.x, b.y, '#00f2ff', 3);
                if (b.pierce <= 0) bullets.splice(bi, 1);
                else b.pierce--;

                if (e.hp <= 0) {
                    score += Math.floor(e.xp);
                    xp += e.xp;
                    createExplosion(e.x, e.y, e.color, 15);
                    enemies.splice(ei, 1);
                    checkLevelUp();
                }
            }
        });

        const playerDist = Math.hypot(e.x - player.x, e.y - player.y);
        if (playerDist < e.radius + player.radius) {
            player.health -= 0.5;
            createExplosion(player.x, player.y, '#ff0055', 1);
            if (player.health <= 0) endGame();
        }
    });

    particles.forEach((p, i) => {
        p.update();
        if (p.life <= 0) particles.splice(i, 1);
    });

    // Update UI Elements
    ui.score.innerText = `SCORE: ${score}`;
    ui.level.innerText = `LVL: ${level}`;
    ui.healthFill.style.width = `${(player.health / player.maxHealth) * 100}%`;
    ui.xpFill.style.width = `${(xp / xpToNext) * 100}%`;

    frame++;
}

function draw() {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, width, height);

    // Grid FX
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    particles.forEach(p => p.draw());
    bullets.forEach(b => b.draw());
    enemies.forEach(e => e.draw());

    if (isGaming) {
        const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(angle);
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00f2ff';
        ctx.strokeStyle = '#00f2ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(15, 0); ctx.lineTo(-10, -10); ctx.lineTo(-10, 10); ctx.closePath();
        ctx.stroke();
        if (frame % 2 === 0) createExplosion(-15, 0, '#00f2ff', 1);
        ctx.restore();
    }

    requestAnimationFrame(() => {
        update();
        draw();
    });
}

function checkLevelUp() {
    if (xp >= xpToNext) {
        level++;
        xp -= xpToNext;
        xpToNext = Math.floor(xpToNext * 1.3);
        showUpgradeScreen();
    }
}

function showUpgradeScreen() {
    isPaused = true;
    ui.upgradeScreen.classList.remove('hidden');
    ui.upgradeList.innerHTML = '';
    
    const options = [
        { name: 'Rapid Fire', action: () => player.fireRate = Math.max(5, player.fireRate - 3) },
        { name: 'Multi-Shot', action: () => player.multishot++ },
        { name: 'Pierce Shells', action: () => player.pierce++ },
        { name: 'Hull Reinforcement', action: () => { player.maxHealth += 20; player.health = player.maxHealth; } },
        { name: 'Overdrive Engine', action: () => player.speed += 1 },
        { name: 'Calibration', action: () => player.bulletDamage += 1 }
    ];

    options.sort(() => 0.5 - Math.random()).slice(0, 3).forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'btn text-sm';
        btn.innerText = opt.name;
        btn.onclick = () => { opt.action(); isPaused = false; ui.upgradeScreen.classList.add('hidden'); };
        ui.upgradeList.appendChild(btn);
    });
}

function startGame() {
    ui.menu.classList.add('hidden');
    isGaming = true;
    score = 0;
    level = 1;
    xp = 0;
    player.health = 100;
    player.maxHealth = 100;
    player.fireRate = 20;
    player.multishot = 1;
    player.pierce = 0;
    player.speed = 5;
    enemies = [];
    bullets = [];
}

function endGame() {
    isGaming = false;
    ui.gameOver.classList.remove('hidden');
    ui.finalScore.innerText = `SCORE: ${score}`;
}

// Boot game loop
draw();
