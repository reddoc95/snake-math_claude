/* ============================================
   Snake Math - UI Controller
   ============================================ */
(function () {
    'use strict';

    let game = null;
    let tutorialStep = 0;
    const MAX_LEVEL = 10;

    // Current user
    let currentUser = null;  // { id, username }
    let timerInterval = null;

    // ============ DOM refs ============
    const $ = id => document.getElementById(id);
    const screens = {
        auth: $('auth-screen'),
        splash: $('splash-screen'),
        level: $('level-screen'),
        ranking: $('ranking-screen'),
        tutorial: $('tutorial-screen'),
        game: $('game-screen'),
    };
    const modals = {
        pause: $('pause-modal'),
        clear: $('clear-modal'),
        gameover: $('gameover-modal'),
    };

    // ============ Screen Management ============
    function showScreen(name, callback) {
        const current = document.querySelector('.screen.active');
        const delay = current ? 150 : 0;

        if (current && current !== screens[name]) {
            current.classList.add('leaving');
            setTimeout(() => {
                current.classList.remove('active', 'leaving');
            }, 300);
        }

        if (screens[name]) {
            setTimeout(() => {
                screens[name].classList.add('active', 'entering');
                setTimeout(() => screens[name].classList.remove('entering'), 300);
                if (callback) callback();
            }, delay);
        } else if (callback) {
            callback();
        }
    }

    function showModal(name) {
        Object.values(modals).forEach(m => m.classList.remove('active'));
        if (modals[name]) modals[name].classList.add('active');
    }

    function hideModals() {
        Object.values(modals).forEach(m => m.classList.remove('active'));
    }

    // ============ Auth System (LocalStorage-based) ============
    function getUsers() {
        try { return JSON.parse(localStorage.getItem('snakemath_users') || '{}'); }
        catch { return {}; }
    }
    function saveUsers(users) {
        localStorage.setItem('snakemath_users', JSON.stringify(users));
    }

    function getUserData(username) {
        const users = getUsers();
        if (!users[username]) {
            users[username] = {
                password: '',
                bestScore: 0,
                bestCombo: 0,
                maxLevel: 0,
                levelTimes: {},  // { "1": 45000, "2": 62000, ... } (ms)
                totalGames: 0
            };
        }
        return users[username];
    }

    function saveUserData(username, data) {
        const users = getUsers();
        users[username] = data;
        saveUsers(users);
    }

    function setupAuth() {
        // Tab switching
        $('tab-login').addEventListener('click', () => {
            $('tab-login').classList.add('active');
            $('tab-register').classList.remove('active');
            $('login-form').style.display = 'flex';
            $('register-form').style.display = 'none';
        });
        $('tab-register').addEventListener('click', () => {
            $('tab-register').classList.add('active');
            $('tab-login').classList.remove('active');
            $('register-form').style.display = 'flex';
            $('login-form').style.display = 'none';
        });

        // Login
        $('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const id = $('login-id').value.trim();
            const pw = $('login-pw').value;
            if (!id || !pw) { alert('아이디와 비밀번호를 입력하세요.'); return; }
            const users = getUsers();
            if (!users[id]) { alert('존재하지 않는 아이디입니다.'); return; }
            if (users[id].password !== pw) { alert('비밀번호가 일치하지 않습니다.'); return; }
            loginUser(id);
        });

        // Register
        $('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const id = $('reg-id').value.trim();
            const pw = $('reg-pw').value;
            const pw2 = $('reg-pw2').value;
            if (id.length < 4) { alert('아이디는 4자 이상이어야 합니다.'); return; }
            if (pw.length < 4) { alert('비밀번호는 4자 이상이어야 합니다.'); return; }
            if (pw !== pw2) { alert('비밀번호가 일치하지 않습니다.'); return; }
            const users = getUsers();
            if (users[id]) { alert('이미 사용 중인 아이디입니다.'); return; }
            users[id] = { password: pw, bestScore: 0, bestCombo: 0, maxLevel: 0, levelTimes: {}, totalGames: 0 };
            saveUsers(users);
            loginUser(id);
        });

        // Guest
        $('btn-guest').addEventListener('click', () => {
            loginUser('__guest__');
        });

        // Logout
        $('btn-logout').addEventListener('click', () => {
            currentUser = null;
            localStorage.removeItem('snakemath_currentUser');
            showScreen('auth');
        });

        // Auto-login
        const saved = localStorage.getItem('snakemath_currentUser');
        if (saved) {
            loginUser(saved, true);
        }
    }

    function loginUser(username, silent) {
        currentUser = username;
        localStorage.setItem('snakemath_currentUser', username);

        if (username === '__guest__') {
            $('user-info').style.display = 'flex';
            $('user-name').textContent = '👤 게스트';
        } else {
            $('user-info').style.display = 'flex';
            $('user-name').textContent = '👤 ' + username;
        }

        updateBestRecord();
        showScreen('splash');
    }

    // ============ Init ============
    function createStars() {
        const container = $('stars-container');
        if (!container) return;
        for (let i = 0; i < 50; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 100 + '%';
            star.style.animationDelay = Math.random() * 3 + 's';
            star.style.animationDuration = (2 + Math.random() * 3) + 's';
            container.appendChild(star);
        }
    }

    function init() {
        setupAuth();
        setupSplash();
        setupLevelSelect();
        setupRanking();
        setupTutorial();
        setupGameControls();
        setupModals();
        setupSettings();
        createStars();
    }

    // ============ Splash ============
    function setupSplash() {
        $('btn-start').addEventListener('click', () => {
            soundEngine.init();
            soundEngine.play('click');
            const hasTutorial = localStorage.getItem('snakemath_tutorialDone');
            if (!hasTutorial) {
                showTutorial();
            } else {
                startGame(1);
            }
        });

        $('btn-level-select').addEventListener('click', () => {
            soundEngine.init();
            soundEngine.play('click');
            showLevelSelect();
        });

        $('btn-ranking').addEventListener('click', () => {
            soundEngine.init();
            soundEngine.play('click');
            showRanking('score');
        });
    }

    function updateBestRecord() {
        const data = currentUser ? getUserData(currentUser) : null;
        if (!data) return;

        const maxLevel = data.maxLevel || parseInt(localStorage.getItem('snakemath_maxLevel') || '0');
        const bestScore = data.bestScore || parseInt(localStorage.getItem('snakemath_bestScore') || '0');
        const bestCombo = data.bestCombo || 0;

        if (maxLevel > 0 || bestScore > 0) {
            $('best-record').style.display = 'flex';
            $('best-level').textContent = maxLevel;
            $('best-score').textContent = bestScore.toLocaleString();
            $('best-combo').textContent = bestCombo;
        } else {
            $('best-record').style.display = 'none';
        }
    }

    // ============ Level Select ============
    function setupLevelSelect() {
        $('btn-back-level').addEventListener('click', () => {
            soundEngine.play('click');
            showScreen('splash');
        });
    }

    function showLevelSelect() {
        const grid = $('level-grid');
        grid.innerHTML = '';
        const data = currentUser ? getUserData(currentUser) : {};
        const maxUnlocked = Math.max(1, data.maxLevel || parseInt(localStorage.getItem('snakemath_maxLevel') || '1'));

        for (let i = 1; i <= MAX_LEVEL; i++) {
            const config = window.mathGenerator.getLevelConfig(i);
            const card = document.createElement('div');
            card.className = 'level-card';

            const clearTime = data.levelTimes && data.levelTimes[i] ? formatTime(data.levelTimes[i]) : '';

            if (i <= maxUnlocked) {
                card.classList.add(i < maxUnlocked ? 'cleared' : 'unlocked');
                card.innerHTML = `
                    <span class="level-num">${i}</span>
                    <span class="level-desc">${config.desc.replace('\n', '<br>')}</span>
                    ${i < maxUnlocked ? '<span class="level-stars">⭐⭐⭐</span>' : ''}
                    ${clearTime ? `<span class="level-time">${clearTime}</span>` : ''}
                `;
                card.addEventListener('click', () => {
                    soundEngine.play('click');
                    startGame(i);
                });
            } else {
                card.classList.add('locked');
                card.innerHTML = `
                    <span class="lock-icon">🔒</span>
                    <span class="level-desc">${config.desc.replace('\n', '<br>')}</span>
                `;
            }

            grid.appendChild(card);
        }

        showScreen('level');
    }

    // ============ Ranking ============
    function setupRanking() {
        $('btn-back-ranking').addEventListener('click', () => {
            soundEngine.play('click');
            showScreen('splash');
        });

        document.querySelectorAll('.rank-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.rank-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                showRanking(tab.dataset.tab);
            });
        });
    }

    function showRanking(type) {
        const list = $('ranking-list');
        list.innerHTML = '';

        const users = getUsers();
        const entries = [];

        for (const [username, data] of Object.entries(users)) {
            if (username === '__guest__') continue;
            if (type === 'score') {
                entries.push({ name: username, value: data.bestScore || 0, display: (data.bestScore || 0).toLocaleString() + '점' });
            } else if (type === 'combo') {
                entries.push({ name: username, value: data.bestCombo || 0, display: (data.bestCombo || 0) + ' 콤보' });
            } else if (type === 'time') {
                // Show best total clear time across all levels
                const times = data.levelTimes || {};
                const totalLevels = Object.keys(times).length;
                if (totalLevels > 0) {
                    const best = Math.min(...Object.values(times));
                    entries.push({ name: username, value: -totalLevels * 1000000 + best, display: `${totalLevels}단계 (최고 ${formatTime(best)})`, sortAsc: true });
                }
            }
        }

        // Sort
        if (type === 'time') {
            entries.sort((a, b) => a.value - b.value);
        } else {
            entries.sort((a, b) => b.value - a.value);
        }

        if (entries.length === 0) {
            list.innerHTML = '<div class="rank-empty">아직 기록이 없습니다.<br>게임을 시작해보세요! 🎮</div>';
            showScreen('ranking');
            return;
        }

        entries.forEach((entry, idx) => {
            const item = document.createElement('div');
            item.className = 'rank-item';
            if (idx < 3) item.classList.add('top3');
            if (entry.name === currentUser) item.classList.add('me');

            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx + 1);
            item.innerHTML = `
                <span class="rank-position">${medal}</span>
                <span class="rank-name">${entry.name}</span>
                <span class="rank-value">${entry.display}</span>
            `;
            list.appendChild(item);
        });

        showScreen('ranking');
    }

    // ============ Tutorial ============
    function showTutorial() {
        tutorialStep = 0;
        updateTutorialSlide();
        showScreen('tutorial');
    }

    function setupTutorial() {
        // Create dots
        const dotsEl = $('tutorial-dots');
        const slides = document.querySelectorAll('.tutorial-slide');
        slides.forEach((_, i) => {
            const dot = document.createElement('div');
            dot.className = 'tutorial-dot' + (i === 0 ? ' active' : '');
            dotsEl.appendChild(dot);
        });

        $('btn-tutorial-next').addEventListener('click', () => {
            soundEngine.play('click');
            tutorialStep++;
            if (tutorialStep >= slides.length) {
                localStorage.setItem('snakemath_tutorialDone', '1');
                startGame(1);
            } else {
                updateTutorialSlide();
            }
        });

        $('btn-tutorial-skip').addEventListener('click', () => {
            soundEngine.play('click');
            localStorage.setItem('snakemath_tutorialDone', '1');
            startGame(1);
        });
    }

    function updateTutorialSlide() {
        const slides = document.querySelectorAll('.tutorial-slide');
        const dots = document.querySelectorAll('.tutorial-dot');

        slides.forEach((s, i) => {
            s.classList.toggle('active', i === tutorialStep);
        });
        dots.forEach((d, i) => {
            d.classList.toggle('active', i === tutorialStep);
        });

        $('btn-tutorial-next').textContent =
            tutorialStep === slides.length - 1 ? '시작하기!' : '다음';
    }

    // ============ Game ============
    function startGame(level) {
        hideModals();
        showScreen('game', () => {
            const canvas = $('game-canvas');
            if (game) game.destroy();
            game = new SnakeGame(canvas);

            // Callbacks
            game.onUpdateHUD = () => updateGameHUD();
            game.onCorrect = (combo) => showToast('correct', combo);
            game.onWrong = (shielded) => showToast('wrong', 0, shielded);
            game.onLevelClear = (data) => showLevelClear(data);
            game.onGameOver = (data) => showGameOver(data);
            game.onLifeLost = (lives, reason) => updateLives(lives, reason);
            game.onCombo = (combo) => showCombo(combo);
            game.onItemCollect = (item) => showItemToast(item);

            game.init(level);
            updateGameHUD();

            // Show game overlay tutorial
            showGameOverlay();

            // Start timer display
            startTimerDisplay();
        });
    }

    function showGameOverlay() {
        const overlay = $('game-overlay');
        if (!overlay) return;

        // Only show overlay once per session
        if (localStorage.getItem('snakemath_overlayShown')) {
            overlay.classList.add('hidden');
            return;
        }

        overlay.classList.remove('hidden');

        // Pause game while overlay shown
        if (game) game.pause();

        let dismissed = false;
        const dismiss = (e) => {
            if (dismissed) return;
            dismissed = true;
            if (e) e.stopPropagation();
            overlay.classList.add('hidden');
            overlay.removeEventListener('click', dismiss);
            overlay.removeEventListener('touchend', dismiss);
            localStorage.setItem('snakemath_overlayShown', '1');
            // Protect from visibilitychange pausing right after resume
            _pauseProtectUntil = Date.now() + 2000;
            // Resume after a short delay to avoid event propagation issues
            setTimeout(() => {
                if (game && game.state === 'paused') game.resume();
            }, 100);
        };
        overlay.addEventListener('click', dismiss);
        overlay.addEventListener('touchend', dismiss, { passive: false });
    }

    function startTimerDisplay() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (!game || game.state !== 'playing') return;
            const elapsed = game.levelElapsedTime || 0;
            $('hud-timer').textContent = '⏱ ' + formatTime(elapsed);
        }, 500);
    }

    function formatTime(ms) {
        const totalSec = Math.floor(ms / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        return min + ':' + String(sec).padStart(2, '0');
    }

    function updateGameHUD() {
        if (!game) return;

        // Problem display with styled blank
        if (!game.problem) return;
        const parts = game.problem.displayParts;
        let html = '';
        parts.forEach(p => {
            if (p.type === 'blank') {
                html += '<span class="blank">?</span>';
            } else {
                html += `<span>${p.value}</span>`;
            }
        });
        $('problem-text').innerHTML = html;

        // Level & Score
        $('hud-level').textContent = `단계 ${game.level}`;
        $('hud-score').textContent = `${game.score}점`;

        // Combo display in HUD
        const totalCombo = game.getTotalCombo ? game.getTotalCombo() : 0;
        const streak = game.combo || 0;
        const comboEl = $('hud-combo');
        if (streak >= 2) {
            comboEl.textContent = `🔥 ${streak}연속 (총 ${totalCombo})`;
            comboEl.classList.add('active');
        } else {
            comboEl.textContent = `🔥 총 ${totalCombo} 콤보`;
            comboEl.classList.remove('active');
        }

        // Score popup animation
        if (game.score > 0) {
            const popup = $('score-popup');
            if (popup && game._lastDisplayedScore !== undefined && game.score > game._lastDisplayedScore) {
                const diff = game.score - game._lastDisplayedScore;
                popup.textContent = `+${diff}`;
                popup.className = 'score-popup show';
                const scoreEl = $('hud-score');
                scoreEl.classList.add('pop');
                setTimeout(() => {
                    popup.className = 'score-popup';
                    scoreEl.classList.remove('pop');
                }, 800);
            }
            game._lastDisplayedScore = game.score;
        }

        // Progress
        const len = game.getSnakeLength();
        const target = game.levelConfig.target;
        const pct = Math.min(100, (len / target) * 100);
        $('progress-fill').style.width = pct + '%';
        $('progress-label').textContent = `${len} / ${target}`;

        // Active effects
        updateActiveItems();
    }

    function updateLives(lives, reason) {
        const container = $('hud-lives');
        const hearts = container.querySelectorAll('.heart');
        hearts.forEach((h, i) => {
            h.classList.toggle('lost', i >= lives);
        });
        if (reason !== 'heal' && reason !== undefined) {
            container.classList.add('shake');
            setTimeout(() => container.classList.remove('shake'), 500);
        }
    }

    function updateActiveItems() {
        const container = $('active-items');
        container.innerHTML = '';

        if (!game) return;

        for (const [key, effect] of Object.entries(game.activeEffects)) {
            if (!effect.endTime) continue;
            const remaining = effect.endTime - performance.now();
            if (remaining <= 0) continue;

            const pct = Math.max(0, (remaining / 15000) * 100);

            const badge = document.createElement('div');
            badge.className = 'active-item-badge';
            badge.innerHTML = `
                <span>${effect.icon}</span>
                <span>${effect.name}</span>
                <div class="timer-bar"><div class="timer-fill" style="width:${pct}%"></div></div>
            `;
            container.appendChild(badge);
        }
    }

    // ============ Toast / Feedback ============
    function showToast(type, combo, shielded) {
        const toast = $('toast');
        toast.className = 'toast';

        if (type === 'correct') {
            const msgs1 = ['정답!', '잘했어요!', '멋져요!', '최고!'];
            const msgs3 = ['🔥 대단해요!', '✨ 천재!', '💫 놀라워요!'];
            const msgs5 = ['🌟 AMAZING!', '🔥 INCREDIBLE!', '⚡ UNSTOPPABLE!'];

            let msg;
            if (combo >= 5) msg = msgs5[Math.floor(Math.random() * msgs5.length)];
            else if (combo >= 3) msg = msgs3[Math.floor(Math.random() * msgs3.length)];
            else msg = '⭕ ' + msgs1[Math.floor(Math.random() * msgs1.length)];

            toast.textContent = msg;
            toast.classList.add('correct');

            const flash = document.createElement('div');
            flash.className = 'screen-flash correct-flash';
            document.getElementById('game-screen').appendChild(flash);
            setTimeout(() => flash.remove(), 500);

        } else {
            toast.textContent = shielded ? '🛡️ 보호막 발동!' : '❌ 다시 도전!';
            toast.classList.add('wrong');

            if (!shielded) {
                const flash = document.createElement('div');
                flash.className = 'screen-flash wrong-flash';
                document.getElementById('game-screen').appendChild(flash);
                setTimeout(() => flash.remove(), 400);
            }
        }

        requestAnimationFrame(() => {
            toast.classList.add('show');
            setTimeout(() => { toast.className = 'toast'; }, 1200);
        });
    }

    function showCombo(combo) {
        const display = $('combo-display');
        const flames = '🔥'.repeat(Math.min(combo - 2, 5));
        display.innerHTML = `${flames}<br><span class="combo-number">${combo}</span> COMBO!`;
        display.className = 'combo-display';
        display.style.fontSize = Math.min(32 + combo * 4, 56) + 'px';
        requestAnimationFrame(() => {
            display.classList.add('show');
            setTimeout(() => { display.className = 'combo-display'; }, 1200);
        });
    }

    function showItemToast(item) {
        const toast = $('toast');
        toast.className = 'toast correct';
        toast.textContent = `${item.icon} ${item.name || item.type}`;
        requestAnimationFrame(() => {
            toast.classList.add('show');
            setTimeout(() => { toast.className = 'toast'; }, 800);
        });
    }

    // ============ Level Clear ============
    function showLevelClear(data) {
        if (timerInterval) clearInterval(timerInterval);

        $('clear-level').textContent = data.level;
        $('clear-accuracy').textContent = data.accuracy + '%';
        $('clear-score').textContent = data.score;
        $('clear-combo').textContent = data.maxCombo || 0;
        $('clear-time').textContent = formatTime(data.time || 0);

        // Save user data
        if (currentUser) {
            const userData = getUserData(currentUser);
            if (data.score > (userData.bestScore || 0)) userData.bestScore = data.score;
            if ((data.maxCombo || 0) > (userData.bestCombo || 0)) userData.bestCombo = data.maxCombo;
            const nextLevel = data.level + 1;
            if (nextLevel > (userData.maxLevel || 0)) userData.maxLevel = nextLevel;

            // Save level clear time (best time)
            if (!userData.levelTimes) userData.levelTimes = {};
            const prevTime = userData.levelTimes[data.level];
            if (!prevTime || (data.time && data.time < prevTime)) {
                userData.levelTimes[data.level] = data.time;
            }
            userData.totalGames = (userData.totalGames || 0) + 1;
            saveUserData(currentUser, userData);
        }

        // Also save to generic localStorage for backward compat
        const maxLevel = parseInt(localStorage.getItem('snakemath_maxLevel') || '1');
        if (data.level + 1 > maxLevel) {
            localStorage.setItem('snakemath_maxLevel', String(data.level + 1));
        }

        showModal('clear');
        spawnConfetti();
    }

    function spawnConfetti() {
        const container = $('confetti-container');
        container.innerHTML = '';
        const colors = ['#6c5ce7', '#fd79a8', '#00cec9', '#fdcb6e', '#00b894', '#e17055', '#a29bfe', '#ff7675'];
        const shapes = ['circle', 'square', 'triangle'];

        for (let i = 0; i < 80; i++) {
            const conf = document.createElement('div');
            const shape = shapes[Math.floor(Math.random() * shapes.length)];
            conf.className = `confetti confetti-${shape}`;
            conf.style.left = Math.random() * 100 + '%';
            conf.style.background = colors[Math.floor(Math.random() * colors.length)];
            conf.style.animationDelay = Math.random() * 1.5 + 's';
            conf.style.animationDuration = (2 + Math.random() * 2) + 's';
            conf.style.width = (6 + Math.random() * 10) + 'px';
            conf.style.height = (6 + Math.random() * 10) + 'px';
            container.appendChild(conf);
        }
    }

    // ============ Game Over ============
    function showGameOver(data) {
        if (timerInterval) clearInterval(timerInterval);

        $('over-level').textContent = data.level;
        $('over-score').textContent = data.score;
        $('over-accuracy').textContent = data.accuracy + '%';
        $('over-combo').textContent = data.maxCombo || 0;

        // Save user data
        if (currentUser) {
            const userData = getUserData(currentUser);
            if (data.score > (userData.bestScore || 0)) userData.bestScore = data.score;
            if ((data.maxCombo || 0) > (userData.bestCombo || 0)) userData.bestCombo = data.maxCombo;
            userData.totalGames = (userData.totalGames || 0) + 1;
            saveUserData(currentUser, userData);
        }

        showModal('gameover');
    }

    // ============ Modals ============
    function setupModals() {
        // Pause
        $('btn-pause').addEventListener('click', () => {
            if (game) {
                game.pause();
                $('pause-level').textContent = game.level;
                $('pause-length').textContent = game.getSnakeLength();
                showModal('pause');
            }
        });

        $('btn-resume').addEventListener('click', () => {
            soundEngine.play('click');
            hideModals();
            if (game) game.resume();
        });

        $('btn-restart').addEventListener('click', () => {
            soundEngine.play('click');
            hideModals();
            if (game) startGame(game.level);
        });

        $('btn-quit').addEventListener('click', () => {
            soundEngine.play('click');
            hideModals();
            if (game) game.destroy();
            if (timerInterval) clearInterval(timerInterval);
            showScreen('splash');
            updateBestRecord();
        });

        // Level Clear
        $('btn-next-level').addEventListener('click', () => {
            soundEngine.play('click');
            hideModals();
            if (game) {
                const nextLevel = game.level + 1;
                game.continueLevel(nextLevel);
                updateGameHUD();
                startTimerDisplay();
            }
        });

        // Game Over
        $('btn-retry').addEventListener('click', () => {
            soundEngine.play('click');
            hideModals();
            if (game) startGame(game.level);
        });

        $('btn-home').addEventListener('click', () => {
            soundEngine.play('click');
            hideModals();
            if (game) game.destroy();
            if (timerInterval) clearInterval(timerInterval);
            showScreen('splash');
            updateBestRecord();
        });
    }

    // ============ Settings ============
    function setupSettings() {
        const soundToggle = $('toggle-sound');
        const vibToggle = $('toggle-vibration');

        // Load settings
        soundToggle.checked = localStorage.getItem('snakemath_sound') !== 'false';
        vibToggle.checked = localStorage.getItem('snakemath_vibration') !== 'false';

        soundEngine.enabled = soundToggle.checked;
        soundEngine.vibrationEnabled = vibToggle.checked;

        soundToggle.addEventListener('change', () => {
            localStorage.setItem('snakemath_sound', soundToggle.checked);
            soundEngine.enabled = soundToggle.checked;
        });

        vibToggle.addEventListener('change', () => {
            localStorage.setItem('snakemath_vibration', vibToggle.checked);
            soundEngine.vibrationEnabled = vibToggle.checked;
        });
    }

    // ============ Controls ============
    function setupGameControls() {
        // Swipe detection
        let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
        const canvas = $('game-canvas');

        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchStartTime = Date.now();
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });

        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (!e.changedTouches[0]) return;

            const touch = e.changedTouches[0];
            const dx = touch.clientX - touchStartX;
            const dy = touch.clientY - touchStartY;
            const dt = Date.now() - touchStartTime;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 15 || dt > 500) return;

            if (Math.abs(dx) > Math.abs(dy)) {
                game && game.setDirection(dx > 0 ? 'right' : 'left');
            } else {
                game && game.setDirection(dy > 0 ? 'down' : 'up');
            }
            soundEngine.play('move');
        }, { passive: false });

        // Keyboard (for testing)
        document.addEventListener('keydown', (e) => {
            if (!game) return;
            const map = {
                'ArrowUp': 'up', 'ArrowDown': 'down',
                'ArrowLeft': 'left', 'ArrowRight': 'right',
                'w': 'up', 's': 'down', 'a': 'left', 'd': 'right'
            };
            if (map[e.key]) {
                e.preventDefault();
                game.setDirection(map[e.key]);
            }
            if (e.key === 'Escape' || e.key === 'p') {
                if (game.state === 'playing') {
                    game.pause();
                    $('pause-level').textContent = game.level;
                    $('pause-length').textContent = game.getSnakeLength();
                    showModal('pause');
                } else if (game.state === 'paused') {
                    hideModals();
                    game.resume();
                }
            }
        });

        // Prevent context menu
        canvas.addEventListener('contextmenu', e => e.preventDefault());

        // Prevent scroll bounce on iOS
        document.body.addEventListener('touchmove', (e) => {
            if (screens.game.classList.contains('active')) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    // ============ Service Worker ============
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(() => {});
        });
    }

    // ============ Boot ============
    document.addEventListener('DOMContentLoaded', init);

    // Wake lock to prevent screen sleep
    async function requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                await navigator.wakeLock.request('screen');
            }
        } catch (e) {}
    }
    let _pauseProtectUntil = 0;
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            requestWakeLock();
        } else if (game && game.state === 'playing' && Date.now() > _pauseProtectUntil) {
            // Don't pause if overlay is still showing
            const overlay = $('game-overlay');
            if (overlay && !overlay.classList.contains('hidden')) return;
            game.pause();
            $('pause-level').textContent = game.level;
            $('pause-length').textContent = game.getSnakeLength();
            showModal('pause');
        }
    });

})();
