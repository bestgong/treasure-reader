// 寻宝记伴读平台 - 主应用逻辑 v2 酷炫版
import { countries, worldMap, seriesCharacters, treasureGallery } from './data/countries.js';
import { worldMapSVG } from './world-map.js';
import { ParticleField } from './particles.js';
import { audio } from './audio.js';

// 希腊/日本主题 BGM（占位，后续换为正式 CC0 素材）
const BGM_URLS = {
  japan:  'https://cdn.jsdelivr.net/gh/anars/blank-audio@11ecda0/2-seconds-of-silence.mp3',
  greece: 'https://cdn.jsdelivr.net/gh/anars/blank-audio@11ecda0/2-seconds-of-silence.mp3',
};

// 全局粒子实例
let particleBg = null;
let particleBurst = null;

// ============================================
// 状态管理 + 本地存储
// ============================================
const STORAGE_KEY = 'treasure-reader-progress-v1';

const defaultState = {
  unlocked: ['japan', 'greece'],     // 已购买并解锁的国家
  chapterProgress: {                  // { japan: { 1: {completed:true, correct:4, total:4}, ... } }
    japan: {},
  },
  passportStamps: [],                 // 已盖章的国家 id
  collectedTreasures: [],             // 已收集的国宝 id
  swordPieces: {                      // japan: 0-7
    japan: 0,
  },
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(defaultState));
    const saved = JSON.parse(raw);
    const merged = { ...JSON.parse(JSON.stringify(defaultState)), ...saved };
    // 合并 unlocked：保证新上架的国家也能点亮，不会被老存档覆盖
    const defaultUnlocked = defaultState.unlocked || [];
    const savedUnlocked = Array.isArray(saved.unlocked) ? saved.unlocked : [];
    merged.unlocked = Array.from(new Set([...defaultUnlocked, ...savedUnlocked]));
    return merged;
  } catch {
    return JSON.parse(JSON.stringify(defaultState));
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('保存失败', e);
  }
}

let state = loadState();
let currentView = 'home';
let currentCountryId = null;
let currentChapterId = null;

// 家长模式检测
const IS_PARENT_MODE = new URLSearchParams(location.search).get('parent') === '1';

// 章节用时记录（仅内存）
let currentChapterStartMs = null;

