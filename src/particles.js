// 樱花 / 橄榄叶 / 通用粒子系统（Canvas 实现）
// 用法：const p = new ParticleField(canvas, { theme: 'sakura' | 'olive' | 'confetti' })
//       p.start(); p.stop(); p.setTheme('olive');
//       p.burst(x, y, 30);  // 从某点爆发 N 个粒子（庆祝用）
// 尊重 prefers-reduced-motion，性能友好（最多同时 60 个粒子）

const THEMES = {
  sakura: {
    colors: ['#ffb6b9', '#ffc9c9', '#ff9aa2', '#ffd6d9', '#ffe5e5'],
    shapes: ['petal'],
    gravity: 0.02,
    wind: 0.15,
    sizeRange: [8, 18],
    rotSpeed: 0.02,
    ttlRange: [12, 24],
  },
  olive: {
    colors: ['#8fbc7e', '#a8c98d', '#c4d99f', '#6ea86a', '#b8d4a0'],
    shapes: ['leaf'],
    gravity: 0.025,
    wind: 0.12,
    sizeRange: [10, 20],
    rotSpeed: 0.015,
    ttlRange: [14, 26],
  },
  confetti: {
    colors: ['#e94560', '#e9b949', '#5cb85c', '#4a90e2', '#f4a261', '#c968c4'],
    shapes: ['rect', 'circle'],
    gravity: 0.15,
    wind: 0.05,
    sizeRange: [4, 10],
    rotSpeed: 0.15,
    ttlRange: [2, 5],
  },
  fireworks: {
    colors: ['#ffd700', '#ff4d6d', '#7ee787', '#4ea8de', '#ff9e00', '#c77dff'],
    shapes: ['spark'],
    gravity: 0.08,
    wind: 0,
    sizeRange: [2, 5],
    rotSpeed: 0,
    ttlRange: [1, 2.5],
  },
};

export class ParticleField {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.theme = opts.theme || 'sakura';
    this.maxParticles = opts.maxParticles ?? 55;
    this.spawnRate = opts.spawnRate ?? 0.45; // 每帧生成概率（传 0 则仅用于 burst 模式）
    this.particles = [];
    this.running = false;
    this._resize = this._resize.bind(this);
    this._loop = this._loop.bind(this);
    this.reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.reduced) this.spawnRate *= 0.3;
    this._resize();
    window.addEventListener('resize', this._resize);
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = rect.width;
    this.h = rect.height;
  }

  setTheme(name) {
    if (THEMES[name]) this.theme = name;
  }

  start() {
    if (this.running) return;
    this.running = true;
    requestAnimationFrame(this._loop);
  }

  stop() {
    this.running = false;
  }

  clear() {
    this.particles = [];
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  burst(x, y, n = 25, theme) {
    const t = theme ? THEMES[theme] : THEMES[this.theme];
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 5;
      this.particles.push(this._make(t, {
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        ttl: t.ttlRange[0] + Math.random() * (t.ttlRange[1] - t.ttlRange[0]),
        burst: true,
      }));
    }
  }

  _make(t, init = {}) {
    return {
      x: init.x ?? Math.random() * this.w,
      y: init.y ?? -20,
      vx: init.vx ?? (Math.random() - 0.5) * t.wind * 4,
      vy: init.vy ?? 0.5 + Math.random() * 1.2,
      size: t.sizeRange[0] + Math.random() * (t.sizeRange[1] - t.sizeRange[0]),
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * t.rotSpeed,
      color: t.colors[Math.floor(Math.random() * t.colors.length)],
      shape: t.shapes[Math.floor(Math.random() * t.shapes.length)],
      ttl: init.ttl ?? 999,
      age: 0,
      burst: init.burst || false,
      alpha: 1,
    };
  }

  _spawn() {
    if (this.particles.length >= this.maxParticles) return;
    if (Math.random() > this.spawnRate) return;
    const t = THEMES[this.theme];
    this.particles.push(this._make(t));
  }

  _loop(ts) {
    if (!this.running) return;
    this.ctx.clearRect(0, 0, this.w, this.h);
    this._spawn();
    const t = THEMES[this.theme];
    const dt = 1 / 60;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      p.vy += t.gravity;
      p.vx += (Math.random() - 0.5) * t.wind * 0.1;
      // 阻尼
      p.vx *= 0.995;
      p.vy *= 0.995;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.rotV;
      // 淡出
      if (p.burst) p.alpha = Math.max(0, 1 - p.age / p.ttl);
      // 移除
      if (p.y > this.h + 30 || (p.burst && p.age > p.ttl)) {
        this.particles.splice(i, 1);
        continue;
      }
      this._draw(p);
    }
    requestAnimationFrame(this._loop);
  }

  _draw(p) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    switch (p.shape) {
      case 'petal': {
        // 樱花花瓣（水滴 + 缺口）
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.5, p.size * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();
        // 中心亮点
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = p.alpha * 0.4;
        ctx.beginPath();
        ctx.ellipse(0, -p.size * 0.1, p.size * 0.15, p.size * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'leaf': {
        // 橄榄叶（尖椭圆）
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.35, p.size * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        // 叶脉
        ctx.strokeStyle = 'rgba(60,90,50,0.4)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(0, -p.size * 0.7);
        ctx.lineTo(0, p.size * 0.7);
        ctx.stroke();
        break;
      }
      case 'rect':
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'spark': {
        // 烟花亮点：径向渐变
        const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
        grd.addColorStop(0, p.color);
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }
}
