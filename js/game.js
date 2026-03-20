/* ============================================
   Snake Math - Game Engine
   ============================================ */
class SnakeGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Grid
        this.cols = 23;
        this.rows = 23;
        this.cellSize = 0;

        // State
        this.state = 'idle'; // idle, playing, paused, gameover, levelclear
        this.level = 1;
        this.lives = 3;
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;

        // Level timer
        this.levelStartTime = 0;
        this.levelElapsedTime = 0;

        // Snake
        this.snake = [];
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        this.baseSpeed = 280;
        this.speed = 280;
        this.growPending = 0;
        this.snakeMinLength = 3;

        // Board items
        this.numbers = [];    // { x, y, value, isCorrect, spawnTime }
        this.items = [];      // { x, y, type, spawnTime, duration }
        this.particles = [];

        // Current problem
        this.problem = null;
        this.levelConfig = null;

        // Active effects
        this.activeEffects = {};
        this.shieldActive = false;
        this.doubleGrowth = false;
        this.speedModifier = 1;

        // Timers
        this.gameLoop = null;
        this.lastMoveTime = 0;
        this.itemSpawnTimer = 0;
        this.numberRefreshTimer = 0;
        this._lastTimestamp = 0;

        // Animation
        this.animFrame = null;
        this.frameCount = 0;
        this.headBounce = 0;

        // Rendering state
        this._ghostTrail = [];       // afterglow trail behind snake
        this._blinkTimer = 0;        // eye blink timer
        this._blinkState = false;    // currently blinking?
        this._dotPhase = 0;          // animated dot grid phase
        this._numberParticles = [];  // orbiting particles for items
        this._magnetMoveReady = false;

        // Smooth movement interpolation
        this._moveProgress = 0;      // 0 to 1 interpolation between cells
        this._prevPositions = [];    // previous frame snake positions for lerp

        // Visual effects
        this._screenFlash = null;
        this._floatingTexts = [];

        // Callbacks
        this.onUpdateHUD = null;
        this.onLevelClear = null;
        this.onGameOver = null;
        this.onCorrect = null;
        this.onWrong = null;
        this.onItemCollect = null;
        this.onLifeLost = null;
        this.onCombo = null;

        // Wall collision
        this.wallMode = 'wrap'; // 'wrap' = teleport through walls

        this._resize();
        window.addEventListener('resize', () => this._resize());
    }

    _resize() {
        const hud = document.querySelector('.game-hud');
        const hudH = hud ? hud.offsetHeight : 120;
        const availH = window.innerHeight - hudH - 10;
        const availW = window.innerWidth;

        const size = Math.min(availW, availH);
        this.canvas.width = size * window.devicePixelRatio;
        this.canvas.height = size * window.devicePixelRatio;
        this.canvas.style.width = size + 'px';
        this.canvas.style.height = size + 'px';
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        this.cellSize = Math.floor(size / this.cols);
        this.offsetX = Math.floor((size - this.cellSize * this.cols) / 2);
        this.offsetY = Math.floor((size - this.cellSize * this.rows) / 2);
        this.renderSize = size;
    }

    init(level) {
        this.level = level;
        this.levelConfig = window.mathGenerator.getLevelConfig(level);
        this.lives = 3;
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.speed = this.levelConfig.speed;
        this.baseSpeed = this.levelConfig.speed;
        this.speedModifier = 1;
        this.shieldActive = false;
        this.doubleGrowth = false;
        this.activeEffects = {};
        this.growPending = 0;
        window.mathGenerator.resetStats();
        this._initSnake();
        this._newProblem();
        this._spawnItems();
        this.state = 'playing';
        this.lastMoveTime = performance.now();
        this.levelStartTime = performance.now();
        this.levelElapsedTime = 0;
        this._startLoop();
        this._resize();
    }

    continueLevel(level) {
        this.level = level;
        this.levelConfig = window.mathGenerator.getLevelConfig(level);
        this.speed = this.levelConfig.speed;
        this.baseSpeed = this.levelConfig.speed;
        this.speedModifier = 1;
        this.shieldActive = false;
        this.doubleGrowth = false;
        this.activeEffects = {};
        this.growPending = 0;
        window.mathGenerator.resetStats();
        this._initSnake();
        this._newProblem();
        this._spawnItems();
        this.state = 'playing';
        this.lastMoveTime = performance.now();
        this.levelStartTime = performance.now();
        this.levelElapsedTime = 0;
        this._startLoop();
    }

    _initSnake() {
        const startX = Math.floor(this.cols / 2);
        const startY = Math.floor(this.rows / 2);
        this.snake = [];
        for (let i = 0; i < this.snakeMinLength; i++) {
            this.snake.push({ x: startX - i, y: startY });
        }
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
    }

    _newProblem() {
        this.problem = window.mathGenerator.generate(this.level);
        this.numbers = [];
        this._spawnNumbers();
        if (this.onUpdateHUD) this.onUpdateHUD();
    }

    _spawnNumbers() {
        const boardNums = window.mathGenerator.generateBoardNumbers(this.problem, this.level);
        this.numbers = [];

        boardNums.forEach(n => {
            const pos = this._findEmptyCell();
            if (pos) {
                this.numbers.push({
                    x: pos.x, y: pos.y,
                    value: n.value,
                    isCorrect: n.isCorrect,
                    spawnTime: performance.now()
                });
            }
        });

        // Safety check: ensure the correct answer was placed on the board
        const hasCorrect = this.numbers.some(n => n.isCorrect);
        if (!hasCorrect) {
            console.warn('_spawnNumbers: correct answer was not placed (no empty cell). Retrying...');
            const retryPos = this._findEmptyCell();
            if (retryPos) {
                this.numbers.push({
                    x: retryPos.x, y: retryPos.y,
                    value: this.problem.correctAnswer,
                    isCorrect: true,
                    spawnTime: performance.now()
                });
            } else {
                console.warn('_spawnNumbers: retry also failed - board is full.');
            }
        }
    }

    _spawnItems() {
        // Items spawn periodically
        this.itemSpawnTimer = 8000 + Math.random() * 7000;
    }

    _spawnOneItem() {
        const pos = this._findEmptyCell();
        if (!pos) return;

        const itemTypes = [
            { type: 'star', icon: '⭐', name: '성장 부스트', effect: 'doubleGrowth', duration: 15000, weight: 25 },
            { type: 'bomb', icon: '💣', name: '폭탄', effect: 'resetLength', duration: 0, weight: 8 },
            { type: 'turtle', icon: '🐢', name: '슬로우', effect: 'slow', duration: 15000, weight: 20 },
            { type: 'lightning', icon: '⚡', name: '스피드', effect: 'fast', duration: 10000, weight: 15 },
            { type: 'shield', icon: '🛡️', name: '보호막', effect: 'shield', duration: 15000, weight: 18 },
            { type: 'heart', icon: '❤️‍🩹', name: '생명', effect: 'extraLife', duration: 0, weight: 5 },
            { type: 'magnet', icon: '🧲', name: '자석', effect: 'magnet', duration: 12000, weight: 9 },
        ];

        // Weighted random
        const totalWeight = itemTypes.reduce((s, i) => s + i.weight, 0);
        let r = Math.random() * totalWeight;
        let selected = itemTypes[0];
        for (const item of itemTypes) {
            r -= item.weight;
            if (r <= 0) { selected = item; break; }
        }

        this.items.push({
            x: pos.x, y: pos.y,
            ...selected,
            spawnTime: performance.now(),
            lifetime: 12000 + Math.random() * 8000
        });
    }

    _findEmptyCell() {
        const occupied = new Set();
        this.snake.forEach(s => occupied.add(`${s.x},${s.y}`));
        this.numbers.forEach(n => occupied.add(`${n.x},${n.y}`));
        this.items.forEach(i => occupied.add(`${i.x},${i.y}`));

        const empty = [];
        for (let x = 0; x < this.cols; x++) {
            for (let y = 0; y < this.rows; y++) {
                if (!occupied.has(`${x},${y}`)) empty.push({ x, y });
            }
        }

        if (empty.length === 0) return null;
        return empty[Math.floor(Math.random() * empty.length)];
    }

    setDirection(dir) {
        if (this.state !== 'playing') return;
        const map = {
            'up':    { x: 0, y: -1 },
            'down':  { x: 0, y: 1 },
            'left':  { x: -1, y: 0 },
            'right': { x: 1, y: 0 }
        };
        const nd = map[dir];
        if (!nd) return;

        // Prevent 180 turn
        if (this.direction.x + nd.x === 0 && this.direction.y + nd.y === 0) return;
        this.nextDirection = nd;
    }

    pause() {
        if (this.state === 'playing') {
            this.state = 'paused';
            this.levelElapsedTime = performance.now() - this.levelStartTime;
            cancelAnimationFrame(this.animFrame);
            if (this._fallbackInterval) clearInterval(this._fallbackInterval);
        }
    }

    resume() {
        if (this.state === 'paused') {
            this.state = 'playing';
            this.lastMoveTime = performance.now();
            this.levelStartTime = performance.now() - this.levelElapsedTime;
            this._startLoop();
        }
    }

    destroy() {
        this.state = 'idle';
        cancelAnimationFrame(this.animFrame);
        if (this._fallbackInterval) clearInterval(this._fallbackInterval);
    }

    _startLoop() {
        // Clear any existing loop
        if (this.animFrame) cancelAnimationFrame(this.animFrame);
        if (this._fallbackInterval) clearInterval(this._fallbackInterval);

        let rafWorks = false;
        const loop = (timestamp) => {
            if (this.state !== 'playing') return;
            rafWorks = true;
            this.animFrame = requestAnimationFrame(loop);
            this._update(timestamp);
            this._render(timestamp);
        };
        this.animFrame = requestAnimationFrame(loop);

        // Fallback for environments where rAF doesn't fire
        // Don't clearInterval on pause — just skip frames. Destroyed in destroy().
        this._fallbackInterval = setInterval(() => {
            if (this.state !== 'playing') return; // skip, don't clear
            if (rafWorks) { clearInterval(this._fallbackInterval); return; }
            const ts = performance.now();
            this._update(ts);
            this._render(ts);
        }, 1000 / 60);
    }

    _update(timestamp) {
        this.levelElapsedTime = timestamp - this.levelStartTime;
        this.itemSpawnTimer -= (timestamp - this._lastTimestamp) || 0;
        this._lastTimestamp = timestamp;

        const effectiveSpeed = this.speed * this.speedModifier;
        const elapsed = timestamp - this.lastMoveTime;

        // Update smooth movement interpolation
        this._moveProgress = Math.min(1, elapsed / effectiveSpeed);

        // Update effects
        this._updateEffects(timestamp);
        if (this.itemSpawnTimer <= 0) {
            this._spawnOneItem();
            this.itemSpawnTimer = 8000 + Math.random() * 7000;
        }

        // Remove expired items
        this.items = this.items.filter(item => {
            return (timestamp - item.spawnTime) < item.lifetime;
        });

        // Refresh numbers if they've been on screen too long (30s)
        if (this.numbers.length > 0) {
            const oldest = this.numbers[0];
            if (timestamp - oldest.spawnTime > 30000) {
                this._refreshNumberPositions();
            }
        }

        // Ensure correct answer always on board
        const hasCorrect = this.numbers.some(n => n.isCorrect);
        if (!hasCorrect && this.problem) {
            const pos = this._findEmptyCell();
            if (pos) {
                this.numbers.push({
                    x: pos.x, y: pos.y,
                    value: this.problem.correctAnswer,
                    isCorrect: true,
                    spawnTime: performance.now()
                });
            }
        }

        if (elapsed < effectiveSpeed) return;
        this.lastMoveTime = timestamp;

        // Store previous positions for smooth interpolation
        this._prevPositions = this.snake.map(s => ({ x: s.x, y: s.y }));
        this._moveProgress = 0;
        this._magnetMoveReady = true;

        // Move snake
        this.direction = { ...this.nextDirection };
        const head = { ...this.snake[0] };
        head.x += this.direction.x;
        head.y += this.direction.y;

        // Wall handling - wrap
        if (head.x < 0) head.x = this.cols - 1;
        if (head.x >= this.cols) head.x = 0;
        if (head.y < 0) head.y = this.rows - 1;
        if (head.y >= this.rows) head.y = 0;

        // Self collision
        if (this.snake.some(s => s.x === head.x && s.y === head.y)) {
            this._loseLife('self');
            return;
        }

        this.snake.unshift(head);

        // Check number collision
        const numIdx = this.numbers.findIndex(n => n.x === head.x && n.y === head.y);
        if (numIdx !== -1) {
            const num = this.numbers[numIdx];
            this.numbers.splice(numIdx, 1);

            if (num.isCorrect) {
                this._onCorrectAnswer();
            } else {
                this._onWrongAnswer();
            }
        }

        // Check item collision
        const itemIdx = this.items.findIndex(i => i.x === head.x && i.y === head.y);
        if (itemIdx !== -1) {
            const item = this.items[itemIdx];
            this.items.splice(itemIdx, 1);
            this._collectItem(item);
        }

        // Tail management
        if (this.growPending > 0) {
            this.growPending--;
        } else {
            this.snake.pop();
        }

        // Update particles
        this.particles = this.particles.filter(p => {
            p.life -= 0.03;
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05;
            return p.life > 0;
        });

        if (this.onUpdateHUD) this.onUpdateHUD();
    }

    _refreshNumberPositions() {
        this.numbers.forEach(n => {
            const pos = this._findEmptyCell();
            if (pos) {
                n.x = pos.x;
                n.y = pos.y;
                n.spawnTime = performance.now();
            }
        });
    }

    _onCorrectAnswer() {
        this.combo++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;

        const growAmount = this.doubleGrowth ? 2 : 1;
        const comboBonus = Math.min(this.combo - 1, 3);
        this.growPending += growAmount + comboBonus;

        // Score
        const baseScore = 10 * this.level;
        const comboMultiplier = 1 + (this.combo - 1) * 0.5;
        this.score += Math.round(baseScore * comboMultiplier);

        window.mathGenerator.stats.correct++;
        window.soundEngine.play('correct');

        // Combo feedback
        if (this.combo >= 3 && this.onCombo) {
            this.onCombo(this.combo);
            window.soundEngine.play('combo');
        }

        // Celebration burst - lots of colorful particles
        const colors = ['#ff6b6b', '#ffd32a', '#00b894', '#6c5ce7', '#fd79a8', '#00cec9', '#fdcb6e'];
        for (let i = 0; i < 20; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            this._spawnParticles(this.snake[0].x, this.snake[0].y, color, 1);
        }

        // Screen flash effect
        this._screenFlash = { color: 'rgba(0, 184, 148, 0.15)', time: performance.now(), duration: 300 };

        // Floating score text
        this._floatingTexts = this._floatingTexts || [];
        const scoreGain = Math.round(baseScore * comboMultiplier);
        this._floatingTexts.push({
            x: this.snake[0].x, y: this.snake[0].y,
            text: `+${scoreGain}`, color: '#ffd32a',
            birth: performance.now(), duration: 1000
        });

        if (this.onCorrect) this.onCorrect(this.combo);

        // Check level clear
        const currentLength = this.snake.length + this.growPending;
        if (currentLength >= this.levelConfig.target) {
            this.state = 'levelclear';
            cancelAnimationFrame(this.animFrame);
            window.soundEngine.play('levelup');

            // Save progress
            const maxLevel = parseInt(localStorage.getItem('snakemath_maxLevel') || '1');
            if (this.level + 1 > maxLevel) {
                localStorage.setItem('snakemath_maxLevel', String(this.level + 1));
            }
            const bestScore = parseInt(localStorage.getItem('snakemath_bestScore') || '0');
            if (this.score > bestScore) {
                localStorage.setItem('snakemath_bestScore', String(this.score));
            }

            setTimeout(() => {
                if (this.onLevelClear) {
                    this.onLevelClear({
                        level: this.level,
                        score: this.score,
                        accuracy: window.mathGenerator.getAccuracy(),
                        combo: this.maxCombo,
                        time: this.levelElapsedTime,
                        maxCombo: this.maxCombo
                    });
                }
            }, 500);
            return;
        }

        // New problem
        this._newProblem();
    }

    _onWrongAnswer() {
        this.combo = 0;
        window.mathGenerator.stats.wrong++;
        window.soundEngine.play('wrong');

        if (this.shieldActive) {
            // Shield absorbs the hit
            this.shieldActive = false;
            delete this.activeEffects['shield'];
            window.soundEngine.play('shield');
            this._spawnParticles(this.snake[0].x, this.snake[0].y, '#6c5ce7', 6);
            if (this.onWrong) this.onWrong(true);
            // Still generate new problem
            this._newProblem();
            return;
        }

        // Shrink snake
        const shrinkAmount = Math.max(1, Math.floor(this.snake.length * 0.3));
        if (this.snake.length - shrinkAmount < this.snakeMinLength) {
            if (this.snake.length <= this.snakeMinLength) {
                // Can't shrink more, lose life
                this._loseLife('wrong');
                return;
            }
            // Shrink to min
            const toRemove = this.snake.length - this.snakeMinLength;
            for (let i = 0; i < toRemove; i++) this.snake.pop();
        } else {
            for (let i = 0; i < shrinkAmount; i++) this.snake.pop();
        }

        this._spawnParticles(this.snake[0].x, this.snake[0].y, '#e17055', 6);
        if (this.onWrong) this.onWrong(false);

        // New problem
        this._newProblem();
    }

    _loseLife(reason) {
        this.lives--;
        this.combo = 0;
        window.soundEngine.vibrate([100, 50, 100, 50, 100]);

        if (this.onLifeLost) this.onLifeLost(this.lives, reason);

        if (this.lives <= 0) {
            this.state = 'gameover';
            cancelAnimationFrame(this.animFrame);
            window.soundEngine.play('gameover');

            const bestScore = parseInt(localStorage.getItem('snakemath_bestScore') || '0');
            if (this.score > bestScore) {
                localStorage.setItem('snakemath_bestScore', String(this.score));
            }

            setTimeout(() => {
                if (this.onGameOver) {
                    this.onGameOver({
                        level: this.level,
                        score: this.score,
                        accuracy: window.mathGenerator.getAccuracy(),
                        maxCombo: this.maxCombo
                    });
                }
            }, 800);
            return;
        }

        // Reset snake position
        this._initSnake();
        this._newProblem();
        this.lastMoveTime = performance.now();
    }

    _collectItem(item) {
        window.soundEngine.play('item');
        this._spawnParticles(item.x, item.y, '#fdcb6e', 10);

        switch (item.effect) {
            case 'doubleGrowth':
                this.doubleGrowth = true;
                this.activeEffects['star'] = {
                    icon: item.icon, name: '성장 부스트',
                    endTime: performance.now() + item.duration
                };
                break;

            case 'resetLength':
                window.soundEngine.play('bomb');
                if (this.shieldActive) {
                    this.shieldActive = false;
                    delete this.activeEffects['shield'];
                    window.soundEngine.play('shield');
                } else {
                    // Reset to minimum length
                    while (this.snake.length > this.snakeMinLength) {
                        this.snake.pop();
                    }
                    this.growPending = 0;
                }
                break;

            case 'slow':
                this.speedModifier = 1.5; // Slower (higher interval)
                this.activeEffects['turtle'] = {
                    icon: item.icon, name: '슬로우',
                    endTime: performance.now() + item.duration
                };
                break;

            case 'fast':
                this.speedModifier = 0.6;
                // Bonus score for being fast
                this.score += 5 * this.level;
                this.activeEffects['lightning'] = {
                    icon: item.icon, name: '스피드',
                    endTime: performance.now() + item.duration
                };
                break;

            case 'shield':
                this.shieldActive = true;
                this.activeEffects['shield'] = {
                    icon: item.icon, name: '보호막',
                    endTime: performance.now() + item.duration
                };
                break;

            case 'extraLife':
                if (this.lives < 3) {
                    this.lives++;
                    if (this.onLifeLost) this.onLifeLost(this.lives, 'heal');
                }
                break;

            case 'magnet':
                // Pull correct answer closer to snake
                this.activeEffects['magnet'] = {
                    icon: item.icon, name: '자석',
                    endTime: performance.now() + item.duration
                };
                break;
        }

        if (this.onItemCollect) this.onItemCollect(item);
        if (this.onUpdateHUD) this.onUpdateHUD();
    }

    _updateEffects(timestamp) {
        for (const [key, effect] of Object.entries(this.activeEffects)) {
            if (effect.endTime && timestamp >= effect.endTime) {
                // Effect expired
                switch (key) {
                    case 'star': this.doubleGrowth = false; break;
                    case 'turtle':
                    case 'lightning': this.speedModifier = 1; break;
                    case 'shield': this.shieldActive = false; break;
                }
                delete this.activeEffects[key];
            }
        }

        // Magnet effect - move correct answer toward snake head (once per move tick)
        // Only pull along one axis per tick to prevent teleporting onto head
        if (this.activeEffects['magnet'] && this._magnetMoveReady) {
            this._magnetMoveReady = false;
            const head = this.snake[0];
            for (let i = this.numbers.length - 1; i >= 0; i--) {
                const n = this.numbers[i];
                if (!n.isCorrect) continue;
                const dx = head.x - n.x;
                const dy = head.y - n.y;
                const dist = Math.abs(dx) + Math.abs(dy);
                // Don't pull onto head directly - leave at least 1 cell gap
                // so normal movement collision handles eating
                if (dist <= 1) continue;
                // Pull one step along the longer axis only
                if (Math.abs(dx) >= Math.abs(dy)) {
                    n.x += Math.sign(dx);
                } else {
                    n.y += Math.sign(dy);
                }
            }
        }
    }

    _spawnParticles(cx, cy, color, count) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: cx * this.cellSize + this.cellSize / 2,
                y: cy * this.cellSize + this.cellSize / 2,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4 - 2,
                life: 1,
                color,
                size: 2 + Math.random() * 4
            });
        }
    }

    /* ============ Rendering ============ */
    _render(timestamp) {
        if (!timestamp) timestamp = performance.now();
        const ctx = this.ctx;
        const cs = this.cellSize;
        const ox = this.offsetX;
        const oy = this.offsetY;
        this.frameCount++;

        // Clear
        ctx.clearRect(0, 0, this.renderSize, this.renderSize);

        // Background
        this._drawBackground(ctx, cs, ox, oy);

        // Items
        this._drawItems(ctx, cs, ox, oy, timestamp);

        // Numbers
        this._drawNumbers(ctx, cs, ox, oy, timestamp);

        // Snake
        this._drawSnake(ctx, cs, ox, oy, timestamp);

        // Particles
        this._drawParticles(ctx);

        // Screen flash
        if (this._screenFlash) {
            const age = timestamp - this._screenFlash.time;
            if (age < this._screenFlash.duration) {
                const alpha = 1 - age / this._screenFlash.duration;
                ctx.fillStyle = this._screenFlash.color.replace(/[\d.]+\)$/, (alpha * 0.3) + ')');
                ctx.fillRect(0, 0, this.renderSize, this.renderSize);
            } else {
                this._screenFlash = null;
            }
        }

        // Floating texts
        if (this._floatingTexts) {
            this._floatingTexts = this._floatingTexts.filter(ft => {
                const age = timestamp - ft.birth;
                if (age >= ft.duration) return false;
                const t = age / ft.duration;
                const ox2 = this.offsetX + ft.x * this.cellSize + this.cellSize / 2;
                const oy2 = this.offsetY + ft.y * this.cellSize - t * 40;
                ctx.globalAlpha = 1 - t;
                ctx.font = `900 ${14 + (1-t) * 6}px Nunito, sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillStyle = ft.color;
                ctx.fillText(ft.text, ox2, oy2);
                ctx.globalAlpha = 1;
                return true;
            });
        }
    }

    _drawBackground(ctx, cs, ox, oy) {
        // Base fill
        ctx.fillStyle = '#080e1a';
        ctx.fillRect(0, 0, this.renderSize, this.renderSize);

        // Radial gradient - dark blue center fading to darker edges
        const centerX = this.renderSize / 2;
        const centerY = this.renderSize / 2;
        const maxR = this.renderSize * 0.7;
        const radGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxR);
        radGrad.addColorStop(0, 'rgba(15, 32, 60, 1)');
        radGrad.addColorStop(0.5, 'rgba(10, 22, 42, 1)');
        radGrad.addColorStop(1, 'rgba(5, 10, 20, 1)');
        ctx.fillStyle = radGrad;
        ctx.fillRect(0, 0, this.renderSize, this.renderSize);

        // Animated dot grid at intersections
        this._dotPhase += 0.015;
        const dotBaseAlpha = 0.06;
        for (let x = 0; x <= this.cols; x++) {
            for (let y = 0; y <= this.rows; y++) {
                const dx = x - this.cols / 2;
                const dy = y - this.rows / 2;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const wave = Math.sin(this._dotPhase + dist * 0.4) * 0.5 + 0.5;
                const alpha = dotBaseAlpha + wave * 0.04;
                const radius = 1 + wave * 0.8;
                ctx.fillStyle = `rgba(120, 140, 255, ${alpha})`;
                ctx.beginPath();
                ctx.arc(ox + x * cs, oy + y * cs, radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Pulsing border glow
        const t = performance.now();
        const borderPulse = Math.sin(t / 1200) * 0.15 + 0.35;
        const borderPulse2 = Math.sin(t / 800) * 0.1 + 0.2;

        // Outer glow (soft, wide)
        ctx.shadowColor = `rgba(108, 92, 231, ${borderPulse})`;
        ctx.shadowBlur = 15;
        ctx.strokeStyle = `rgba(108, 92, 231, ${borderPulse2})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(ox, oy, this.cols * cs, this.rows * cs);

        // Inner border line (crisp)
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(140, 120, 255, ${borderPulse * 0.6})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(ox + 1, oy + 1, this.cols * cs - 2, this.rows * cs - 2);
    }

    _drawSnake(ctx, cs, ox, oy, timestamp) {
        const len = this.snake.length;

        // --- Update ghost trail ---
        if (len > 0) {
            const tail = this.snake[len - 1];
            this._ghostTrail.push({ x: tail.x, y: tail.y, life: 1.0, birth: timestamp });
        }
        this._ghostTrail = this._ghostTrail.filter(g => {
            g.life = Math.max(0, 1.0 - (timestamp - g.birth) / 600);
            return g.life > 0;
        });

        // --- Draw ghost trail (afterglow) ---
        this._ghostTrail.forEach(g => {
            const gx = ox + g.x * cs + cs / 2;
            const gy = oy + g.y * cs + cs / 2;
            const r = cs * 0.3 * g.life;
            ctx.globalAlpha = g.life * 0.25;
            const ghostGrad = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
            ghostGrad.addColorStop(0, 'rgba(255, 80, 80, 0.6)');
            ghostGrad.addColorStop(1, 'rgba(255, 40, 40, 0)');
            ctx.fillStyle = ghostGrad;
            ctx.beginPath();
            ctx.arc(gx, gy, r, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // --- Drop shadow under entire snake (smoothed) ---
        ctx.globalAlpha = 0.18;
        for (let i = len - 1; i >= 0; i--) {
            const pos = this._getSmoothedPosition(i, ox, oy, cs);
            const shadowR = cs * 0.38;
            const margin = (cs - shadowR * 2) / 2;
            ctx.fillStyle = '#000';
            this._roundRect(ctx, pos.x + margin + 3, pos.y + margin + 4, shadowR * 2, shadowR * 2, cs * 0.22);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // --- Numberblocks accurate color palette (from the show) ---
        // 1=Red, 2=Orange, 3=Yellow, 4=Green, 5=Blue,
        // 6=Purple, 7=Rainbow, 8=Pink, 9=Gray, 10=White+Red border
        const nbColors = [
            { base: '#e74c3c', light: '#ff6b6b', dark: '#c0392b', outline: '#a93226' },   // 1 Red
            { base: '#e67e22', light: '#f5a623', dark: '#d35400', outline: '#bf6516' },   // 2 Orange
            { base: '#f1c40f', light: '#f9e154', dark: '#d4ac0d', outline: '#b7950b' },   // 3 Yellow
            { base: '#27ae60', light: '#58d68d', dark: '#1e8449', outline: '#196f3d' },   // 4 Green
            { base: '#2e86c1', light: '#5dade2', dark: '#21618c', outline: '#1a5276' },   // 5 Blue
            { base: '#8e44ad', light: '#bb8fce', dark: '#6c3483', outline: '#5b2c6f' },   // 6 Purple
            { base: '#e74c3c', light: '#ff6b6b', dark: '#c0392b', outline: '#a93226', rainbow: true }, // 7 Rainbow
            { base: '#e891b2', light: '#f5b7cc', dark: '#d46a95', outline: '#c2557e' },   // 8 Pink
            { base: '#7f8c8d', light: '#b2babb', dark: '#5d6d7e', outline: '#4d5656' },   // 9 Gray
            { base: '#ecf0f1', light: '#ffffff', dark: '#d5d8dc', outline: '#e74c3c', redBorder: true }, // 10 White+Red
        ];

        // --- Draw connections between Numberblocks cubes ---
        for (let i = 0; i < len - 1; i++) {
            const currPos = this._getSmoothedPosition(i, ox, oy, cs);
            const nextPos = this._getSmoothedPosition(i + 1, ox, oy, cs);
            const dxPx = currPos.x - nextPos.x;
            const dyPx = currPos.y - nextPos.y;

            if (Math.abs(dxPx) > cs * 2 || Math.abs(dyPx) > cs * 2) continue;

            const nextColorIdx = (i + 1) % nbColors.length;
            ctx.fillStyle = nbColors[nextColorIdx].base;

            const connW = cs * 0.52;
            const midX = (currPos.x + nextPos.x) / 2;
            const midY = (currPos.y + nextPos.y) / 2;

            if (Math.abs(dxPx) > Math.abs(dyPx)) {
                const x = Math.min(currPos.x, nextPos.x) + cs * 0.5;
                const y = midY + (cs - connW) / 2;
                ctx.fillRect(x, y, Math.abs(dxPx), connW);
            } else if (Math.abs(dyPx) > 0.1) {
                const x = midX + (cs - connW) / 2;
                const y = Math.min(currPos.y, nextPos.y) + cs * 0.5;
                ctx.fillRect(x, y, connW, Math.abs(dyPx));
            }
        }

        // --- Draw body segments from tail to head (Numberblocks cubes) ---
        for (let i = len - 1; i >= 0; i--) {
            const pos = this._getSmoothedPosition(i, ox, oy, cs);
            const bx = pos.x;
            const by = pos.y;

            if (i === 0) {
                // HEAD - Numberblocks "One"
                this._drawSnakeHead(ctx, bx, by, cs, timestamp);
            } else {
                const colorIdx = i % nbColors.length;
                const col = nbColors[colorIdx];
                const m = cs * 0.06;
                const s = cs - m * 2;
                const br = cs * 0.18;

                // Drop shadow
                ctx.fillStyle = 'rgba(0,0,0,0.12)';
                this._roundRect(ctx, bx + m + 1, by + m + 2, s, s, br);
                ctx.fill();

                // Main cube block
                if (col.rainbow) {
                    // "Seven" = rainbow block!
                    const rainbowColors = ['#e74c3c','#e67e22','#f1c40f','#27ae60','#2e86c1','#4a235a','#8e44ad'];
                    const stripeH = s / 7;
                    ctx.save();
                    ctx.beginPath();
                    this._roundRect(ctx, bx + m, by + m, s, s, br);
                    ctx.clip();
                    for (let r = 0; r < 7; r++) {
                        ctx.fillStyle = rainbowColors[r];
                        ctx.fillRect(bx + m, by + m + r * stripeH, s, stripeH + 0.5);
                    }
                    // Add 3D shine over rainbow
                    ctx.fillStyle = 'rgba(255,255,255,0.2)';
                    ctx.fillRect(bx + m, by + m, s, s * 0.35);
                    ctx.fillStyle = 'rgba(0,0,0,0.08)';
                    ctx.fillRect(bx + m, by + m + s * 0.7, s, s * 0.3);
                    ctx.restore();
                } else {
                    const blockGrad = ctx.createLinearGradient(bx + m, by + m, bx + m, by + m + s);
                    blockGrad.addColorStop(0, col.light);
                    blockGrad.addColorStop(0.45, col.base);
                    blockGrad.addColorStop(1, col.dark);
                    ctx.fillStyle = blockGrad;
                    this._roundRect(ctx, bx + m, by + m, s, s, br);
                    ctx.fill();

                    // 3D top highlight
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    this._roundRect(ctx, bx + m + 2, by + m + 2, s - 4, s * 0.35, Math.max(0, br - 1));
                    ctx.fill();

                    // 3D bottom shadow
                    ctx.fillStyle = 'rgba(0,0,0,0.1)';
                    this._roundRect(ctx, bx + m + 2, by + m + s * 0.65, s - 4, s * 0.3, Math.max(0, br - 1));
                    ctx.fill();
                }

                // Block edge outline (Ten = red border)
                ctx.strokeStyle = col.outline;
                ctx.lineWidth = col.redBorder ? 2 : 1;
                this._roundRect(ctx, bx + m, by + m, s, s, br);
                ctx.stroke();

                // Specular shine dot
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                ctx.beginPath();
                ctx.ellipse(bx + m + s * 0.3, by + m + s * 0.25, s * 0.08, s * 0.06, -0.3, 0, Math.PI * 2);
                ctx.fill();

                // --- Character-specific eye details on body segments ---
                const segNum = i + 1;
                const eCX = bx + cs * 0.5;
                const eCY = by + cs * 0.42;
                const eR = cs * 0.08;

                if (segNum <= 10) {
                    this._drawBlockFace(ctx, col, colorIdx, segNum, bx, by, cs, m, s, timestamp);
                }
            }
        }

        // === ENHANCED ITEM VISUAL EFFECTS ===

        // SHIELD - full protective aura around entire snake
        if (this.shieldActive) {
            ctx.strokeStyle = 'rgba(108, 92, 231, 0.6)';
            ctx.lineWidth = 3;
            const shieldPulse = Math.sin(timestamp / 200) * 0.3 + 0.7;

            for (let i = 0; i < len; i++) {
                const seg = this.snake[i];
                const sx = ox + seg.x * cs + cs / 2;
                const sy = oy + seg.y * cs + cs / 2;

                ctx.globalAlpha = shieldPulse * (0.4 - (i / len) * 0.2);
                ctx.beginPath();
                ctx.arc(sx, sy, cs * 0.6, 0, Math.PI * 2);
                ctx.stroke();

                const shieldGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, cs * 0.6);
                shieldGrad.addColorStop(0, 'rgba(108, 92, 231, 0.05)');
                shieldGrad.addColorStop(1, 'rgba(108, 92, 231, 0.15)');
                ctx.fillStyle = shieldGrad;
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        // MAGNET - visible beam to correct answer
        if (this.activeEffects['magnet']) {
            const head = this.snake[0];
            const hx = ox + head.x * cs + cs / 2;
            const hy = oy + head.y * cs + cs / 2;

            this.numbers.forEach(n => {
                if (n.isCorrect) {
                    const nx = ox + n.x * cs + cs / 2;
                    const ny = oy + n.y * cs + cs / 2;

                    const beamGrad = ctx.createLinearGradient(hx, hy, nx, ny);
                    beamGrad.addColorStop(0, 'rgba(80, 140, 255, 0.6)');
                    beamGrad.addColorStop(0.5, 'rgba(80, 140, 255, 0.2)');
                    beamGrad.addColorStop(1, 'rgba(80, 140, 255, 0.6)');

                    ctx.strokeStyle = beamGrad;
                    ctx.lineWidth = 2 + Math.sin(timestamp / 100) * 1;
                    ctx.setLineDash([4, 4]);
                    ctx.lineDashOffset = -timestamp / 50;
                    ctx.beginPath();
                    ctx.moveTo(hx, hy);
                    ctx.lineTo(nx, ny);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    for (let bt = 0; bt < 1; bt += 0.2) {
                        const bx = hx + (nx - hx) * bt + Math.sin(timestamp / 200 + bt * 10) * 3;
                        const by = hy + (ny - hy) * bt + Math.cos(timestamp / 200 + bt * 10) * 3;
                        ctx.fillStyle = `rgba(80, 180, 255, ${0.5 + Math.sin(timestamp / 150 + bt * 5) * 0.3})`;
                        ctx.beginPath();
                        ctx.arc(bx, by, 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            });
        }

        // SPEED BOOST - motion blur trails
        if (this.activeEffects['lightning']) {
            ctx.globalAlpha = 0.15;
            for (let trail = 1; trail <= 3; trail++) {
                const trailSeg = this.snake[Math.min(trail, len - 1)];
                const tx = ox + trailSeg.x * cs + cs / 2;
                const ty = oy + trailSeg.y * cs + cs / 2;
                ctx.fillStyle = '#fdcb6e';
                ctx.beginPath();
                ctx.arc(tx, ty, cs * 0.3 * (1 - trail * 0.2), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            const head = this.snake[0];
            for (let s = 0; s < 3; s++) {
                const angle = timestamp / 100 + s * 2.1;
                const dist = cs * 0.5 + Math.sin(timestamp / 80 + s) * 5;
                const sx = ox + head.x * cs + cs / 2 + Math.cos(angle) * dist;
                const sy = oy + head.y * cs + cs / 2 + Math.sin(angle) * dist;
                ctx.fillStyle = '#ffd32a';
                ctx.font = `${8 + Math.random() * 4}px sans-serif`;
                ctx.fillText('\u26A1', sx - 5, sy + 3);
            }
        }

        // SLOW MODE - dreamy particles
        if (this.activeEffects['turtle']) {
            for (let i = 0; i < len; i += 2) {
                const seg = this.snake[i];
                const sx = ox + seg.x * cs + cs / 2;
                const sy = oy + seg.y * cs + cs / 2;
                const bubbleSize = 2 + Math.sin(timestamp / 400 + i) * 1.5;
                const bubbleY = sy - cs * 0.4 - Math.sin(timestamp / 500 + i * 0.5) * 5;
                ctx.fillStyle = `rgba(100, 220, 180, ${0.3 + Math.sin(timestamp / 300 + i) * 0.15})`;
                ctx.beginPath();
                ctx.arc(sx + Math.sin(i) * 3, bubbleY, bubbleSize, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // DOUBLE GROWTH - golden sparkles
        if (this.doubleGrowth) {
            const head = this.snake[0];
            for (let s = 0; s < 5; s++) {
                const angle = timestamp / 300 + s * 1.26;
                const dist = cs * 0.5 + Math.sin(timestamp / 200 + s) * 4;
                const sx = ox + head.x * cs + cs / 2 + Math.cos(angle) * dist;
                const sy = oy + head.y * cs + cs / 2 + Math.sin(angle) * dist;
                const sparkSize = 1 + Math.sin(timestamp / 150 + s * 2) * 1;
                ctx.fillStyle = `rgba(255, 211, 42, ${0.5 + Math.sin(timestamp / 100 + s) * 0.3})`;
                ctx.beginPath();
                ctx.arc(sx, sy, sparkSize, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // Draw character-specific face on body segments (2-10)
    _drawBlockFace(ctx, col, colorIdx, segNum, bx, by, cs, m, s, timestamp) {
        const cx = bx + cs * 0.5;
        const cy = by + cs * 0.38;
        const eR = Math.max(2, cs * 0.07);
        const dirX = this.direction.x;
        const dirY = this.direction.y;
        const pupOff = cs * 0.02;

        // Helper: draw a simple round eye
        const drawEye = (ex, ey, r) => {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(ex, ey, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath();
            ctx.arc(ex + dirX * pupOff, ey + dirY * pupOff, r * 0.55, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(ex + dirX * pupOff - r * 0.2, ey + dirY * pupOff - r * 0.2, r * 0.2, 0, Math.PI * 2);
            ctx.fill();
        };

        // Helper: small smile
        const drawSmile = (sx, sy, w) => {
            ctx.strokeStyle = col.dark;
            ctx.lineWidth = Math.max(1, cs * 0.04);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(sx, sy, w, 0.15 * Math.PI, 0.85 * Math.PI);
            ctx.stroke();
        };

        switch (segNum) {
            case 2: // Orange - two eyes with purple/violet tint glasses
                drawEye(cx - eR * 1.3, cy, eR);
                drawEye(cx + eR * 1.3, cy, eR);
                // Purple glasses bridge
                ctx.strokeStyle = '#6c3483';
                ctx.lineWidth = Math.max(1, cs * 0.03);
                ctx.beginPath();
                ctx.moveTo(cx - eR * 0.3, cy);
                ctx.lineTo(cx + eR * 0.3, cy);
                ctx.stroke();
                // Glasses frames
                ctx.strokeStyle = '#6c3483';
                ctx.lineWidth = Math.max(1, cs * 0.035);
                ctx.beginPath();
                ctx.arc(cx - eR * 1.3, cy, eR + 1, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(cx + eR * 1.3, cy, eR + 1, 0, Math.PI * 2);
                ctx.stroke();
                drawSmile(cx, by + cs * 0.62, cs * 0.06);
                break;

            case 3: // Yellow - three triangular decorations on head, red eyes
                drawEye(cx - eR * 1.2, cy, eR);
                drawEye(cx + eR * 1.2, cy, eR);
                // Red eye tint
                ctx.strokeStyle = '#e74c3c';
                ctx.lineWidth = Math.max(1, cs * 0.03);
                ctx.beginPath();
                ctx.arc(cx - eR * 1.2, cy, eR + 1, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(cx + eR * 1.2, cy, eR + 1, 0, Math.PI * 2);
                ctx.stroke();
                // Three triangular spikes on top
                ctx.fillStyle = '#d4ac0d';
                for (let t = -1; t <= 1; t++) {
                    const tx = cx + t * cs * 0.14;
                    const ty = by + m - 1;
                    ctx.beginPath();
                    ctx.moveTo(tx - cs * 0.04, ty + cs * 0.06);
                    ctx.lineTo(tx, ty - cs * 0.04);
                    ctx.lineTo(tx + cs * 0.04, ty + cs * 0.06);
                    ctx.closePath();
                    ctx.fill();
                }
                drawSmile(cx, by + cs * 0.62, cs * 0.06);
                break;

            case 4: // Green - square eyes
                // Square eyes for Four
                const sqE = eR * 1.3;
                ctx.fillStyle = '#fff';
                ctx.fillRect(cx - eR * 1.8 - sqE/2, cy - sqE/2, sqE, sqE);
                ctx.fillRect(cx + eR * 1.8 - sqE/2, cy - sqE/2, sqE, sqE);
                ctx.fillStyle = '#1a1a2e';
                const sqP = sqE * 0.5;
                ctx.fillRect(cx - eR * 1.8 - sqP/2 + dirX * pupOff, cy - sqP/2 + dirY * pupOff, sqP, sqP);
                ctx.fillRect(cx + eR * 1.8 - sqP/2 + dirX * pupOff, cy - sqP/2 + dirY * pupOff, sqP, sqP);
                // Rectangular eyebrows
                ctx.fillStyle = col.dark;
                ctx.fillRect(cx - eR * 1.8 - sqE/2, cy - sqE/2 - cs * 0.04, sqE, cs * 0.03);
                ctx.fillRect(cx + eR * 1.8 - sqE/2, cy - sqE/2 - cs * 0.04, sqE, cs * 0.03);
                drawSmile(cx, by + cs * 0.62, cs * 0.06);
                break;

            case 5: // Blue - star mask on left eye
                drawEye(cx - eR * 1.3, cy, eR);
                drawEye(cx + eR * 1.3, cy, eR);
                // Star mask over left eye
                ctx.fillStyle = '#1a5276';
                const starR = eR * 1.8;
                ctx.beginPath();
                for (let p = 0; p < 5; p++) {
                    const angle = -Math.PI / 2 + (p * 2 * Math.PI / 5);
                    const r = p % 1 === 0 ? starR : starR * 0.5;
                    const sx = cx - eR * 1.3 + Math.cos(angle) * starR;
                    const sy = cy + Math.sin(angle) * starR;
                    const ix = cx - eR * 1.3 + Math.cos(angle + Math.PI / 5) * starR * 0.45;
                    const iy = cy + Math.sin(angle + Math.PI / 5) * starR * 0.45;
                    if (p === 0) ctx.moveTo(sx, sy);
                    else ctx.lineTo(sx, sy);
                    ctx.lineTo(ix, iy);
                }
                ctx.closePath();
                ctx.globalAlpha = 0.3;
                ctx.fill();
                ctx.globalAlpha = 1;
                drawSmile(cx, by + cs * 0.62, cs * 0.06);
                break;

            case 6: // Purple - two eyes with extra eyebrows
                drawEye(cx - eR * 1.3, cy, eR);
                drawEye(cx + eR * 1.3, cy, eR);
                // Red-bordered eyes
                ctx.strokeStyle = '#e74c3c';
                ctx.lineWidth = Math.max(1, cs * 0.025);
                ctx.beginPath();
                ctx.arc(cx - eR * 1.3, cy, eR + 1, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(cx + eR * 1.3, cy, eR + 1, 0, Math.PI * 2);
                ctx.stroke();
                // Three small eyebrow lines on each side
                ctx.strokeStyle = col.dark;
                ctx.lineWidth = Math.max(1, cs * 0.025);
                for (let b = -1; b <= 1; b++) {
                    const bx1 = cx - eR * 1.3 + b * eR * 0.7;
                    const bx2 = cx + eR * 1.3 + b * eR * 0.7;
                    const by1 = cy - eR * 1.6;
                    ctx.beginPath(); ctx.moveTo(bx1, by1); ctx.lineTo(bx1, by1 - cs * 0.03); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(bx2, by1); ctx.lineTo(bx2, by1 - cs * 0.03); ctx.stroke();
                }
                drawSmile(cx, by + cs * 0.62, cs * 0.06);
                break;

            case 7: // Rainbow - horizontal eye slits, yellow features
                // Horizontal slit eyes
                ctx.fillStyle = '#f1c40f';
                ctx.fillRect(cx - eR * 2.2, cy - eR * 0.3, eR * 1.6, eR * 0.6);
                ctx.fillRect(cx + eR * 0.6, cy - eR * 0.3, eR * 1.6, eR * 0.6);
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(cx - eR * 1.6 + dirX * pupOff, cy - eR * 0.15, eR * 0.6, eR * 0.3);
                ctx.fillRect(cx + eR * 1.0 + dirX * pupOff, cy - eR * 0.15, eR * 0.6, eR * 0.3);
                // Yellow mouth (famous grin)
                ctx.strokeStyle = '#f1c40f';
                ctx.lineWidth = Math.max(1, cs * 0.04);
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.arc(cx, by + cs * 0.62, cs * 0.08, 0.1 * Math.PI, 0.9 * Math.PI);
                ctx.stroke();
                break;

            case 8: // Pink - superhero mask hint
                drawEye(cx - eR * 1.3, cy, eR);
                drawEye(cx + eR * 1.3, cy, eR);
                // Mask shape around eyes
                ctx.strokeStyle = '#c2557e';
                ctx.lineWidth = Math.max(1, cs * 0.04);
                ctx.beginPath();
                ctx.moveTo(cx - eR * 2.8, cy);
                ctx.quadraticCurveTo(cx - eR * 1.3, cy - eR * 2, cx, cy - eR * 0.8);
                ctx.quadraticCurveTo(cx + eR * 1.3, cy - eR * 2, cx + eR * 2.8, cy);
                ctx.stroke();
                drawSmile(cx, by + cs * 0.62, cs * 0.06);
                break;

            case 9: // Gray - square eyes & brows (sneezy)
                const sq9 = eR * 1.2;
                ctx.fillStyle = '#fff';
                ctx.fillRect(cx - eR * 1.8 - sq9/2, cy - sq9/2, sq9, sq9);
                ctx.fillRect(cx + eR * 1.8 - sq9/2, cy - sq9/2, sq9, sq9);
                ctx.fillStyle = '#1a1a2e';
                const sp9 = sq9 * 0.5;
                ctx.fillRect(cx - eR * 1.8 - sp9/2 + dirX * pupOff, cy - sp9/2 + dirY * pupOff, sp9, sp9);
                ctx.fillRect(cx + eR * 1.8 - sp9/2 + dirX * pupOff, cy - sp9/2 + dirY * pupOff, sp9, sp9);
                // Square eyebrows
                ctx.fillStyle = '#4d5656';
                ctx.fillRect(cx - eR * 1.8 - sq9/2, cy - sq9/2 - cs * 0.05, sq9, cs * 0.03);
                ctx.fillRect(cx + eR * 1.8 - sq9/2, cy - sq9/2 - cs * 0.05, sq9, cs * 0.03);
                drawSmile(cx, by + cs * 0.62, cs * 0.05);
                break;

            case 10: // White+Red border - two star eyes
                // Star-shaped eyes
                ctx.fillStyle = '#f1c40f';
                for (let side = -1; side <= 1; side += 2) {
                    const starCX = cx + side * eR * 1.5;
                    const starCY = cy;
                    const sr = eR * 1.1;
                    ctx.beginPath();
                    for (let p = 0; p < 5; p++) {
                        const a1 = -Math.PI / 2 + (p * 2 * Math.PI / 5);
                        const a2 = a1 + Math.PI / 5;
                        ctx.lineTo(starCX + Math.cos(a1) * sr, starCY + Math.sin(a1) * sr);
                        ctx.lineTo(starCX + Math.cos(a2) * sr * 0.45, starCY + Math.sin(a2) * sr * 0.45);
                    }
                    ctx.closePath();
                    ctx.fill();
                    // Pupil in star
                    ctx.fillStyle = '#1a1a2e';
                    ctx.beginPath();
                    ctx.arc(starCX + dirX * pupOff, starCY + dirY * pupOff, eR * 0.4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#f1c40f';
                }
                drawSmile(cx, by + cs * 0.62, cs * 0.06);
                break;

            default:
                // Segments beyond 10: simple two eyes
                drawEye(cx - eR * 1.2, cy, eR * 0.8);
                drawEye(cx + eR * 1.2, cy, eR * 0.8);
                break;
        }
    }

    _drawSnakeHead(ctx, px, py, cs, timestamp) {
        // === NUMBERBLOCKS "ONE" - Red block, single big eye ===
        const bounce = Math.sin(timestamp / 300) * 1.5;
        const m = cs * 0.04;
        const size = cs - m * 2;
        const hx = px + m;
        const hy = py + m + bounce;
        const br = cs * 0.16;

        // --- Drop shadow ---
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        this._roundRect(ctx, hx + 2, hy + 3, size, size, br);
        ctx.fill();

        // --- Main red cube block ---
        const grad = ctx.createLinearGradient(hx, hy, hx, hy + size);
        grad.addColorStop(0, '#ff6b6b');
        grad.addColorStop(0.3, '#e74c3c');
        grad.addColorStop(1, '#c0392b');
        ctx.fillStyle = grad;
        this._roundRect(ctx, hx, hy, size, size, br);
        ctx.fill();

        // Block outline
        ctx.strokeStyle = '#a93226';
        ctx.lineWidth = 1.5;
        this._roundRect(ctx, hx, hy, size, size, br);
        ctx.stroke();

        // 3D top highlight
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        this._roundRect(ctx, hx + 2, hy + 2, size - 4, size * 0.3, Math.max(0, br - 1));
        ctx.fill();

        // 3D bottom shadow
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        this._roundRect(ctx, hx + 2, hy + size * 0.72, size - 4, size * 0.24, Math.max(0, br - 1));
        ctx.fill();

        // --- ONE single big eye (center) - One's defining feature ---
        const eyeCX = hx + size * 0.5 + this.direction.x * cs * 0.04;
        const eyeCY = hy + size * 0.38 + this.direction.y * cs * 0.03;
        const eyeW = cs * 0.22;
        const eyeH = cs * 0.26;

        // Eye shadow
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.beginPath();
        ctx.ellipse(eyeCX, eyeCY + 1, eyeW + 2, eyeH + 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // White of eye
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(eyeCX, eyeCY, eyeW, eyeH, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eye outline
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(eyeCX, eyeCY, eyeW, eyeH, 0, 0, Math.PI * 2);
        ctx.stroke();

        // --- Blink animation ---
        this._blinkTimer += 16;
        if (this._blinkTimer > 3500) {
            this._blinkState = true;
            if (this._blinkTimer > 3620) {
                this._blinkState = false;
                this._blinkTimer = 0;
            }
        }

        if (this._blinkState) {
            // Closed eye
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.ellipse(eyeCX, eyeCY, eyeW, eyeH, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#2d3436';
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(eyeCX, eyeCY + 2, eyeW * 0.55, 1.15 * Math.PI, 1.85 * Math.PI);
            ctx.stroke();
        } else {
            // Pupil looking in direction
            const pupOff = cs * 0.06;
            const pupX = this.direction.x * pupOff;
            const pupY = this.direction.y * pupOff;

            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath();
            ctx.ellipse(eyeCX + pupX, eyeCY + pupY, eyeW * 0.6, eyeH * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();

            // Big sparkle
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(eyeCX + pupX - eyeW * 0.25, eyeCY + pupY - eyeH * 0.2, eyeW * 0.2, 0, Math.PI * 2);
            ctx.fill();

            // Small sparkle
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.beginPath();
            ctx.arc(eyeCX + pupX + eyeW * 0.15, eyeCY + pupY + eyeH * 0.15, eyeW * 0.1, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Cute smile ---
        ctx.strokeStyle = '#922b21';
        ctx.lineWidth = Math.max(1.5, cs * 0.06);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(hx + size * 0.5, hy + size * 0.68, cs * 0.09, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();

        // --- Arms (stick figure like Numberblocks) ---
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = Math.max(1.5, cs * 0.05);
        ctx.lineCap = 'round';

        // Left arm (animated wave)
        const laX = hx - 1;
        const laY = hy + size * 0.5;
        ctx.beginPath();
        ctx.moveTo(laX, laY);
        ctx.lineTo(laX - cs * 0.12, laY - cs * 0.08 + Math.sin(timestamp / 300) * 2);
        ctx.stroke();
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(laX - cs * 0.12, laY - cs * 0.08 + Math.sin(timestamp / 300) * 2, Math.max(1.5, cs * 0.04), 0, Math.PI * 2);
        ctx.fill();

        // Right arm
        const raX = hx + size + 1;
        const raY = hy + size * 0.5;
        ctx.strokeStyle = '#c0392b';
        ctx.beginPath();
        ctx.moveTo(raX, raY);
        ctx.lineTo(raX + cs * 0.12, raY - cs * 0.08 + Math.sin(timestamp / 300 + 1) * 2);
        ctx.stroke();
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(raX + cs * 0.12, raY - cs * 0.08 + Math.sin(timestamp / 300 + 1) * 2, Math.max(1.5, cs * 0.04), 0, Math.PI * 2);
        ctx.fill();

        // --- Legs ---
        const legY = hy + size;
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = Math.max(1.5, cs * 0.05);
        ctx.beginPath();
        ctx.moveTo(hx + size * 0.35, legY);
        ctx.lineTo(hx + size * 0.3, legY + cs * 0.1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(hx + size * 0.65, legY);
        ctx.lineTo(hx + size * 0.7, legY + cs * 0.1);
        ctx.stroke();
        // Feet
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.ellipse(hx + size * 0.28, legY + cs * 0.11, Math.max(2, cs * 0.06), Math.max(1, cs * 0.03), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(hx + size * 0.72, legY + cs * 0.11, Math.max(2, cs * 0.06), Math.max(1, cs * 0.03), 0, 0, Math.PI * 2);
        ctx.fill();

        // --- Floating "1" badge above head ---
        const numY = hy - cs * 0.18;
        const numX = hx + size / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        this._roundRect(ctx, numX - cs * 0.12, numY - cs * 0.1, cs * 0.24, cs * 0.2, cs * 0.06);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `900 ${cs * 0.18}px Nunito, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('1', numX, numY);
    }

    _drawNumbers(ctx, cs, ox, oy, timestamp) {
        // Gem/crystal color palette - assigned by array index (NOT value) to avoid hinting
        const gemPalette = [
            { h: 270, s: 80, l: 60, name: 'amethyst' },   // purple
            { h: 175, s: 75, l: 50, name: 'emerald' },    // teal
            { h: 340, s: 80, l: 65, name: 'ruby' },       // pink
            { h: 40,  s: 90, l: 55, name: 'topaz' },      // amber
            { h: 150, s: 70, l: 48, name: 'jade' },       // green
            { h: 210, s: 85, l: 60, name: 'sapphire' },   // blue
            { h: 15,  s: 85, l: 58, name: 'carnelian' },  // orange-red
            { h: 55,  s: 85, l: 55, name: 'citrine' },    // yellow
        ];

        this.numbers.forEach((num, idx) => {
            const px = ox + num.x * cs;
            const py = oy + num.y * cs;
            const age = timestamp - num.spawnTime;

            // Spawn animation: bounce easing scale from 0
            let scale;
            if (age < 400) {
                const t = age / 400;
                // Bounce easing: overshoot then settle
                if (t < 0.6) {
                    scale = (t / 0.6) * 1.2; // overshoot to 1.2
                } else if (t < 0.8) {
                    scale = 1.2 - ((t - 0.6) / 0.2) * 0.25; // settle to 0.95
                } else {
                    scale = 0.95 + ((t - 0.8) / 0.2) * 0.05; // settle to 1.0
                }
            } else {
                scale = 1;
            }

            const float = Math.sin(timestamp / 500 + num.x + num.y) * 2;
            const cx = px + cs / 2;
            const cy = py + cs / 2 + float;
            const radius = Math.max(4, (cs * 0.4) * scale);

            // Subtle wobble rotation
            const wobble = Math.sin(timestamp / 700 + idx * 1.8) * 0.06;

            // Color by INDEX in the array, not by value
            const gem = gemPalette[idx % gemPalette.length];

            // Pulsing glow
            const glowPulse = Math.sin(timestamp / 600 + idx * 1.1) * 0.3 + 0.5;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(wobble);

            // Outer glow aura
            ctx.shadowColor = `hsla(${gem.h}, ${gem.s}%, ${gem.l}%, ${glowPulse * 0.6})`;
            ctx.shadowBlur = 12 + glowPulse * 6;

            // 3D shadow under tile
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.beginPath();
            ctx.arc(2, 3, radius, 0, Math.PI * 2);
            ctx.fill();

            // Main gem body gradient
            const gemGrad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 0, 0, 0, radius);
            gemGrad.addColorStop(0, `hsla(${gem.h}, ${gem.s}%, ${gem.l + 20}%, 0.95)`);
            gemGrad.addColorStop(0.5, `hsla(${gem.h}, ${gem.s}%, ${gem.l}%, 0.85)`);
            gemGrad.addColorStop(1, `hsla(${gem.h}, ${gem.s}%, ${gem.l - 15}%, 0.8)`);
            ctx.fillStyle = gemGrad;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();

            // Glossy highlight (top half)
            const hlGrad = ctx.createLinearGradient(0, -radius, 0, 0);
            hlGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
            hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = hlGrad;
            ctx.beginPath();
            ctx.arc(0, -radius * 0.1, radius * 0.85, Math.PI, Math.PI * 2);
            ctx.fill();

            // Crystal facet highlight (specular spot)
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.beginPath();
            ctx.ellipse(-radius * 0.25, -radius * 0.35, radius * 0.2, radius * 0.12, -0.3, 0, Math.PI * 2);
            ctx.fill();

            // Border ring (gem edge)
            ctx.strokeStyle = `hsla(${gem.h}, ${gem.s}%, ${gem.l + 10}%, 0.7)`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.stroke();

            // Inner ring for 3D raised effect
            ctx.strokeStyle = `hsla(${gem.h}, ${gem.s}%, ${gem.l + 25}%, 0.25)`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(1, radius - 3), 0, Math.PI * 2);
            ctx.stroke();

            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;

            // Number text - auto-size for multi-digit
            const numStr = String(num.value);
            const digits = numStr.length;
            let fontSize = cs * (digits > 3 ? 0.2 : digits > 2 ? 0.26 : digits > 1 ? 0.3 : 0.38);
            fontSize *= scale;

            // Text shadow for depth
            ctx.font = `800 ${fontSize}px Nunito, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = `hsla(${gem.h}, ${gem.s}%, ${gem.l - 30}%, 0.5)`;
            ctx.fillText(numStr, 1, 2);

            // Main text - bright
            ctx.fillStyle = '#ffffff';
            ctx.fillText(numStr, 0, 0);

            ctx.restore();
        });
    }

    _drawItems(ctx, cs, ox, oy, timestamp) {
        // Type-specific aura colors
        const auraColors = {
            star:      { r: 255, g: 200, b: 50  },  // gold
            bomb:      { r: 230, g: 50,  b: 50  },  // red
            turtle:    { r: 50,  g: 200, b: 100 },  // green
            lightning: { r: 255, g: 230, b: 50  },  // yellow
            shield:    { r: 140, g: 80,  b: 230 },  // purple
            heart:     { r: 255, g: 120, b: 170 },  // pink
            magnet:    { r: 80,  g: 140, b: 255 },  // blue
        };

        this.items.forEach(item => {
            const px = ox + item.x * cs;
            const py = oy + item.y * cs;
            const float = Math.sin(timestamp / 400 + item.x * 2) * 3;
            const pulse = 1 + Math.sin(timestamp / 300) * 0.08;
            const age = timestamp - item.spawnTime;
            const remaining = item.lifetime - age;

            // Faster blink when about to expire (last 3 seconds)
            if (remaining < 3000) {
                // Faster blink rate as time runs out
                const blinkSpeed = 60 + (remaining / 3000) * 80; // 60-140ms
                if (Math.sin(timestamp / blinkSpeed) > 0) return;
            }

            const cx = px + cs / 2;
            const cy = py + cs / 2 + float;
            const ac = auraColors[item.type] || auraColors.star;
            const auraStr = `rgba(${ac.r}, ${ac.g}, ${ac.b}`;

            // Orbiting particles (3 particles per item)
            for (let p = 0; p < 3; p++) {
                const orbitAngle = (timestamp / 800) + (p * Math.PI * 2 / 3) + item.x * 0.5;
                const orbitR = cs * 0.42;
                const opx = cx + Math.cos(orbitAngle) * orbitR;
                const opy = cy + Math.sin(orbitAngle) * orbitR;
                const particleAlpha = 0.4 + Math.sin(timestamp / 200 + p) * 0.2;
                ctx.fillStyle = `${auraStr}, ${particleAlpha})`;
                ctx.beginPath();
                ctx.arc(opx, opy, 1.5 + Math.sin(timestamp / 300 + p) * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }

            // Glowing aura
            ctx.shadowColor = `${auraStr}, 0.5)`;
            ctx.shadowBlur = 14;

            // Background circle with type-specific color
            ctx.beginPath();
            ctx.arc(cx, cy, cs * 0.38 * pulse, 0, Math.PI * 2);
            const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cs * 0.38 * pulse);
            bgGrad.addColorStop(0, `${auraStr}, 0.25)`);
            bgGrad.addColorStop(1, `${auraStr}, 0.05)`);
            ctx.fillStyle = bgGrad;
            ctx.fill();
            ctx.strokeStyle = `${auraStr}, 0.5)`;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;

            // Icon
            ctx.font = `${cs * 0.45 * pulse}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.icon, cx, cy);
        });
    }

    _drawParticles(ctx) {
        const ox = this.offsetX;
        const oy = this.offsetY;
        this.particles.forEach(p => {
            const fadeSize = p.size * p.life;
            if (fadeSize < 0.2) return;

            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(ox + p.x, oy + p.y, fadeSize, 0, Math.PI * 2);
            ctx.fill();

            // Sparkle effect: occasional bright flash on some particles
            const sparkle = Math.sin(performance.now() / 80 + p.x * 7 + p.y * 13);
            if (sparkle > 0.92 && p.life > 0.4) {
                ctx.globalAlpha = p.life * 0.9;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(ox + p.x, oy + p.y, fadeSize * 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        ctx.globalAlpha = 1;
    }

    _lerp(a, b, t) {
        return a + (b - a) * t;
    }

    _getSmoothedPosition(segIndex, ox, oy, cs) {
        const seg = this.snake[segIndex];
        const px = ox + seg.x * cs;
        const py = oy + seg.y * cs;

        if (this._prevPositions.length > segIndex) {
            const prev = this._prevPositions[segIndex];
            const prevPx = ox + prev.x * cs;
            const prevPy = oy + prev.y * cs;

            // Handle wrapping - don't lerp across the map
            const dx = Math.abs(seg.x - prev.x);
            const dy = Math.abs(seg.y - prev.y);
            if (dx > 1 || dy > 1) return { x: px, y: py };

            const t = this._moveProgress;
            return {
                x: this._lerp(prevPx, px, t),
                y: this._lerp(prevPy, py, t)
            };
        }
        return { x: px, y: py };
    }

    _roundRect(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    getSnakeLength() {
        return this.snake.length + this.growPending;
    }

    getTotalCombo() { return this.combo; }
}

window.SnakeGame = SnakeGame;