// ============================================
// 路由 / 视图切换
// ============================================
function showView(name) {
  currentView = name;
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const el = document.getElementById('view-' + name);
  if (el) el.classList.add('active');
  document.querySelectorAll('.nav-tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.view === name);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
  updateParticleTheme();
  // BGM 主题：只在国家/章节视图里根据 currentCountryId 切换
  if ((name === 'country' || name === 'chapter') && currentCountryId && BGM_URLS[currentCountryId]) {
    audio.playBgm(currentCountryId, BGM_URLS[currentCountryId]);
  }
}

// ============================================
// 渲染：首页 (世界地图)
// ============================================
function renderHome() {
  const unlockedCount = state.unlocked.length;
  const totalChapters = state.unlocked.reduce((sum, cid) => {
    const c = countries[cid];
    return sum + (c ? c.chapters.length : 0);
  }, 0);
  const completedChapters = Object.values(state.chapterProgress).reduce((sum, byCountry) => {
    return sum + Object.values(byCountry).filter((ch) => ch.completed).length;
  }, 0);
  const stamps = state.passportStamps.length;

  document.getElementById('stat-countries').textContent = unlockedCount;
  document.getElementById('stat-chapters').textContent = `${completedChapters}/${totalChapters}`;
  document.getElementById('stat-stamps').textContent = stamps;

  // 今日冒险任务卡片
  renderMission();

  // 地图：SVG 大陆 + 图钉 + 光晕
  const mapEl = document.getElementById('map-container');
  mapEl.innerHTML = worldMapSVG;
  worldMap.forEach((country) => {
    const isUnlocked = state.unlocked.includes(country.id);
    const isCompleted = state.passportStamps.includes(country.id);

    const glow = document.createElement('div');
    glow.className = 'country-glow ' + (isCompleted ? 'gold' : isUnlocked ? 'red' : 'dim');
    glow.style.left = country.x + '%';
    glow.style.top = country.y + '%';
    mapEl.appendChild(glow);

    const pin = document.createElement('button');
    pin.className = 'country-pin';
    if (isUnlocked) pin.classList.add('available');
    if (isCompleted) pin.classList.add('completed');
    pin.style.left = country.x + '%';
    pin.style.top = country.y + '%';
    pin.textContent = country.flag;
    pin.innerHTML += `<span class="pin-tooltip">${country.name}${isUnlocked ? '' : ' · 待解锁'}</span>`;
    pin.disabled = !isUnlocked;
    if (isUnlocked) {
      pin.addEventListener('click', () => { audio.click(); openCountry(country.id); });
    }
    mapEl.appendChild(pin);
  });

  // 布卡飞机穿梭
  startBukaPlane(mapEl);

  // 家长模式面板
  if (IS_PARENT_MODE) renderParentPanel();
}

// ============================================
// 今日冒险任务智能推荐
// ============================================
function renderMission() {
  const el = document.getElementById('mission-container');
  if (!el) return;
  let target = null;
  for (const cid of state.unlocked) {
    const c = countries[cid];
    if (!c) continue;
    const p = state.chapterProgress[cid] || {};
    const done = c.chapters.filter((ch) => p[ch.id] && p[ch.id].completed).length;
    if (done < c.chapters.length) {
      const nextCh = c.chapters.find((ch) => !p[ch.id] || !p[ch.id].completed);
      target = { country: c, chapter: nextCh, done, total: c.chapters.length };
      break;
    }
  }
  if (!target) {
    el.innerHTML = `
      <div class="mission-card">
        <div class="mission-icon">🎉</div>
        <div class="mission-body">
          <span class="mission-tag">冒险家</span>
          <h3 class="mission-title">你已经读完现有所有书啦！</h3>
          <p class="mission-desc">去国宝馆重温你的战利品，或等爸爸买新的《寻宝记》。</p>
        </div>
      </div>`;
    return;
  }
  const { country, chapter, done, total } = target;
  const pct = Math.round((done / total) * 100);
  el.innerHTML = `
    <div class="mission-card">
      <div class="mission-icon">${chapter.emoji || '📖'}</div>
      <div class="mission-body">
        <span class="mission-tag">🌟 今日推荐</span>
        <div class="mission-title">继续《${country.bookTitle}》· 第 ${chapter.id} 章：${chapter.title}</div>
        <p class="mission-desc">已读到 ${done}/${total} 章 (${pct}%)——${chapter.summary}</p>
        <button class="mission-cta" data-country="${country.id}" data-chapter="${chapter.id}">🚀 现在就去冒险</button>
      </div>
    </div>`;
  el.querySelector('.mission-cta').addEventListener('click', (e) => {
    audio.click();
    currentCountryId = e.target.dataset.country;
    openChapter(parseInt(e.target.dataset.chapter, 10));
  });
}

// ============================================
// 布卡飞机穿梭动画
// ============================================
function startBukaPlane(mapEl) {
  mapEl.querySelectorAll('.buka-plane, .plane-trail').forEach((el) => el.remove());
  const unlockedCountries = worldMap.filter((c) => state.unlocked.includes(c.id));
  if (unlockedCountries.length < 2) return;

  const plane = document.createElement('div');
  plane.className = 'buka-plane';
  plane.innerHTML = `<span class="plane-emoji">✈️</span>`;
  mapEl.appendChild(plane);

  let curIdx = 0;
  const durationMs = 5500;
  const trailInterval = 130;
  let lastTrail = 0;
  let startTs = null;
  let leg = { from: unlockedCountries[0], to: unlockedCountries[1 % unlockedCountries.length] };

  function tick(ts) {
    if (!document.getElementById('view-home').classList.contains('active') || !document.body.contains(plane)) return;
    if (!startTs) startTs = ts;
    const progress = Math.min(1, (ts - startTs) / durationMs);
    const x = leg.from.x + (leg.to.x - leg.from.x) * progress;
    const y = leg.from.y + (leg.to.y - leg.from.y) * progress - Math.sin(progress * Math.PI) * 4;
    plane.style.left = x + '%';
    plane.style.top = y + '%';
    const dx = leg.to.x - leg.from.x;
    plane.style.transform = `translate(-50%, -50%) scaleX(${dx > 0 ? 1 : -1})`;
    if (ts - lastTrail > trailInterval) {
      lastTrail = ts;
      const trail = document.createElement('div');
      trail.className = 'plane-trail';
      trail.style.left = x + '%';
      trail.style.top = y + '%';
      mapEl.appendChild(trail);
      setTimeout(() => trail.remove(), 1500);
    }
    if (progress >= 1) {
      curIdx = (curIdx + 1) % unlockedCountries.length;
      const nextIdx = (curIdx + 1) % unlockedCountries.length;
      leg = { from: unlockedCountries[curIdx], to: unlockedCountries[nextIdx] };
      startTs = ts + 300;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ============================================
// 家长模式面板
// ============================================
function renderParentPanel() {
  const home = document.getElementById('view-home').querySelector('.container');
  home.querySelectorAll('.parent-panel').forEach((el) => el.remove());
  const rows = [];
  let totalCorrect = 0, totalQ = 0, totalDone = 0, totalCh = 0;
  for (const cid of state.unlocked) {
    const c = countries[cid];
    if (!c) continue;
    const prog = state.chapterProgress[cid] || {};
    for (const ch of c.chapters) {
      totalCh++;
      const p = prog[ch.id];
      if (p && p.completed) {
        totalDone++;
        totalCorrect += p.correct || 0;
        totalQ += p.total || 0;
        rows.push({ book: c.bookTitle, chId: ch.id, title: ch.title, correct: p.correct, total: p.total, pct: Math.round(((p.correct||0)/(p.total||1))*100) });
      }
    }
  }
  const accuracy = totalQ ? Math.round((totalCorrect / totalQ) * 100) : 0;
  const panel = document.createElement('div');
  panel.className = 'parent-panel';
  panel.innerHTML = `
    <h2>👨‍👧 家长模式面板</h2>
    <p style="font-size: var(--text-sm); color:#666; margin-bottom: var(--space-3);">只有 <code>?parent=1</code> 时才显示，孩子看不到。</p>
    <div class="parent-stats-grid">
      <div class="parent-stat"><span class="parent-stat-num">${totalDone}/${totalCh}</span><span class="parent-stat-label">已完成章节</span></div>
      <div class="parent-stat"><span class="parent-stat-num">${accuracy}%</span><span class="parent-stat-label">平均正确率</span></div>
      <div class="parent-stat"><span class="parent-stat-num">${totalCorrect}/${totalQ}</span><span class="parent-stat-label">总答对/总题</span></div>
      <div class="parent-stat"><span class="parent-stat-num">${state.passportStamps.length}</span><span class="parent-stat-label">已盖章国家</span></div>
    </div>
    <button class="btn btn-soft" id="parent-export-btn">📄 导出 CSV</button>
    <table class="parent-table">
      <thead><tr><th>书</th><th>章</th><th>标题</th><th>得分</th><th>正确率</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${r.book}</td><td>第${r.chId}章</td><td>${r.title}</td><td>${r.correct}/${r.total}</td><td>${r.pct}%</td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#999;">尚无完成记录</td></tr>'}</tbody>
    </table>
  `;
  home.appendChild(panel);
  panel.querySelector('#parent-export-btn').addEventListener('click', () => exportParentCSV(rows, accuracy));
}

function exportParentCSV(rows, accuracy) {
  const lines = ['书籍,章号,章节标题,答对,总题数,正确率(%)'];
  rows.forEach((r) => lines.push(`"${r.book}",${r.chId},"${r.title}",${r.correct},${r.total},${r.pct}`));
  lines.push('');
  lines.push(`平均正确率,${accuracy}%`);
  const csv = '\ufeff' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `寻宝小英雄周报_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================
// 渲染：国家书页（章节列表）
// ============================================
function openCountry(countryId) {
  currentCountryId = countryId;
  const country = countries[countryId];
  if (!country) {
    alert('这本书还没买哦，购买后我会给你解锁！');
    return;
  }
  const view = document.getElementById('view-country');
  const progress = state.chapterProgress[countryId] || {};
  const completedCount = Object.values(progress).filter((p) => p.completed).length;
  const total = country.chapters.length;
  const pct = total > 0 ? (completedCount / total) * 100 : 0;

  view.innerHTML = `
    <header class="book-header" style="background: linear-gradient(135deg, ${country.themeColor}, ${country.accentColor});">
      <div class="container">
        <button class="btn btn-soft" style="position:absolute; left: var(--space-4); top: var(--space-4);"
                onclick="window.app.goHome()">← 回到地图</button>
        <div class="hero-stats" style="justify-content:center; margin-bottom: var(--space-3);">
          <span style="font-size: 4rem;">${country.flag}</span>
        </div>
        <h1 class="book-title">${country.bookTitle}</h1>
        <p class="book-subtitle">${country.bookSubtitle}</p>
        <div class="book-progress" aria-label="阅读进度">
          <div class="book-progress-fill" style="width:${pct}%;"></div>
        </div>
        <p style="font-size: var(--text-sm); margin-top: var(--space-3); opacity: 0.9;">
          已读完 ${completedCount} / ${total} 章 · 七支刀已集齐 ${state.swordPieces[countryId] || 0} / ${country.treasure.pieces} 块
        </p>
      </div>
    </header>
    <div class="container">
      <div class="chapter-grid">
        ${country.chapters
          .map((ch) => {
            const p = progress[ch.id];
            const isDone = p && p.completed;
            return `
            <article class="chapter-card ${isDone ? 'completed' : ''}"
                     onclick="window.app.openChapter(${ch.id})"
                     role="button" tabindex="0">
              <div class="chapter-num">第 ${ch.id} 章</div>
              <div class="chapter-emoji">${ch.emoji}</div>
              <h3 class="chapter-title">${ch.title}</h3>
              <p class="chapter-summary">${ch.summary}</p>
              ${isDone ? `<p style="margin-top:var(--space-3); font-size: var(--text-sm); color: var(--c-gold); font-weight:600;">★ 答对 ${p.correct}/${p.total} 题</p>` : ''}
            </article>`;
          })
          .join('')}
      </div>
    </div>
  `;
  showView('country');
}

// ============================================
// 渲染：章节互动详情
// ============================================
function openChapter(chapterId) {
  currentChapterId = chapterId;
  const country = countries[currentCountryId];
  const chapter = country.chapters.find((c) => c.id === chapterId);
  if (!chapter) return;

  const swordTotal = country.treasure.pieces;
  const swordOwned = state.swordPieces[currentCountryId] || 0;

  const view = document.getElementById('view-chapter');
  view.innerHTML = `
    <div class="chapter-view">
      <button class="btn btn-ghost" onclick="window.app.openCountry('${currentCountryId}')">
        ← 返回章节列表
      </button>

      <div class="chapter-hero">
        <div class="chapter-hero-emoji">${chapter.emoji}</div>
        <p style="color: var(--c-text-muted); font-family: var(--font-display);">第 ${chapter.id} 章</p>
        <h1>${chapter.title}</h1>
        <p style="margin-top: var(--space-3); color: var(--c-text-muted);">${chapter.summary}</p>
      </div>

      <div class="sword-progress">
        <strong style="font-family: var(--font-display);">${country.treasure.icon} ${country.treasure.name}收集：</strong>
        <div class="sword-pieces">
          ${Array.from({ length: swordTotal }, (_, i) =>
            `<span class="sword-piece ${i < swordOwned ? 'unlocked' : ''}">⚔️</span>`
          ).join('')}
        </div>
        <span style="margin-left: auto; font-family: var(--font-display);">${swordOwned} / ${swordTotal}</span>
      </div>

      <!-- 读前钩子 -->
      <section class="section-card">
        <span class="section-label hook">📖 读前思考</span>
        <h2>读之前，先想一想…</h2>
        <p class="hook-question">${chapter.preQuestion.question}</p>
        <p class="hook-hint">💭 ${chapter.preQuestion.hint}</p>
      </section>

      <!-- 互动答题区 -->
      <section class="section-card">
        <span class="section-label quiz">🎯 读完挑战</span>
        <h2>读得仔细吗？来挑战 ${chapter.questions.length} 个细节问题</h2>
        <div id="questions-container" style="margin-top: var(--space-4);">
          ${chapter.questions
            .map((q, idx) => renderQuestion(q, idx, chapter.questions.length))
            .join('')}
        </div>
        <button class="btn" id="submit-quiz-btn" onclick="window.app.submitQuiz(${chapterId})" style="margin-top: var(--space-4); width:100%;">
          🏆 提交答案，看看获得多少七支刀碎片
        </button>
        <div id="quiz-result" style="display:none; margin-top: var(--space-4);"></div>
      </section>

      <!-- 读后小游戏 -->
      <section class="section-card postgame">
        <span class="section-label game">🎮 读后任务</span>
        <h3>${chapter.postGame.title}</h3>
        <div class="postgame-prompt">${chapter.postGame.prompt}</div>
        <textarea placeholder="把你的想法或答案写在这里… (写完会自动保存)"
                  data-postgame-key="${currentCountryId}-${chapterId}"></textarea>
      </section>

      <!-- 知识卡 -->
      <section class="section-card knowledge-card">
        <span class="section-label know">🌏 小百科</span>
        <h3>${chapter.knowledge.title}</h3>
        <p>${chapter.knowledge.body}</p>
      </section>

      <div class="chapter-actions">
        ${chapter.id > 1 ? `<button class="btn btn-soft" onclick="window.app.openChapter(${chapter.id - 1})">← 上一章</button>` : ''}
        <button class="btn btn-soft" onclick="window.app.openCountry('${currentCountryId}')">回到章节列表</button>
        ${chapter.id < country.chapters.length ? `<button class="btn" onclick="window.app.openChapter(${chapter.id + 1})">下一章 →</button>` : `<button class="btn" onclick="window.app.completeBook('${currentCountryId}')">🎉 完成全书</button>`}
      </div>
    </div>
  `;

  // 还原已保存的 postgame 文本
  const ta = view.querySelector('textarea[data-postgame-key]');
  if (ta) {
    const key = 'postgame-' + ta.dataset.postgameKey;
    try {
      ta.value = localStorage.getItem(key) || '';
      ta.addEventListener('input', () => {
        localStorage.setItem(key, ta.value);
      });
    } catch {}
  }

  // 还原之前的答题（如果已完成）
  const prevProgress = (state.chapterProgress[currentCountryId] || {})[chapterId];
  if (prevProgress && prevProgress.answers) {
    prevProgress.answers.forEach((ans, idx) => {
      if (ans !== null && ans !== undefined) {
        const opts = view.querySelectorAll(`[data-qidx="${idx}"] .option`);
        if (opts[ans]) opts[ans].classList.add('selected');
      }
    });
  }

  showView('chapter');
}

function renderQuestion(q, idx, total) {
  const opts = q.options || (q.type === 'truefalse' ? ['✓ 对', '✗ 错'] : []);
  let tag = '';
  if (q.type === 'detail') tag = '<span class="question-tag detail">细节题</span>';
  else if (q.type === 'truefalse') tag = '<span class="question-tag tf">判断题</span>';

  return `
    <div class="question" data-qidx="${idx}" data-answer="${q.answer}" data-type="${q.type}">
      <span class="question-num">${idx + 1}</span>
      <span class="question-text">${q.q}</span>
      ${tag}
      <div class="options">
        ${opts
          .map(
            (opt, oi) => `
          <button class="option" data-opt="${oi}" onclick="window.app.selectOption(${idx}, ${oi})">
            <span class="option-letter">${String.fromCharCode(65 + oi)}</span>
            <span>${opt}</span>
          </button>`
          )
          .join('')}
      </div>
      <div class="explain" data-explain style="display:none;">${q.explain}</div>
    </div>
  `;
}

function selectOption(qIdx, optIdx) {
  const qBox = document.querySelector(`.question[data-qidx="${qIdx}"]`);
  if (!qBox) return;
  // 如果已经提交过本章，禁止再改
  if (qBox.dataset.locked === '1') return;
  qBox.querySelectorAll('.option').forEach((o) => o.classList.remove('selected'));
  const opt = qBox.querySelector(`.option[data-opt="${optIdx}"]`);
  if (opt) opt.classList.add('selected');
}

function submitQuiz(chapterId) {
  const country = countries[currentCountryId];
  const chapter = country.chapters.find((c) => c.id === chapterId);
  if (!chapter) return;

  const qBoxes = document.querySelectorAll('#questions-container .question');
  let correct = 0;
  const answers = [];
  let allAnswered = true;
  let streak = 0, maxStreak = 0;

  qBoxes.forEach((qBox, idx) => {
    const selected = qBox.querySelector('.option.selected');
    if (!selected) {
      allAnswered = false;
      answers.push(null);
      return;
    }
    const chosen = parseInt(selected.dataset.opt, 10);
    answers.push(chosen);
    const correctAns = parseInt(qBox.dataset.answer, 10);
    const isCorrect = chosen === correctAns;

    // 视觉反馈 + 音效 + 动画
    qBox.querySelectorAll('.option').forEach((o) => {
      const oi = parseInt(o.dataset.opt, 10);
      if (oi === correctAns) o.classList.add('correct');
      else if (oi === chosen && !isCorrect) o.classList.add('wrong');
    });
    // 交错触发动画（错开时序，比一次全响更有节奏）
    setTimeout(() => {
      const sel = qBox.querySelector('.option.selected');
      if (sel) sel.classList.add(isCorrect ? 'correct-flash' : 'wrong-shake');
      if (isCorrect) audio.correct(); else audio.wrong();
    }, idx * 380);

    qBox.querySelector('[data-explain]').style.display = 'block';
    qBox.dataset.locked = '1';
    if (isCorrect) {
      correct++;
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      streak = 0;
    }
  });

  if (!allAnswered) {
    alert('请把每道题都选一个答案哦~ 仔细想想再回答！');
    return;
  }

  // 记录进度
  if (!state.chapterProgress[currentCountryId]) state.chapterProgress[currentCountryId] = {};
  state.chapterProgress[currentCountryId][chapterId] = {
    completed: true,
    correct,
    total: chapter.questions.length,
    answers,
  };

  // 计算获得多少七支刀碎片（全对得 1 片，80% 以上得部分）
  const score = correct / chapter.questions.length;
  const totalChapters = country.chapters.length;
  // 每章对应总共能获得的最大碎片数 = treasure.pieces / chapters 数（按比例分配）
  const maxPiecesPerChapter = country.treasure.pieces / totalChapters;
  // 简化为：完成每章给一片基础碎片，全对额外奖励（但不超过总数）
  let newPieces = state.swordPieces[currentCountryId] || 0;
  // 该章贡献：按 1 章 = treasure.pieces / totalChapters 个 piece，全对发满
  const earned = Math.round((country.treasure.pieces / totalChapters) * score);
  // 简单做法：每完成一章+1，全对+额外
  newPieces = Math.min(country.treasure.pieces, newPieces + Math.max(1, earned));
  // 实际：直接按完成的章数线性增长，保证读完全 10 章正好集齐 7 片
  // 重新计算：完成章数 -> piece 数
  const allProgress = state.chapterProgress[currentCountryId];
  const completedCount = Object.values(allProgress).filter((p) => p.completed).length;
  state.swordPieces[currentCountryId] = Math.min(
    country.treasure.pieces,
    Math.round((completedCount / totalChapters) * country.treasure.pieces)
  );

  // 全部完成 → 盖章 + 收集国宝
  if (completedCount === totalChapters) {
    if (!state.passportStamps.includes(currentCountryId)) {
      state.passportStamps.push(currentCountryId);
    }
    if (!state.collectedTreasures.includes(currentCountryId)) {
      state.collectedTreasures.push(currentCountryId);
    }
  }

  saveState();

  // 结果反馈
  const resultEl = document.getElementById('quiz-result');
  document.getElementById('submit-quiz-btn').style.display = 'none';

  const pct = Math.round((correct / chapter.questions.length) * 100);
  let medal = '🥉', remark = '不错哦，再读一遍可以发现更多细节！';
  if (pct === 100) { medal = '🏆'; remark = '太厉害啦！全部答对，你真是个细心的小读者！'; }
  else if (pct >= 75) { medal = '🥇'; remark = '很棒！只错了一点点，已经读得很仔细了。'; }
  else if (pct >= 50) { medal = '🥈'; remark = '还不错~ 再翻翻书，你能找到答案的。'; }

  resultEl.style.display = 'block';
  resultEl.innerHTML = `
    <div class="celebrate" style="background: var(--c-paper); border: 3px solid var(--c-gold); border-radius: var(--r-lg); padding: var(--space-6);">
      <div class="award-icon">${medal}</div>
      <h3 style="margin: var(--space-3) 0;">答对 ${correct} / ${chapter.questions.length} 题（${pct}%）</h3>
      <p style="color: var(--c-text-muted);">${remark}</p>
      <p style="margin-top: var(--space-4); font-family: var(--font-display); color: var(--c-primary);">
        🗡️ 七支刀已集齐 ${state.swordPieces[currentCountryId]} / ${country.treasure.pieces} 块
      </p>
      ${completedCount === totalChapters ? `
        <p style="margin-top: var(--space-4); padding: var(--space-4); background: var(--c-primary-bg); border-radius: var(--r-md); font-size: var(--text-base);">
          🎉🎉 恭喜你完成了整本《${country.bookTitle}》！护照盖章 +1，国宝收集 +1
        </p>
      ` : ''}
    </div>
  `;

  // 更新顶部七支刀进度 + 碎片飞入动画
  const newPieceCount = state.swordPieces[currentCountryId] || 0;
  const prevPieceEls = document.querySelectorAll('.sword-piece');
  const submitBtn = document.getElementById('submit-quiz-btn');
  prevPieceEls.forEach((p, i) => {
    const wasUnlocked = p.classList.contains('unlocked');
    const nowUnlocked = i < newPieceCount;
    if (nowUnlocked && !wasUnlocked) {
      // 从提交按钮位置飞到该槽位
      flyPieceTo(submitBtn, p, country.treasure.icon);
      setTimeout(() => {
        p.classList.add('unlocked', 'just-earned');
        audio.badge();
      }, 850);
    } else {
      p.classList.toggle('unlocked', nowUnlocked);
    }
  });

  // Combo 徽章：全对或连对 3 题以上
  if (correct === chapter.questions.length && chapter.questions.length >= 3) {
    showComboBadge(`🏆 全对 COMBO x${chapter.questions.length}`);
  } else if (maxStreak >= 3) {
    showComboBadge(`⚡ ${maxStreak} 连击！`);
  }

  // 完成整本书 → 大庆祝
  if (completedCount === totalChapters) {
    setTimeout(() => launchFireworks(country), 1200);
  }
}

// 碎片从起点飞到终点
function flyPieceTo(fromEl, toEl, icon) {
  if (!fromEl || !toEl) return;
  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();
  const piece = document.createElement('div');
  piece.className = 'piece-flying';
  piece.textContent = icon;
  piece.style.left = (fromRect.left + fromRect.width / 2) + 'px';
  piece.style.top = (fromRect.top + fromRect.height / 2) + 'px';
  piece.style.transform = 'translate(-50%, -50%) scale(1) rotate(0deg)';
  document.body.appendChild(piece);
  requestAnimationFrame(() => {
    const dx = (toRect.left + toRect.width / 2) - (fromRect.left + fromRect.width / 2);
    const dy = (toRect.top + toRect.height / 2) - (fromRect.top + fromRect.height / 2);
    piece.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.6) rotate(720deg)`;
    piece.style.opacity = '0.2';
  });
  setTimeout(() => piece.remove(), 1000);
}

function showComboBadge(text) {
  const badge = document.createElement('div');
  badge.className = 'combo-badge';
  badge.textContent = text;
  document.body.appendChild(badge);
  audio.badge();
  // 从 canvas 中心爆发彩纸
  if (particleBurst) {
    particleBurst.burst(window.innerWidth / 2, window.innerHeight * 0.3, 40, 'confetti');
  }
  setTimeout(() => badge.remove(), 2000);
}

// 完成整本书烟花庆祝
function launchFireworks(country) {
  if (!particleBurst) return;
  audio.fanfare();
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight * 0.4;
  // 5 波烟花
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const x = centerX + (Math.random() - 0.5) * 400;
      const y = centerY + (Math.random() - 0.5) * 200;
      particleBurst.burst(x, y, 60, 'fireworks');
      particleBurst.burst(x, y, 30, 'confetti');
    }, i * 500);
  }
  setTimeout(() => showCelebration(country), 2500);
}

