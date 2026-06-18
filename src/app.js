// 寻宝记伴读平台 - 主应用逻辑
import { countries, worldMap, seriesCharacters, treasureGallery } from './data/countries.js';

// ============================================
// 状态管理 + 本地存储
// ============================================
const STORAGE_KEY = 'treasure-reader-progress-v1';

const defaultState = {
  unlocked: ['japan'],               // 已购买并解锁的国家
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
    return { ...JSON.parse(JSON.stringify(defaultState)), ...saved };
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
}

// ============================================
// 渲染：首页 (世界地图)
// ============================================
function renderHome() {
  // 统计
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

  // 地图
  const mapEl = document.getElementById('map-container');
  mapEl.innerHTML = '';
  worldMap.forEach((country) => {
    const isUnlocked = state.unlocked.includes(country.id);
    const isCompleted = state.passportStamps.includes(country.id);
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
      pin.addEventListener('click', () => openCountry(country.id));
    }
    mapEl.appendChild(pin);
  });
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

    // 视觉反馈
    qBox.querySelectorAll('.option').forEach((o) => {
      const oi = parseInt(o.dataset.opt, 10);
      if (oi === correctAns) o.classList.add('correct');
      else if (oi === chosen && !isCorrect) o.classList.add('wrong');
    });
    qBox.querySelector('[data-explain]').style.display = 'block';
    qBox.dataset.locked = '1';
    if (isCorrect) correct++;
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

  // 更新顶部七支刀进度
  document.querySelectorAll('.sword-piece').forEach((p, i) => {
    p.classList.toggle('unlocked', i < (state.swordPieces[currentCountryId] || 0));
  });
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
    <div class="modal-icon">🏆</div>
    <h2>恭喜完成《${country.bookTitle}》！</h2>
    <p>你已经成功收集到完整的 <strong>${country.treasure.name}</strong>！${country.treasure.description}</p>
    <p style="margin-top: var(--space-3); color: var(--c-primary); font-family: var(--font-display);">护照已盖章 · 国宝已收藏</p>
    <button class="btn" onclick="window.app.closeModal()">太棒了！</button>
  `;
  modal.classList.add('open');
}

// ============================================
// 护照
// ============================================
function renderPassport() {
  const el = document.getElementById('view-passport');
  el.innerHTML = `
    <div class="container">
      <div class="hero">
        <h1 class="hero-title">📔 我的护照</h1>
        <p class="hero-subtitle">每读完一本《寻宝记》就盖一个章！</p>
      </div>
      <div class="passport">
        <div class="passport-title">✦ 寻宝小英雄护照 ✦</div>
        <div class="passport-stamps">
          ${worldMap
            .map((c) => {
              const earned = state.passportStamps.includes(c.id);
              return `
              <div class="stamp ${earned ? 'earned' : ''}" title="${c.name}">
                ${earned ? c.flag : '?'}
              </div>`;
            })
            .join('')}
        </div>
        <p style="text-align: center; margin-top: var(--space-6); font-size: var(--text-sm); opacity: 0.85;">
          已盖章：${state.passportStamps.length} 国
        </p>
      </div>
    </div>
  `;
}

// ============================================
// 国宝收集册
// ============================================
function renderGallery() {
  const el = document.getElementById('view-gallery');
  el.innerHTML = `
    <div class="container">
      <div class="hero">
        <h1 class="hero-title">🏛️ 国宝收集册</h1>
        <p class="hero-subtitle">每读完一本书就解锁一件国宝</p>
      </div>
      <div class="treasure-gallery">
        ${treasureGallery
          .map((t) => {
            const collected = state.collectedTreasures.includes(t.id);
            const unlocked = state.unlocked.includes(t.id);
            const cls = collected ? 'collected' : unlocked ? '' : 'locked';
            return `
            <div class="treasure-card ${cls}">
              <div class="treasure-icon">${collected ? t.icon : '❓'}</div>
              <h3 class="treasure-name">${collected ? t.name : '？？？'}</h3>
              <p class="treasure-country">${t.country}</p>
              <p class="treasure-desc">${collected ? t.desc : (unlocked ? '完成本书所有章节即可收藏' : t.desc)}</p>
            </div>`;
          })
          .join('')}
      </div>
    </div>
  `;
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
  const blossoms = ['🌸', '🌺', '🍃'];
  function spawn() {
    const el = document.createElement('div');
    el.className = 'floating-blossom';
    el.textContent = blossoms[Math.floor(Math.random() * blossoms.length)];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.animationDuration = 12 + Math.random() * 12 + 's';
    el.style.fontSize = 0.8 + Math.random() * 1.2 + 'rem';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 25000);
  }
  setInterval(spawn, 4000);
  // 启动时先撒几片
  for (let i = 0; i < 3; i++) setTimeout(spawn, i * 1500);
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

  startBlossoms();
  showView('home');
});
