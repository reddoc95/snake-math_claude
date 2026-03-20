/* ============================================
   Sound Engine - Web Audio API
   ============================================ */
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.vibrationEnabled = true;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    play(type) {
        if (!this.enabled || !this.ctx) return;
        this.resume();
        switch (type) {
            case 'correct': this._playCorrect(); break;
            case 'wrong': this._playWrong(); break;
            case 'eat': this._playEat(); break;
            case 'item': this._playItem(); break;
            case 'levelup': this._playLevelUp(); break;
            case 'gameover': this._playGameOver(); break;
            case 'move': this._playMove(); break;
            case 'combo': this._playCombo(); break;
            case 'shield': this._playShield(); break;
            case 'bomb': this._playBomb(); break;
            case 'click': this._playClick(); break;
        }
    }

    vibrate(pattern) {
        if (this.vibrationEnabled && navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    }

    _osc(freq, type, duration, gainVal = 0.3, delay = 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + delay);
        osc.stop(this.ctx.currentTime + delay + duration);
    }

    _playCorrect() {
        this._osc(523, 'sine', 0.15, 0.25);
        this._osc(659, 'sine', 0.15, 0.25, 0.08);
        this._osc(784, 'sine', 0.2, 0.25, 0.16);
        this.vibrate(30);
    }

    _playWrong() {
        this._osc(200, 'sawtooth', 0.3, 0.15);
        this._osc(150, 'sawtooth', 0.3, 0.15, 0.1);
        this.vibrate([50, 30, 50]);
    }

    _playEat() {
        this._osc(440, 'sine', 0.1, 0.2);
        this._osc(550, 'sine', 0.1, 0.2, 0.05);
    }

    _playItem() {
        this._osc(880, 'sine', 0.1, 0.2);
        this._osc(1100, 'sine', 0.1, 0.2, 0.08);
        this._osc(1320, 'sine', 0.15, 0.2, 0.16);
        this.vibrate([20, 20, 20]);
    }

    _playLevelUp() {
        const notes = [523, 659, 784, 1047];
        notes.forEach((f, i) => this._osc(f, 'sine', 0.25, 0.2, i * 0.12));
        this.vibrate([50, 50, 50, 50, 100]);
    }

    _playGameOver() {
        this._osc(440, 'sawtooth', 0.4, 0.15);
        this._osc(370, 'sawtooth', 0.4, 0.15, 0.2);
        this._osc(330, 'sawtooth', 0.5, 0.15, 0.4);
        this._osc(262, 'sawtooth', 0.8, 0.15, 0.6);
        this.vibrate([100, 50, 100, 50, 200]);
    }

    _playMove() {
        this._osc(300, 'sine', 0.03, 0.05);
    }

    _playCombo() {
        this._osc(660, 'triangle', 0.12, 0.2);
        this._osc(880, 'triangle', 0.12, 0.2, 0.06);
        this._osc(1100, 'triangle', 0.15, 0.25, 0.12);
    }

    _playShield() {
        this._osc(600, 'sine', 0.2, 0.15);
        this._osc(800, 'sine', 0.15, 0.15, 0.1);
    }

    _playBomb() {
        // Low rumble
        this._osc(80, 'sawtooth', 0.5, 0.2);
        this._osc(60, 'square', 0.4, 0.1, 0.1);
        this.vibrate([100, 30, 100]);
    }

    _playClick() {
        this._osc(800, 'sine', 0.05, 0.1);
    }
}

window.soundEngine = new SoundEngine();