// ============================================
// 完成全书
// ============================================
function completeBook(countryId) {
  const country = countries[countryId];
  const allProgress = state.chapterProgress[countryId] || {};
  const allDone = country.chapters.every((c) => allProgress[c.id] && allProgress[c.id].completed);

  if (!allDone) {
    alert('还有章节没完成哦，回去把所有章节都读完吧！');
    return;
  }
  showCelebration(country);
}

function showCelebration(country) {
  const modal = document.getElementById('modal');
  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <div class="big-celebration">
      <span class="medal-huge">🏆</span>
      <h2 style="margin-top: var(--space-3);">恭喜完成《${country.bookTitle}》！</h2>
      <p style="font-size: var(--text-base); color: var(--c-text-muted); margin-top: var(--space-3);">
        你成功集齐了完整的 <strong style="color: var(--c-primary);">${country.treasure.icon} ${country.treasure.name}</strong>
      </p>
      <p style="margin: var(--space-3) 0; color: var(--c-text-muted); font-size: var(--text-sm);">${country.treasure.description}</p>
      <p style="margin-top: var(--space-4); color: var(--c-primary); font-family: var(--font-display); font-size: var(--text-lg);">
        📔 护照已盖章 · 🏛️ 国宝已收藏
      </p>
      <button class="btn" onclick="window.app.closeModal()" style="margin-top: var(--space-4);">🎊 太棒了！</button>
    </div>
  `;
  modal.classList.add('open');
}

// ============================================
// 护照
// ============================================
function renderPassport() {
  const el = document.getElementById('view-passport');
  // 已解锁国家（无论是否盖章）都有一页
  const pages = state.unlocked.map((id) => worldMap.find((c) => c.id === id)).filter(Boolean);
  const totalPages = pages.length + 1; // +1 是封面

  el.innerHTML = `
    <div class="container">
      <div class="hero">
        <h1 class="hero-title">📔 我的护照</h1>
        <p class="hero-subtitle">点击翻页箭头，看看你去过哪些国家</p>
      </div>
      <div class="passport-book">
        <div class="passport-pages" id="passport-pages">
          <div class="passport-page cover" data-page-idx="0">
            <div style="font-size: 4rem;">📔</div>
            <div class="p-title">寻宝小英雄护照</div>
            <div class="p-sub">World Treasure Hunter Passport</div>
            <p style="margin-top: var(--space-4); font-family: var(--font-handwrite); font-size: var(--text-lg);">
              已收集 ${state.passportStamps.length} / ${pages.length} 国印章
            </p>
            <p style="margin-top: var(--space-4); font-size: var(--text-xs); opacity: 0.8;">↓ 点击右下角翻页 ↓</p>
          </div>
          ${pages.map((c, i) => {
            const earned = state.passportStamps.includes(c.id);
            return `
            <div class="passport-page" data-page-idx="${i + 1}" style="z-index: ${100 - i};">
              <div class="passport-page-header">
                <span class="passport-flag">${c.flag}</span>
                <div style="text-align: right;">
                  <div class="passport-country-name">${c.name}</div>
                  <div style="font-size: var(--text-xs); color: rgba(107,74,43,0.6); font-family: var(--font-handwrite);">${c.nameEn} · ${c.capital || ''}</div>
                </div>
              </div>
              <div class="passport-stamp-visual ${earned ? 'earned' : ''}">
                ${earned ? '✓ VISITED' : '未 访 问'}
              </div>
              <p style="text-align: center; font-family: var(--font-handwrite); color: #6b4a2b; margin-top: var(--space-3);">
                ${earned ? '布卡与你一起完成了这段冒险' : '这本书还等待你去解锁…'}
              </p>
              <div class="passport-page-num">— ${i + 1} / ${pages.length} —</div>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="passport-nav">
        <button id="pp-prev">← 上一页</button>
        <span id="pp-indicator" style="align-self:center; font-family: var(--font-display); color: var(--c-text-muted);">封面</span>
        <button id="pp-next">下一页 →</button>
      </div>
    </div>
  `;

  // 翻页逻辑
  let currentPage = 0;
  const pagesEls = el.querySelectorAll('.passport-page');
  const prev = el.querySelector('#pp-prev');
  const next = el.querySelector('#pp-next');
  const ind = el.querySelector('#pp-indicator');
  function updatePages() {
    pagesEls.forEach((p, i) => {
      p.classList.toggle('flipped', i < currentPage);
    });
    prev.disabled = currentPage === 0;
    next.disabled = currentPage >= totalPages - 1;
    if (currentPage === 0) ind.textContent = '封面';
    else ind.textContent = `${pages[currentPage - 1]?.name || ''} · ${currentPage}/${pages.length}`;
  }
  prev.addEventListener('click', () => {
    if (currentPage > 0) { currentPage--; audio.click(); updatePages(); }
  });
  next.addEventListener('click', () => {
    if (currentPage < totalPages - 1) { currentPage++; audio.stamp(); updatePages(); }
  });
  updatePages();
}

// ============================================
// 国宝收集册
// ============================================
function renderGallery() {
  const el = document.getElementById('view-gallery');
  el.innerHTML = `
    <div class="container">
      <div class="hero">
        <h1 class="hero-title">🏛️ 国宝陈列馆</h1>
        <p class="hero-subtitle">3D 展柜 · 悬停可翻转 · 每读完一本书解锁一件国宝</p>
      </div>
      <div class="treasure-gallery-3d">
        ${treasureGallery
          .map((t) => {
            const collected = state.collectedTreasures.includes(t.id);
            const unlocked = state.unlocked.includes(t.id);
            const lockedFace = collected ? '' : 'locked';
            return `
            <div class="treasure-3d-card" data-treasure="${t.id}">
              <div class="treasure-3d-face front ${lockedFace}">
                <div class="treasure-3d-icon">${collected ? t.icon : '🔒'}</div>
                <h3 style="font-family: var(--font-display); font-size: var(--text-lg); color: var(--c-ink); margin-bottom: 4px;">${collected ? t.name : '？？？'}</h3>
                <p style="color: var(--c-text-muted); font-size: var(--text-sm); margin-bottom: 6px;">${t.country}</p>
                <p style="font-size: var(--text-xs); color: var(--c-text-muted); line-height: 1.4;">${collected ? t.desc : (unlocked ? '完成本书所有章节即可收藏' : '待爸爸购买本书解锁')}</p>
                <div class="treasure-3d-shine"></div>
              </div>
            </div>`;
          })
          .join('')}
      </div>
    </div>
  `;
  // 点击已收藏的国宝：显示故事
  el.querySelectorAll('.treasure-3d-card').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.treasure;
      const t = treasureGallery.find((x) => x.id === id);
      if (!t || !state.collectedTreasures.includes(id)) return;
      audio.click();
      const modal = document.getElementById('modal');
      const body = document.getElementById('modal-body');
      body.innerHTML = `
        <div style="text-align:center;">
          <div style="font-size: 5rem; margin-bottom: var(--space-3);">${t.icon}</div>
          <h2>${t.name}</h2>
          <p style="color: var(--c-text-muted); margin-top: var(--space-2);">${t.country} 国宝</p>
          <p style="margin: var(--space-4) 0; line-height: 1.6;">${t.desc}</p>
          <button class="btn" onclick="window.app.closeModal()">合上展柜</button>
        </div>`;
      modal.classList.add('open');
    });
  });
}

