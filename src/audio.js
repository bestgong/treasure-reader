// 音频系统 - 混合 Web Audio 合成 + CC0 短音效
// - 短音效（答对/答错/铃声/号角）用 Web Audio 合成，0 依赖 0 请求
// - 主题 BGM 用 howler.js（CDN 加载），CC0 素材来自 freesound / opengameart（在 README 中注明）
// - 用户偏好持久化到 localStorage
// - 默认关闭，避免图书馆/公共场合尴尬

const STORAGE_KEY = 'treasure-reader-audio-v1';

const defaultPrefs = {
  sfxOn: true,        // 短音效（答对/答错等）
  bgmOn: false,       // 背景音乐
  volume: 0.5,
};

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultPrefs };
    return { ...defaultPrefs, ...JSON.parse(raw) };
  } catch { return { ...defaultPrefs }; }
}

function savePrefs(p) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
}

class AudioEngine {
  constructor() {
    this.prefs = loadPrefs();
    this.ctx = null;
    this.bgm = null;      // 当前播放的 Howl 实例
    this.bgmName = null;
  }

  _ensureCtx() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) this.ctx = new Ctx();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  setSfxOn(on) { this.prefs.sfxOn = !!on; savePrefs(this.prefs); }
  setBgmOn(on) {
    this.prefs.bgmOn = !!on;
    savePrefs(this.prefs);
    if (!on && this.bgm) this.bgm.pause();
    else if (on && this.bgm) this.bgm.play();
  }
  setVolume(v) {
    this.prefs.volume = Math.max(0, Math.min(1, v));
    savePrefs(this.prefs);
    if (this.bgm) this.bgm.volume(this.prefs.volume);
  }
  getPrefs() { return { ...this.prefs }; }

  // === SFX：Web Audio 合成 ===
  _tone({ freq = 440, type = 'sine', dur = 0.2, vol = 0.3, attack = 0.005, decay = 0.1, freq2 = null }) {
    if (!this.prefs.sfxOn) return;
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freq2) osc.frequency.exponentialRampToValueAtTime(freq2, now + dur);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol * this.prefs.volume, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  }

  // 答对：三音上行（多啦）
  correct() {
    this._tone({ freq: 523, dur: 0.12, vol: 0.35, type: 'triangle' });
    setTimeout(() => this._tone({ freq: 659, dur: 0.12, vol: 0.35, type: 'triangle' }), 90);
    setTimeout(() => this._tone({ freq: 784, dur: 0.18, vol: 0.4, type: 'triangle' }), 180);
  }

  // 答错：温柔下沉
  wrong() {
    this._tone({ freq: 330, freq2: 220, dur: 0.3, vol: 0.25, type: 'sine' });
  }

  // 点击/翻页
  click() {
    this._tone({ freq: 900, dur: 0.05, vol: 0.15, type: 'sine' });
  }

  // 徽章 / combo
  badge() {
    const notes = [659, 784, 988, 1319]; // E5 G5 B5 E6
    notes.forEach((f, i) => {
      setTimeout(() => this._tone({ freq: f, dur: 0.14, vol: 0.3, type: 'triangle' }), i * 70);
    });
  }

  // 号角：完成整本书
  fanfare() {
    const seq = [
      { f: 523, d: 0.15 }, { f: 659, d: 0.15 }, { f: 784, d: 0.15 },
      { f: 1047, d: 0.3 }, { f: 784, d: 0.15 }, { f: 1047, d: 0.5 },
    ];
    let t = 0;
    seq.forEach(({ f, d }) => {
      setTimeout(() => this._tone({ freq: f, dur: d, vol: 0.4, type: 'square' }), t * 1000);
      t += d * 0.95;
    });
  }

  // 印章盖下
  stamp() {
    this._tone({ freq: 180, freq2: 90, dur: 0.15, vol: 0.4, type: 'square' });
  }

  // === BGM：外链 CC0 素材（懒加载 howler.js） ===
  async _ensureHowler() {
    if (window.Howl) return window.Howl;
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.min.js';
      s.onload = () => resolve(window.Howl);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async playBgm(name, url) {
    if (!this.prefs.bgmOn) return;
    if (this.bgmName === name && this.bgm) return;
    try {
      const Howl = await this._ensureHowler();
      if (this.bgm) { this.bgm.fade(this.prefs.volume, 0, 800); setTimeout(() => this.bgm && this.bgm.stop(), 900); }
      this.bgm = new Howl({
        src: [url],
        loop: true,
        volume: 0,
        html5: true,   // 长音频用流式
      });
      this.bgm.play();
      this.bgm.fade(0, this.prefs.volume * 0.4, 1200);
      this.bgmName = name;
    } catch (e) {
      console.warn('BGM 加载失败', e);
    }
  }

  stopBgm() {
    if (this.bgm) { this.bgm.fade(this.prefs.volume, 0, 500); setTimeout(() => this.bgm && this.bgm.stop(), 600); }
    this.bgm = null;
    this.bgmName = null;
  }
}

export const audio = new AudioEngine();

// 首次用户交互时唤醒 AudioContext（浏览器限制）
const wake = () => {
  audio._ensureCtx();
  document.removeEventListener('click', wake);
  document.removeEventListener('touchstart', wake);
};
document.addEventListener('click', wake, { once: true });
document.addEventListener('touchstart', wake, { once: true });