// ============================================
// 角色图鉴
// ============================================
function renderCharacters() {
  const el = document.getElementById('view-characters');
  // 已解锁的国家对应角色才显示
  const visible = seriesCharacters.filter((c) => state.unlocked.includes(c.unlockBy));
  el.innerHTML = `
    <div class="container">
      <div class="hero">
        <h1 class="hero-title">👥 角色图鉴</h1>
        <p class="hero-subtitle">认识《寻宝记》系列里的所有伙伴和反派</p>
      </div>
      <div class="character-list">
        ${visible
          .map(
            (c) => `
          <div class="character-card">
            <div class="character-emoji">${c.emoji}</div>
            <h3 class="character-name">${c.name}</h3>
            <p class="character-role">${c.desc}</p>
          </div>`
          )
          .join('')}
        ${seriesCharacters
          .filter((c) => !state.unlocked.includes(c.unlockBy))
          .map(
            () => `
          <div class="character-card" style="opacity:0.4;">
            <div class="character-emoji">❓</div>
            <h3 class="character-name">？？？</h3>
            <p class="character-role">解锁后续国家可见</p>
          </div>`
          )
          .join('')}
      </div>
    </div>
  `;
}

// ============================================
// 弹窗
// ============================================
function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

// ============================================
// 樱花飘落（装饰）
// ============================================
function startBlossoms() {
  // v2: 用 Canvas 粒子系统替代 emoji DOM 元素
  const bgCanvas = document.getElementById('particle-canvas');
  const burstCanvas = document.getElementById('burst-canvas');
  if (bgCanvas) {
    particleBg = new ParticleField(bgCanvas, { theme: 'sakura', maxParticles: 40, spawnRate: 0.35 });
    particleBg.start();
  }
  if (burstCanvas) {
    particleBurst = new ParticleField(burstCanvas, { theme: 'confetti', maxParticles: 200, spawnRate: 0 });
    particleBurst.start();
  }
}

// 根据当前上下文切换粒子主题
function updateParticleTheme() {
  if (!particleBg) return;
  if (currentView === 'chapter' || currentView === 'country') {
    if (currentCountryId === 'greece') particleBg.setTheme('olive');
    else if (currentCountryId === 'japan') particleBg.setTheme('sakura');
    else particleBg.setTheme('sakura');
  } else {
    particleBg.setTheme('sakura');
  }
}

// ============================================
// 重置
// ============================================
function resetProgress() {
  if (!confirm('确定要重置所有进度吗？所有章节答题和护照印章都会清空（已写的笔记也会消失）。')) return;
  state = JSON.parse(JSON.stringify(defaultState));
  // 清掉所有 postgame 笔记
  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('postgame-')) localStorage.removeItem(k);
    });
  } catch {}
  saveState();
  renderAll();
  alert('已重置');
}

// ============================================
// 初始化
// ============================================
function renderAll() {
  renderHome();
  renderPassport();
  renderGallery();
  renderCharacters();
}

function goHome() {
  renderHome();
  showView('home');
}

// 暴露给 inline onclick
window.app = {
  openCountry,
  openChapter,
  selectOption,
  submitQuiz,
  completeBook,
  closeModal,
  resetProgress,
  goHome,
};

document.addEventListener('DOMContentLoaded', () => {
  renderAll();

  // 导航 tab
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      audio.click();
      const v = tab.dataset.view;
      if (v === 'home') renderHome();
      else if (v === 'passport') renderPassport();
      else if (v === 'gallery') renderGallery();
      else if (v === 'characters') renderCharacters();
      showView(v);
    });
  });

  // Modal 关闭
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
  });

  // 重置按钮
  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) resetBtn.addEventListener('click', resetProgress);

  // 音频控制
  const sfxBtn = document.getElementById('sfx-toggle');
  const bgmBtn = document.getElementById('bgm-toggle');
  function refreshAudioBtns() {
    const p = audio.getPrefs();
    if (sfxBtn) {
      sfxBtn.textContent = p.sfxOn ? '🔊' : '🔇';
      sfxBtn.className = 'audio-btn ' + (p.sfxOn ? 'on' : 'off');
    }
    if (bgmBtn) {
      bgmBtn.textContent = p.bgmOn ? '🎵' : '🎶';
      bgmBtn.className = 'audio-btn ' + (p.bgmOn ? 'on' : 'off');
    }
  }
  if (sfxBtn) sfxBtn.addEventListener('click', () => { audio.setSfxOn(!audio.getPrefs().sfxOn); refreshAudioBtns(); audio.click(); });
  if (bgmBtn) bgmBtn.addEventListener('click', () => {
    const now = !audio.getPrefs().bgmOn;
    audio.setBgmOn(now);
    if (now && currentCountryId && BGM_URLS[currentCountryId]) audio.playBgm(currentCountryId, BGM_URLS[currentCountryId]);
    if (!now) audio.stopBgm();
    refreshAudioBtns();
  });
  refreshAudioBtns();

  startBlossoms();
  showView('home');
});
