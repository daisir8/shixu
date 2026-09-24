/* ================= 时序 · 时间规划与倒计时 ================= */
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const KEY = 'shixu-plan-v1';

const COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#5AC8FA', '#FF2D55', '#5856D6'];
const PRIO_TEXT = { high: '重要', normal: '普通', low: '次要' };
const STATUS_TEXT = { todo: '待办', doing: '进行中', done: '已完成' };

/* ---------------- 工具 ---------------- */
const pad = n => String(n).padStart(2, '0');
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toInput(d) {
  if (!d) return '';
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
function fromInput(s) { return s ? new Date(s) : null; }
function dayKey(d) { return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function sameDay(a, b) { return a && b && dayKey(a) === dayKey(b); }

function fmtTime(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fmtDay(d) { return `${d.getMonth() + 1}月${d.getDate()}日`; }
function fmtFull(d) { return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${fmtTime(d)}`; }
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function daysBetween(d) {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.round((a - b) / 86400000);
}
function relDay(d) {
  const n = daysBetween(d);
  if (n === 0) return '今天';
  if (n === 1) return '明天';
  if (n === 2) return '后天';
  if (n > 0) return `${n} 天后`;
  return `已过 ${-n} 天`;
}
function fmtDuration(ms) {
  if (!ms || ms <= 0) return '';
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} 分钟`;
  const h = Math.floor(m / 60), mm = m % 60;
  if (h < 24) return mm ? `${h} 小时 ${mm} 分` : `${h} 小时`;
  const d = Math.floor(h / 24), hh = h % 24;
  return hh ? `${d} 天 ${hh} 小时` : `${d} 天`;
}

/* ---------------- 状态 ---------------- */
let state = {
  tasks: [], countdowns: [], quotes: [],
  view: 'timeline', filter: 'all', search: '',
  cdIndex: 0, qIndex: 0, qDate: '', critical: false
};
let editingQuoteId = null;
let editingTaskId = null;
let editingCdId = null;
let formColor = COLORS[0];
let formDeps = new Set();
let formCdColor = COLORS[0];
let confirmCb = null;

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { /* file:// 或隐私模式下不可用时静默降级为内存态 */ }
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s || !Array.isArray(s.tasks)) return false;
    state.tasks = s.tasks.map(normalizeTask);
    state.quotes = (s.quotes || []).map(q => ({ id: q.id || uid(), text: String(q.text || '') })).filter(q => q.text.trim());
    state.qIndex = Number(s.qIndex) || 0;
    state.qDate = s.qDate || '';
    state.countdowns = (s.countdowns || []).map(c => ({
      id: c.id || uid(), title: c.title || '未命名节点', target: c.target || new Date().toISOString(),
      color: c.color || COLORS[0], from: c.from || new Date().toISOString()
    }));
    state.view = s.view || 'timeline';
    state.critical = !!s.critical;
    return true;
  } catch (e) { return false; }
}
function normalizeTask(t) {
  return {
    id: t.id || uid(),
    title: t.title || '未命名事件',
    start: t.start || null,
    end: t.end || null,
    status: ['todo', 'doing', 'done'].includes(t.status) ? t.status : 'todo',
    priority: ['low', 'normal', 'high'].includes(t.priority) ? t.priority : 'normal',
    color: t.color || COLORS[0],
    deps: Array.isArray(t.deps) ? t.deps : [],
    note: t.note || '',
    createdAt: t.createdAt || new Date().toISOString()
  };
}

/* ---------------- 示例数据 ---------------- */
function seed() {
  const now = new Date();
  const at = (d, h, m = 0) => { const x = new Date(now); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return x.toISOString(); };
  const t = (title, s, e, deps, status, priority, color, note) =>
    ({ id: uid(), title, start: s, end: e, deps: deps || [], status: status || 'todo', priority: priority || 'normal', color: color || COLORS[0], note: note || '', createdAt: new Date().toISOString() });

  const a = t('需求梳理与拆解', at(-1, 9), at(-1, 11), [], 'done', 'normal', COLORS[1], '输出功能清单与优先级');
  const b = t('原型设计 v1', at(0, 14), at(0, 17, 30), [a.id], 'doing', 'high', COLORS[0], '含关键页面流程图');
  const c = t('前端联调', at(1, 10), at(1, 12), [b.id], 'todo', 'high', COLORS[5], '接口打通 + 冒烟');
  const d = t('内部评审', at(2, 15), at(2, 16), [c.id], 'todo', 'normal', COLORS[6], '邀请产品与设计参加');
  const e = t('灰度发布', at(4, 20), at(4, 21), [d.id], 'todo', 'high', COLORS[2], '先放 10% 流量');
  const f = t('数据复盘报告', at(6, 9), at(6, 11), [e.id], 'todo', 'normal', COLORS[4], '含留存与漏斗数据');

  state.tasks = [a, b, c, d, e, f];
  state.quotes = [
    { id: uid(), text: '把今天过好，就已经赢过大多数人了。' },
    { id: uid(), text: '先做最重要的那件事，其余的都会让路。' }
  ];
  state.qIndex = 0;
  state.qDate = dayKey(new Date());
  state.countdowns = [
    { id: uid(), title: '内部评审', target: at(2, 15), color: COLORS[6], from: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id: uid(), title: '项目交付', target: at(7, 18), color: COLORS[0], from: new Date(Date.now() - 86400000 * 5).toISOString() },
    { id: uid(), title: '阶段汇报', target: at(21, 14), color: COLORS[2], from: new Date().toISOString() }
  ];
  state.cdIndex = 0;
  save();
}

/* ================= 倒计时 ================= */
function sortedCds() {
  return state.countdowns.slice().sort((a, b) => new Date(a.target) - new Date(b.target));
}
function pickDefaultCd() {
  const list = sortedCds();
  if (!list.length) return 0;
  const now = Date.now();
  const i = list.findIndex(c => new Date(c.target).getTime() > now);
  return i < 0 ? list.length - 1 : i;
}

function renderCountdown() {
  const list = sortedCds();
  if (!list.length) {
    $('#cdTitle').textContent = '还没有倒计时节点';
    $('#cdDate').textContent = '点击「＋ 新建倒计时」设置一个重要时刻';
    ['#cdD', '#cdH', '#cdM', '#cdS'].forEach(s => $(s).textContent = '--');
    $('#cdPct').textContent = '0%'; $('#cdBar').style.width = '0%';
    $('#cdRing').style.strokeDashoffset = 326.7;
    $('#cdRingN').textContent = '--'; $('#cdRingU').textContent = '天';
    $('#cdDots').innerHTML = ''; $('#cdPast').textContent = '';
    $('#cdFrom').textContent = '创建倒计时节点后，这里会显示进度参照';
    return;
  }
  state.cdIndex = Math.max(0, Math.min(state.cdIndex, list.length - 1));
  const c = list[state.cdIndex];
  const target = new Date(c.target).getTime();

  $('#cdTitle').innerHTML = `${esc(c.title)}${target <= Date.now() ? '<span class="tag">已到达</span>' : ''}`;
  $('#cdDate').textContent = fmtFull(new Date(c.target)) + ' · ' + WEEK[new Date(c.target).getDay()];
  $('#cdDots').innerHTML = list.map((_, i) => `<span class="${i === state.cdIndex ? 'on' : ''}"></span>`).join('');
  $('#cdRing').style.stroke = c.color;
  $('#cdRing').style.filter = `drop-shadow(0 3px 8px ${c.color}55)`;
  tickCountdown();
}

function tickCountdown() {
  const list = sortedCds();
  if (!list.length) return;
  const c = list[Math.min(state.cdIndex, list.length - 1)];
  const target = new Date(c.target).getTime();
  const from = new Date(c.from || c.target).getTime();
  let diff = target - Date.now();
  const past = diff <= 0;
  const abs = Math.abs(diff);

  const d = Math.floor(abs / 86400000);
  const h = Math.floor(abs % 86400000 / 3600000);
  const m = Math.floor(abs % 3600000 / 60000);
  const s = Math.floor(abs % 60000 / 1000);

  $('#cdD').textContent = pad(d);
  $('#cdH').textContent = pad(h);
  $('#cdM').textContent = pad(m);
  $('#cdS').textContent = pad(s);

  const total = Math.max(1, target - from);
  const pct = Math.max(0, Math.min(100, (Date.now() - from) / total * 100));
  $('#cdPct').textContent = '已推进 ' + pct.toFixed(0) + '%';
  $('#cdBar').style.width = pct + '%';
  const fd = new Date(from), td = new Date(target);
  $('#cdFrom').textContent = `从 ${fmtDay(fd)} ${fmtTime(fd)} 起算，全程 ${fmtDuration(td - fd)}，还剩 ${fmtDuration(Math.max(0, target - Date.now()))}`;
  const C = 2 * Math.PI * 52;
  $('#cdRing').style.strokeDasharray = C;
  $('#cdRing').style.strokeDashoffset = C * (1 - pct / 100);

  if (past) {
    $('#cdRingN').textContent = '✓';
    $('#cdRingU').textContent = '已到达';
    $('#cdPast').textContent = `已过去 ${fmtDuration(abs)}`;
  } else {
    $('#cdRingN').textContent = String(Math.ceil(abs / 86400000));
    $('#cdRingU').textContent = '剩余天';
    $('#cdPast').textContent = '';
  }
}

/* ================= 每日一句 ================= */
function todayKey() { return dayKey(new Date()); }
function dayNumber(dt) {                          // 距 epoch 的天序号
  const d = dt || new Date();
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000);
}
function quoteAutoIndex(n, dt) {                  // 按日期稳定轮换，逐日 +1
  if (!n) return 0;
  return ((dayNumber(dt) % n) + n) % n;
}
function renderQuote() {
  const list = state.quotes;
  const card = $('#quoteCard');
  if (!list.length) {
    card.classList.add('is-empty');
    $('#qText').textContent = '还没有写句子，点这里添加一句';
    $('#qMeta').textContent = '每日一句 · 点击卡片开始写';
    return;
  }
  card.classList.remove('is-empty');
  if (state.qDate !== todayKey()) { state.qIndex = quoteAutoIndex(list.length); state.qDate = todayKey(); }
  state.qIndex = Math.max(0, Math.min(state.qIndex, list.length - 1));
  $('#qText').textContent = list[state.qIndex].text;
  $('#qMeta').textContent = `每日一句 · 第 ${state.qIndex + 1} / ${list.length} 句`;
}
function shiftQuote(d) {
  const n = state.quotes.length;
  if (!n) { openQuoteSheet(); return; }
  state.qIndex = (state.qIndex + d + n) % n;
  state.qDate = todayKey();
  renderQuote(); save();
}
function openQuoteSheet() {
  if (!state.quotes.length) {
    state.quotes.push({ id: uid(), text: '' });
    state.qIndex = 0; state.qDate = todayKey();
  }
  editingQuoteId = (state.quotes[state.qIndex] || state.quotes[0]).id;
  const q = state.quotes.find(x => x.id === editingQuoteId);
  $('#qInput').value = q ? q.text : '';
  $('#qDelete').hidden = state.quotes.length <= 1 && !q.text;
  renderQuoteList();
  openSheet($('#quoteSheet'));
  setTimeout(() => $('#qInput').focus(), 260);
}
function renderQuoteList() {
  $('#qList').innerHTML = '<label style="font-size:12.5px;font-weight:700;color:var(--text2)">已写的句子</label>' +
    state.quotes.map((q, i) => `
      <div class="cd-item ${q.id === editingQuoteId ? 'on' : ''}" data-qid="${q.id}">
        <span class="cdot" style="background:${q.id === editingQuoteId ? 'var(--blue)' : 'rgba(142,142,147,.5)'}"></span>
        <span class="cn">${esc(trunc(q.text || '（空）', 26))}</span>
        <button class="cx" data-delq="${q.id}" title="删除">×</button>
      </div>`).join('');
}
function selectQuote(id) {
  const cur = state.quotes.find(x => x.id === editingQuoteId);
  if (cur) cur.text = $('#qInput').value.trim();
  editingQuoteId = id;
  const q = state.quotes.find(x => x.id === id);
  $('#qInput').value = q ? q.text : '';
  renderQuoteList();
}
function saveQuoteSheet() {
  const cur = state.quotes.find(x => x.id === editingQuoteId);
  if (cur) cur.text = $('#qInput').value.trim();
  state.quotes = state.quotes.filter(q => q.text.trim());   // 丢弃空句
  if (!state.quotes.length) {
    state.qIndex = 0; state.qDate = '';
  } else {
    const i = state.quotes.findIndex(q => q.id === editingQuoteId);
    state.qIndex = i >= 0 ? i : 0;
    state.qDate = todayKey();
  }
  closeSheets(); renderAll(); toast('已保存');
}

/* ================= 任务派生数据 ================= */
const T = () => state.tasks;
const byId = id => state.tasks.find(t => t.id === id);

function dependents(id) { return state.tasks.filter(t => (t.deps || []).includes(id)); }

function criticalChain() {
  const memo = new Map();
  const walk = (id, seen) => {
    if (memo.has(id)) return memo.get(id);
    if (seen.has(id)) return { len: 0, chain: [] };
    seen.add(id);
    const t = byId(id);
    if (!t) return { len: 0, chain: [] };
    let best = { len: 1, chain: [id] };
    for (const d of (t.deps || [])) {
      if (!byId(d)) continue;
      const r = walk(d, seen);
      if (r.len + 1 > best.len) best = { len: r.len + 1, chain: r.chain.concat([id]) };
    }
    seen.delete(id);
    memo.set(id, best);
    return best;
  };
  let best = { len: 0, chain: [] };
  for (const t of state.tasks) {
    const r = walk(t.id, new Set());
    if (r.len > best.len) best = r;
  }
  return best.chain;
}

function relatedSet(id) {
  const set = new Set([id]);
  const up = [id];
  while (up.length) {
    const cur = up.pop();
    const t = byId(cur);
    if (!t) continue;
    for (const d of (t.deps || [])) if (!set.has(d)) { set.add(d); up.push(d); }
  }
  const down = [id];
  while (down.length) {
    const cur = down.pop();
    for (const t of dependents(cur)) if (!set.has(t.id)) { set.add(t.id); down.push(t.id); }
  }
  return set;
}

function visibleTasks() {
  const q = state.search.trim().toLowerCase();
  return state.tasks.filter(t => {
    if (state.filter === 'todo' && t.status !== 'todo') return false;
    if (state.filter === 'doing' && t.status !== 'doing') return false;
    if (state.filter === 'done' && t.status !== 'done') return false;
    if (q && !((t.title + ' ' + (t.note || '')).toLowerCase().includes(q))) return false;
    return true;
  });
}

function sortTasks(list) {
  const noTime = [];
  const withTime = [];
  list.forEach(t => (t.start ? withTime : noTime).push(t));
  withTime.sort((a, b) => new Date(a.start) - new Date(b.start) || new Date(a.end || a.start) - new Date(b.end || b.start));
  noTime.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return { withTime, noTime };
}

/* ================= 时间轴 ================= */
function renderTimeline() {
  const body = $('#tlBody');
  const list = visibleTasks();
  if (!list.length) {
    body.innerHTML = `<div class="empty"><b>这里还没有事件</b>点击右上角「＋ 新建事件」开始规划</div>`;
    $('#depLayer').innerHTML = '';
    return;
  }
  const { withTime, noTime } = sortTasks(list);
  const chain = state.critical ? criticalChain() : [];
  const seqBase = new Map();
  withTime.concat(noTime).forEach((t, i) => seqBase.set(t.id, i + 1));

  let html = '';
  let lastKey = null;
  const groups = [];
  withTime.forEach(t => {
    const k = dayKey(new Date(t.start));
    if (k !== lastKey) { groups.push({ key: k, date: new Date(t.start), items: [] }); lastKey = k; }
    groups[groups.length - 1].items.push(t);
  });
  if (noTime.length) groups.push({ key: 'none', date: null, items: noTime });

  groups.forEach(g => {
    if (g.date) {
      const n = daysBetween(g.date);
      const tag = n === 0 ? '<span class="pill-day">今天</span>' : n === 1 ? '<span class="pill-day">明天</span>' : n > 1 ? `<span class="pill-day">${n} 天后</span>` : '';
      html += `<div class="group-head">${fmtDay(g.date)} ${WEEK[g.date.getDay()]} ${tag}<span class="line"></span></div>`;
    } else {
      html += `<div class="group-head">未安排时间<span class="line"></span></div>`;
    }
    g.items.forEach(t => { html += taskRowHTML(t, seqBase.get(t.id), chain.includes(t.id)); });
  });
  body.innerHTML = html;
  requestAnimationFrame(drawArrows);
}

function taskRowHTML(t, seq, isCritical) {
  const st = new Date(t.start);
  const en = t.end ? new Date(t.end) : null;
  const now = Date.now();
  const late = t.status !== 'done' && ((en && en.getTime() < now) || (!en && st && st.getTime() < now));
  const cls = [t.status];
  if (late) cls.push('late');

  const deps = (t.deps || []).map(d => byId(d)).filter(Boolean);
  const nexts = dependents(t.id);
  const unmetDeps = deps.filter(d => d.status !== 'done');

  let rel = '';
  if (deps.length) {
    rel += `<button class="chip dep" data-goto="${deps[0].id}"><span class="ar">←</span>前置：${esc(trunc(deps[0].title, 12))}</button>`;
    if (deps.length > 1) rel += `<button class="chip dep" data-goto="${deps[1].id}">+${deps.length - 1} 项</button>`;
  }
  if (unmetDeps.length && t.status === 'doing') rel += `<button class="chip warn">⚠ ${unmetDeps.length} 项前置未完成</button>`;
  nexts.slice(0, 2).forEach(n => {
    rel += `<button class="chip next" data-goto="${n.id}">后续：${esc(trunc(n.title, 12))}<span class="ar">→</span></button>`;
  });
  if (nexts.length > 2) rel += `<span class="chip next">+${nexts.length - 2}</span>`;

  return `
  <div class="tl-row" data-row="${t.id}">
    <div class="col-time">
      <b>${t.start ? fmtTime(st) : '—'}</b>
      <span>${en && t.start ? '→ ' + fmtTime(en) : (en ? '截止 ' + fmtTime(en) : '未定时长')}</span>
      <span class="rel ${late ? 'late' : ''}">${t.start ? relDay(st) + (late ? ' · 已逾期' : '') : '待安排'}</span>
    </div>
    <div class="col-axis"><span class="node ${late ? 'late' : t.status}"></span></div>
    <div class="col-card">
      <div class="task-card ${cls.join(' ')}" data-id="${t.id}" style="--tc:${t.color}">
        <div class="tc-head">
          <button class="check ${t.status === 'done' ? 'on' : ''}" data-act="toggle" data-id="${t.id}" aria-label="完成">
            <svg viewBox="0 0 24 24"><path d="M4 12.5 9.5 18 20 6.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="tc-title">${esc(t.title)}<span class="seq">#${seq}</span>${isCritical ? '<span class="pill high" style="margin-left:6px">关键链</span>' : ''}</div>
          <span class="pill ${t.status}">${STATUS_TEXT[t.status]}</span>
          ${t.priority !== 'normal' ? `<span class="pill ${t.priority}">${PRIO_TEXT[t.priority]}</span>` : ''}
          ${late ? '<span class="pill late">逾期</span>' : ''}
        </div>
        <div class="tc-meta">
          <span>${t.start ? fmtDay(st) + ' ' + fmtTime(st) : '未安排'} ${en ? '→ ' + fmtTime(en) : ''}</span>
          ${t.start && en ? `<span class="d">·</span><span>${fmtDuration(en - st)}</span>` : ''}
          ${t.start && en ? `<span class="d">·</span><span>${relDay(st)}</span>` : ''}
        </div>
        ${t.note ? `<div class="tc-note">${esc(t.note)}</div>` : ''}
        ${rel ? `<div class="tc-rel">${rel}</div>` : ''}
        <div class="tc-actions">
          <button data-act="edit" data-id="${t.id}">编辑</button>
          <button data-act="addAfter" data-id="${t.id}">在其后插入</button>
          <button class="del" data-act="del" data-id="${t.id}">删除</button>
        </div>
      </div>
    </div>
  </div>`;
}
function trunc(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }

/* -------- 依赖箭头 -------- */
const MARKERS = `
<defs>
  <marker id="ar-n" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M0 1 L9 5 L0 9 z" fill="#007AFF"/>
  </marker>
  <marker id="ar-o" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M0 1 L9 5 L0 9 z" fill="#FF9500"/>
  </marker>
  <marker id="ar-h" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0 1 L9 5 L0 9 z" fill="#007AFF"/>
  </marker>
</defs>`;

function drawArrows() {
  const svg = $('#depLayer');
  // 以 #tlBody 为基准（避免 SVG 自身宽度反过来撑大容器）
  const host = $('#tlBody');
  if (!host || host.offsetParent === null) { svg.innerHTML = ''; return; }
  const wr = host.getBoundingClientRect();
  const cards = $$('.task-card', host);
  if (!cards.length) { svg.innerHTML = ''; return; }

  const W = host.offsetWidth, H = host.offsetHeight;
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.style.width = W + 'px';
  svg.style.height = H + 'px';

  const rect = new Map();
  cards.forEach(el => {
    const r = el.getBoundingClientRect();
    rect.set(el.dataset.id, { x: r.left - wr.left, y: r.top - wr.top, w: r.width, h: r.height });
  });

  const cardLeft = Math.min(...[...rect.values()].map(r => r.x));
  const chainIds = state.critical ? criticalChain() : [];
  const edges = [];
  state.tasks.forEach(t => {
    (t.deps || []).forEach(depId => {
      const a = rect.get(depId), b = rect.get(t.id);
      if (!a || !b) return;
      const y1 = a.y + Math.min(28, a.h / 2);
      const y2 = b.y + Math.min(28, b.h / 2);
      const conflict = y2 < y1;
      const crit = chainIds.includes(t.id) && chainIds.includes(depId) &&
        chainIds.indexOf(depId) + 1 === chainIds.indexOf(t.id);
      edges.push({ from: depId, to: t.id, x1: a.x, y1, x2: b.x, y2, conflict, crit });
    });
  });

  // 通道分配（避免重叠）
  const lanes = [];
  edges.sort((p, q) => (Math.min(p.y1, p.y2) - Math.min(q.y1, q.y2)));
  edges.forEach(e => {
    const top = Math.min(e.y1, e.y2) - 6, bot = Math.max(e.y1, e.y2) + 6;
    let li = lanes.findIndex(l => l.bot < top);
    if (li < 0) { lanes.push({ bot }); li = lanes.length - 1; }
    else lanes[li].bot = bot;
    e.lane = li;
  });

  const R = 13;
  let paths = MARKERS;
  edges.forEach(e => {
    const chX = cardLeft - 16 - (e.lane % 4) * 9;
    const dirOut = -1;                       // 从卡片左边出发，向左
    const dirY = e.y2 >= e.y1 ? 1 : -1;
    const dirIn = 1;                         // 进入卡片，向右
    const d = [
      `M ${e.x1} ${e.y1}`,
      `L ${chX - R * dirOut} ${e.y1}`,
      `Q ${chX} ${e.y1} ${chX} ${e.y1 + R * dirY}`,
      `L ${chX} ${e.y2 - R * dirY}`,
      `Q ${chX} ${e.y2} ${chX + R * dirIn} ${e.y2}`,
      `L ${e.x2 - 6} ${e.y2}`
    ].join(' ');
    const cls = [e.conflict ? 'conflict' : '', e.crit ? 'critical' : ''].filter(Boolean).join(' ');
    const mk = e.conflict ? 'ar-o' : (e.crit ? 'ar-h' : 'ar-n');
    const stroke = e.conflict ? '#FF9500' : (byId(e.from) ? byId(e.from).color : '#007AFF');
    paths += `<path class="${cls}" d="${d}" stroke="${stroke}" marker-end="url(#${mk})" data-from="${e.from}" data-to="${e.to}"></path>`;
  });
  svg.innerHTML = paths;
}

/* ================= 甘特图 ================= */
let ganttCtx = { min: 0, unit: 3600000, px: 10, hourMode: true, nameW: 200 };
let drag = null;
let suppressClick = false;
const SNAP = 15 * 60000;
const gpos = ts => (ts - ganttCtx.min) / ganttCtx.unit * ganttCtx.px;
const snapMs = v => Math.round(v / SNAP) * SNAP;

function renderGantt() {
  const inner = $('#ganttInner'), body = $('#ganttBody'), layer = $('#ganttLayer');
  const list = visibleTasks().filter(t => t.start);
  if (!list.length) {
    body.innerHTML = `<div class="empty"><b>没有可绘制的事件</b>至少需要为事件设置开始时间</div>`;
    layer.innerHTML = ''; return;
  }
  const times = [];
  list.forEach(t => { times.push(new Date(t.start).getTime()); if (t.end) times.push(new Date(t.end).getTime()); });
  const now = Date.now();
  let min = Math.min(...times, now), max = Math.max(...times, now);
  const spanH = (max - min) / 3600000;
  const hourMode = spanH <= 96;
  const unit = hourMode ? 3600000 : 86400000;
  const px = hourMode ? Math.max(7, 620 / Math.max(6, spanH)) : Math.max(26, 760 / Math.max(1, (max - min) / 86400000));
  min = Math.floor(min / unit) * unit;
  max = Math.ceil(max / unit) * unit;
  const totalW = Math.max(360, (max - min) / unit * px);

  const posOf = ts => (ts - min) / unit * px;

  // 表头
  let head = '<div class="g-row head"><div class="g-name">事件</div><div class="g-track">';
  if (hourMode) {
    const startDay = new Date(min); startDay.setHours(0, 0, 0, 0);
    for (let d = new Date(startDay); d.getTime() < max; d.setDate(d.getDate() + 1)) {
      const dayEnd = new Date(d); dayEnd.setDate(dayEnd.getDate() + 1);
      const l = posOf(Math.max(d.getTime(), min)), r = posOf(Math.min(dayEnd.getTime(), max));
      const we = d.getDay() === 0 || d.getDay() === 6;
      head += `<div class="g-head-cell ${we ? 'weekend' : ''}" style="position:absolute;left:${l}px;width:${Math.max(0, r - l)}px;top:0;bottom:0;justify-content:flex-start;padding-left:6px">${fmtDay(d)} ${WEEK[d.getDay()]}</div>`;
      for (let h = 0; h < 24; h += 6) {
        const hx = posOf(d.getTime() + h * 3600000);
        if (hx >= 0 && hx <= totalW) head += `<div class="grid-line" style="left:${hx}px;opacity:.5"></div>`;
      }
    }
  } else {
    for (let d = new Date(min); d.getTime() < max; d.setDate(d.getDate() + 1)) {
      const l = posOf(d.getTime());
      const we = d.getDay() === 0 || d.getDay() === 6;
      head += `<div class="g-head-cell ${we ? 'weekend' : ''}" style="position:absolute;left:${l}px;width:${px}px;top:0;bottom:0;font-size:10.5px">${d.getMonth() + 1}/${d.getDate()}</div>`;
    }
  }
  head += '</div></div>';
  const nowX = posOf(now);

  // 行
  const rows = list.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
  let rowsHtml = '';
  rows.forEach(t => {
    const st = new Date(t.start).getTime();
    const en = t.end ? new Date(t.end).getTime() : st;
    const l = posOf(st), w = Math.max(18, posOf(en) - l);
    const milestone = !t.end || en === st;
    const tip = esc(t.title) + ' · ' + (t.end ? `${fmtFull(new Date(t.start))} → ${fmtTime(new Date(t.end))}` : fmtFull(new Date(t.start)));
    rowsHtml += `
    <div class="g-row" data-grow="${t.id}">
      <div class="g-name" title="${esc(t.title)}">${t.status === 'done' ? '✓ ' : ''}${esc(t.title)}</div>
      <div class="g-track">
        <div class="g-bar ${milestone ? 'milestone' : ''} ${t.status === 'done' ? 'done' : ''}"
             data-id="${t.id}" data-hasend="${t.end ? 1 : 0}"
             style="left:${l}px;width:${w}px;background:${t.color};box-shadow:0 3px 10px ${t.color}55"
             title="${tip}">
          <span class="gbl">${milestone ? '' : esc(trunc(t.title, 16))}</span>
          <span class="gz l"></span><span class="gz r"></span>
          <span class="gh l" data-dir="in" title="从此处拖到另一个事件：让它成为我的前置"></span>
          <span class="gh r" data-dir="out" title="从此处拖到另一个事件：我成为它的前置"></span>
        </div>
      </div>
    </div>`;
  });
  body.innerHTML = head + rowsHtml +
    `<div class="now-line" style="left:${200 + nowX}px;top:34px;bottom:0"></div>`;
  inner.style.width = (200 + totalW + 20) + 'px';

  const nameEl = $('.g-name', body);
  ganttCtx = { min, unit, px, hourMode, nameW: nameEl ? nameEl.offsetWidth : 200 };

  // 依赖箭头
  const ir = inner.getBoundingClientRect();
  const bars = new Map($$('.g-bar', body).map(el => [el.dataset.id, el.getBoundingClientRect()]));
  const chainIds = criticalChain();
  layer.setAttribute('width', inner.scrollWidth);
  layer.setAttribute('height', inner.scrollHeight);
  layer.style.width = inner.scrollWidth + 'px';
  layer.style.height = inner.scrollHeight + 'px';
  let paths = MARKERS + '<path id="linkTemp" class="link-temp" style="display:none"></path>';
  let hits = '';
  state.tasks.forEach(t => {
    (t.deps || []).forEach(depId => {
      const a = bars.get(depId), b = bars.get(t.id);
      if (!a || !b) return;
      const x1 = a.right - ir.left, y1 = a.top + a.height / 2 - ir.top;
      const x2 = b.left - ir.left - 7, y2 = b.top + b.height / 2 - ir.top;
      const conflict = x2 < x1 - 4;
      const crit = chainIds.includes(t.id) && chainIds.includes(depId) && chainIds.indexOf(depId) + 1 === chainIds.indexOf(t.id);
      const d = conflict
        ? `M ${x1} ${y1} C ${x1 + 26} ${y1} ${x2 - 26} ${y2} ${x2} ${y2}`
        : `M ${x1} ${y1} C ${x1 + Math.max(24, (x2 - x1) / 2)} ${y1} ${x2 - Math.max(24, (x2 - x1) / 2)} ${y2} ${x2} ${y2}`;
      const cls = [conflict ? 'conflict' : '', (crit && state.critical) ? 'critical' : ''].filter(Boolean).join(' ');
      const stroke = conflict ? '#FF9500' : (byId(depId) ? byId(depId).color : '#007AFF');
      paths += `<path class="${cls}" d="${d}" stroke="${stroke}" marker-end="url(#${conflict ? 'ar-o' : 'ar-n'})" data-from="${depId}" data-to="${t.id}"></path>`;
      hits += `<path d="${d}" data-from="${depId}" data-to="${t.id}"><title>点击解除这条依赖</title></path>`;
    });
  });
  layer.innerHTML = paths;

  const hitLayer = $('#ganttHitLayer');
  hitLayer.setAttribute('width', inner.scrollWidth);
  hitLayer.setAttribute('height', inner.scrollHeight);
  hitLayer.style.width = inner.scrollWidth + 'px';
  hitLayer.style.height = inner.scrollHeight + 'px';
  hitLayer.innerHTML = hits;
}

/* -------- 甘特图拖拽：改时间 / 连依赖 -------- */
function showTip(x, y, text) {
  const el = $('#dragTip');
  el.textContent = text;
  el.style.left = (x + 14) + 'px';
  el.style.top = (y - 34) + 'px';
  el.classList.add('on');
}
function hideTip() { $('#dragTip').classList.remove('on'); }

function onGanttDown(e) {
  if (e.button !== 0) return;
  const gh = e.target.closest('.gh');
  const bar = e.target.closest('.g-bar');
  if (!bar) return;
  const t = byId(bar.dataset.id);
  if (!t || !t.start) return;

  if (gh) {
    e.preventDefault(); e.stopPropagation();
    const hr = gh.getBoundingClientRect();
    drag = {
      type: 'link', id: t.id, dir: gh.dataset.dir,
      ax: hr.left + hr.width / 2, ay: hr.top + hr.height / 2,
      tid: null, ok: false
    };
    $('#ganttLayer').classList.add('dragging');
    $('#ganttHitLayer').classList.add('dragging');
    document.body.classList.add('dragging-x');
    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', onDragUp);
    return;
  }

  const r = bar.getBoundingClientRect();
  const hasEnd = !!t.end;
  const zone = Math.min(9, Math.max(4, r.width / 3));
  let mode = 'move';
  if (e.clientX - r.left <= zone && hasEnd) mode = 'left';
  else if (r.right - e.clientX <= zone) mode = 'right';
  e.preventDefault(); e.stopPropagation();
  drag = {
    type: 'bar', id: t.id, mode, x0: e.clientX, moved: false,
    s0: new Date(t.start).getTime(),
    e0: hasEnd ? new Date(t.end).getTime() : new Date(t.start).getTime(),
    hasEnd
  };
  bar.classList.add('dragging');
  $('#ganttLayer').classList.add('dragging');
  $('#ganttHitLayer').classList.add('dragging');
  document.body.classList.add('dragging-x');
  document.addEventListener('pointermove', onDragMove);
  document.addEventListener('pointerup', onDragUp);
}

function onDragMove(e) {
  if (!drag) return;
  drag.moved = true;
  if (drag.type === 'bar') {
    const ms = (e.clientX - drag.x0) / ganttCtx.px * ganttCtx.unit;
    let s = drag.s0, en = drag.e0;
    if (drag.mode === 'move') {
      s = snapMs(drag.s0 + ms);
      en = drag.hasEnd ? s + (drag.e0 - drag.s0) : s;
    } else if (drag.mode === 'left') {
      s = Math.min(snapMs(drag.s0 + ms), drag.e0 - SNAP);
      en = Math.max(drag.e0, s + SNAP);
    } else {
      en = Math.max(snapMs(drag.e0 + ms), drag.s0 + SNAP);
    }
    drag.s = s; drag.en = en; drag.moved = true;
    const bar = document.querySelector(`.g-bar[data-id="${drag.id}"]`);
    if (bar) {
      bar.style.left = gpos(s) + 'px';
      bar.style.width = Math.max(18, gpos(en) - gpos(s)) + 'px';
    }
    const a = new Date(s), b = new Date(en);
    const left = fmtDay(a) + ' ' + fmtTime(a);
    const right = sameDay(a, b) ? fmtTime(b) : fmtDay(b) + ' ' + fmtTime(b);
    showTip(e.clientX, e.clientY,
      drag.mode === 'right' || drag.hasEnd ? `${left} → ${right} · ${fmtDuration(en - s)}` : `${left} · 节点时刻`);
  } else {
    const ir = $('#ganttInner').getBoundingClientRect();
    const x1 = drag.ax - ir.left, y1 = drag.ay - ir.top;
    const x2 = e.clientX - ir.left, y2 = e.clientY - ir.top;
    const temp = $('#linkTemp');
    temp.setAttribute('d', `M ${x1} ${y1} C ${x1 + Math.max(30, (x2 - x1) / 2)} ${y1} ${x2 - Math.max(30, (x2 - x1) / 2)} ${y2} ${x2} ${y2}`);
    temp.style.display = '';

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const bar = el && el.closest ? el.closest('.g-bar') : null;
    const tid = bar ? bar.dataset.id : null;
    $$('.g-bar').forEach(b => b.classList.remove('link-ok', 'link-bad'));
    drag.tid = tid; drag.ok = false;
    if (tid && tid !== drag.id) {
      const from = drag.dir === 'out' ? drag.id : tid;
      const to = drag.dir === 'out' ? tid : drag.id;
      const tTo = byId(to);
      const exists = (tTo.deps || []).includes(from);
      if (exists) {
        drag.ok = true; drag.exists = true;
        bar.classList.add('link-ok');
        showTip(e.clientX, e.clientY, `松手解除：${trunc(byId(from).title, 8)} ⇢ ${trunc(tTo.title, 8)}`);
      } else if (!createsCycle(to, [from])) {
        drag.ok = true; drag.exists = false;
        bar.classList.add('link-ok');
        showTip(e.clientX, e.clientY, `松手连接：${trunc(byId(from).title, 8)} → 完成后开始 ${trunc(tTo.title, 8)}`);
      } else {
        bar.classList.add('link-bad');
        showTip(e.clientX, e.clientY, '会形成循环依赖');
      }
    } else {
      hideTip();
    }
  }
}

function onDragUp(e) {
  if (!drag) return;
  const d = drag; drag = null;
  document.removeEventListener('pointermove', onDragMove);
  document.removeEventListener('pointerup', onDragUp);
  document.body.classList.remove('dragging-x');
  $('#ganttLayer').classList.remove('dragging');
  $('#ganttHitLayer').classList.remove('dragging');
  $('#linkTemp').style.display = 'none';
  $$('.g-bar').forEach(b => b.classList.remove('dragging', 'link-ok', 'link-bad'));
  hideTip();
  if (d.moved) {
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 80);
  }

  if (d.type === 'bar') {
    if (!d.moved) return;
    const t = byId(d.id);
    if (!t) return;
    t.start = new Date(d.s).toISOString();
    t.end = (d.hasEnd || d.mode === 'right') ? new Date(d.en).toISOString() : null;
    renderAll();
  } else {
    if (!d.tid || d.tid === d.id) return;
    const from = d.dir === 'out' ? d.id : d.tid;
    const to = d.dir === 'out' ? d.tid : d.id;
    const tTo = byId(to);
    if (!tTo) return;
    if (!d.ok) { toast('不能形成循环依赖'); return; }
    if (d.exists) {
      tTo.deps = (tTo.deps || []).filter(x => x !== from);
      toast('已解除依赖');
    } else {
      tTo.deps = [...(tTo.deps || []), from];
      toast(`已连接：${trunc(byId(from).title, 10)} → ${trunc(tTo.title, 10)}`);
    }
    renderAll();
  }
}

/* ================= 统计 ================= */
function renderStats() {
  const now = Date.now();
  const total = state.tasks.length;
  const done = state.tasks.filter(t => t.status === 'done').length;
  const doing = state.tasks.filter(t => t.status === 'doing').length;
  const late = state.tasks.filter(t => t.status !== 'done' && t.end && new Date(t.end).getTime() < now).length;
  $('#stats').innerHTML = `
    <div class="stat"><b>${total}</b><span>事件总数</span></div>
    <div class="stat doing"><b>${doing}</b><span>进行中</span></div>
    <div class="stat ok"><b>${done}</b><span>已完成 ${total ? Math.round(done / total * 100) : 0}%</span></div>
    <div class="stat ${late ? 'warn' : ''}"><b>${late}</b><span>已逾期</span></div>`;
}

/* ================= 渲染入口 ================= */
function renderAll() {
  renderCountdown();
  renderQuote();
  renderStats();
  if (state.view === 'timeline') renderTimeline(); else renderGantt();
  $('#criticalToggle').checked = state.critical;
  save();
}

/* ================= Sheet ================= */
function openSheet(el) { $('#mask').classList.add('on'); el.classList.add('on'); }
function closeSheets() {
  $('#mask').classList.remove('on');
  $$('.sheet').forEach(s => s.classList.remove('on'));
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 1900);
}
function askConfirm(title, desc, cb) {
  $('#cfTitle').textContent = title;
  $('#cfDesc').textContent = desc;
  confirmCb = cb;
  openSheet($('#confirmSheet'));
}

/* ---- 事件表单 ---- */
function buildColorSwatches() {
  $('#fColor').innerHTML = COLORS.map(c => `<button class="sw ${c === formColor ? 'on' : ''}" data-c="${c}" style="background:${c}"></button>`).join('');
  $('#cColor').innerHTML = COLORS.map(c => `<button class="sw ${c === formCdColor ? 'on' : ''}" data-c="${c}" style="background:${c}"></button>`).join('');
}

const HOUR = 3600000;
function nextHourSlot(from) {                        // 下一个整点
  const d = from ? new Date(from) : new Date();
  d.setMinutes(0, 0, 0);
  return new Date(d.getTime() + HOUR);
}
function toggleMore(btnSel, moreSel, force) {
  const btn = $(btnSel), more = $(moreSel);
  const open = force === undefined ? !more.classList.contains('open') : !!force;
  more.classList.toggle('open', open);
  btn.classList.toggle('open', open);
  btn.setAttribute('aria-expanded', String(open));
}
function updateTaskSum() {
  const s = fromInput($('#fStart').value), e = fromInput($('#fEnd').value);
  let t;
  if (!s) t = '未安排时间';
  else {
    const r = relDay(s);
    const day = (r === '今天' || r === '明天' || r === '后天') ? r : fmtDay(s);
    t = `${day} ${fmtTime(s)}${e ? ' → ' + fmtTime(e) : ''}`;
  }
  const st = STATUS_TEXT[segValue($('#fStatus'))] || '';
  const pr = segValue($('#fPrio'));
  const prT = (pr && pr !== 'normal') ? ' · ' + PRIO_TEXT[pr] : '';
  const depT = formDeps.size ? ` · ${formDeps.size} 项前置` : '';
  $('#fSum').textContent = `${t} · ${st}${prT}${depT}`;
}
function updateCdSum() {
  const t = fromInput($('#cTarget').value);
  if (!t) { $('#cSum').textContent = '未设定时刻'; return; }
  const diff = t.getTime() - Date.now();
  const left = diff > 0 ? `还剩 ${fmtDuration(diff)}` : '已过去';
  $('#cSum').textContent = `${fmtDay(t)} ${fmtTime(t)} · ${left}`;
}

function openTaskSheet(task, presetStart, presetDeps) {
  editingTaskId = task ? task.id : null;
  $('#tsTitle').textContent = task ? '编辑事件' : '新建事件';
  $('#tsDelete').hidden = !task;
  $('#fTitle').value = task ? task.title : '';
  let sd = null, ed = null;
  if (task) { sd = task.start; ed = task.end; }
  else if (presetStart) { sd = presetStart; ed = new Date(new Date(presetStart).getTime() + HOUR); }
  else { sd = nextHourSlot(); ed = new Date(sd.getTime() + HOUR); }
  $('#fStart').value = sd ? toInput(sd) : '';
  $('#fEnd').value = ed ? toInput(ed) : '';
  $('#fNote').value = task ? task.note : '';
  formColor = task ? task.color : COLORS[0];
  formDeps = new Set(task ? (task.deps || []) : (presetDeps || []));
  setSegValue($('#fStatus'), task ? task.status : 'todo');
  setSegValue($('#fPrio'), task ? task.priority : 'normal');
  buildDepsPicker(task);
  buildColorSwatches();
  toggleMore('#fToggle', '#fMore', false);          // 默认收起
  updateTaskSum();
  openSheet($('#taskSheet'));
  setTimeout(() => $('#fTitle').focus(), 260);
}

function buildDepsPicker(task) {
  const others = state.tasks.filter(t => !task || t.id !== task.id);
  if (!others.length) { $('#fDeps').innerHTML = '<p class="tiny">还没有其它事件可作为前置。</p>'; return; }
  $('#fDeps').innerHTML = others.map(t => {
    const on = formDeps.has(t.id);
    const time = t.start ? fmtDay(new Date(t.start)) + ' ' + fmtTime(new Date(t.start)) : '未安排';
    return `<div class="dep-opt ${on ? 'on' : ''}" data-id="${t.id}"><span class="box"></span>${esc(trunc(t.title, 22))}<small>${time}</small></div>`;
  }).join('');
}

function saveTaskSheet() {
  const title = $('#fTitle').value.trim();
  if (!title) { toast('请填写事件名称'); $('#fTitle').focus(); return; }
  const start = fromInput($('#fStart').value);
  const end = fromInput($('#fEnd').value);
  if (start && end && end < start) { toast('结束时间不能早于开始时间'); return; }

  const deps = [...formDeps];
  if (editingTaskId) {
    if (createsCycle(editingTaskId, deps)) { toast('检测到循环依赖，已忽略'); return; }
    const t = byId(editingTaskId);
    Object.assign(t, {
      title, start: start ? start.toISOString() : null, end: end ? end.toISOString() : null,
      status: segValue($('#fStatus')), priority: segValue($('#fPrio')),
      color: formColor, deps, note: $('#fNote').value.trim()
    });
  } else {
    const t = normalizeTask({
      id: uid(), title, start: start ? start.toISOString() : null, end: end ? end.toISOString() : null,
      status: segValue($('#fStatus')), priority: segValue($('#fPrio')), color: formColor, deps,
      note: $('#fNote').value.trim(), createdAt: new Date().toISOString()
    });
    state.tasks.push(t);
  }
  closeSheets(); renderAll(); toast('已保存');
}

function createsCycle(id, deps) {
  const seen = new Set();
  const walk = (cur) => {
    if (cur === id) return true;
    if (seen.has(cur)) return false;
    seen.add(cur);
    const t = byId(cur);
    if (!t) return false;
    return (t.deps || []).some(walk);
  };
  return deps.some(walk);
}

/* ---- 倒计时表单 ---- */
function openCdSheet(cd) {
  editingCdId = cd ? cd.id : null;
  $('#csTitle').textContent = cd ? '编辑倒计时' : '新建倒计时';
  $('#csDelete').hidden = !cd;
  $('#cTitle').value = cd ? cd.title : '';
  if (!cd) { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(18, 0, 0, 0); $('#cTarget').value = toInput(d); }
  else $('#cTarget').value = toInput(cd.target);
  $('#cFrom').value = cd && cd.from ? toInput(cd.from) : '';
  formCdColor = cd ? cd.color : COLORS[0];
  buildColorSwatches();
  renderCdList();
  toggleMore('#cToggle', '#cMore', false);          // 默认收起
  updateCdSum();
  openSheet($('#cdSheet'));
  setTimeout(() => $('#cTitle').focus(), 260);
}
function renderCdList() {
  const list = sortedCds();
  $('#cdList').innerHTML = '<label style="font-size:12.5px;font-weight:700;color:var(--text2)">全部节点</label>' +
    list.map(c => {
      const past = new Date(c.target).getTime() <= Date.now();
      return `<div class="cd-item" data-id="${c.id}">
        <span class="cdot" style="background:${c.color}"></span>
        <span class="cn">${esc(c.title)}${past ? ' · 已到达' : ''}</span>
        <span class="ct">${fmtFull(new Date(c.target))}</span>
        <button class="cx" data-delcd="${c.id}" title="删除">×</button>
      </div>`;
    }).join('');
}
function saveCdSheet() {
  const title = $('#cTitle').value.trim() || '未命名节点';
  const target = fromInput($('#cTarget').value);
  if (!target) { toast('请选择目标时刻'); return; }
  const from = fromInput($('#cFrom').value);
  if (editingCdId) {
    const c = state.countdowns.find(x => x.id === editingCdId);
    Object.assign(c, { title, target: target.toISOString(), color: formCdColor, from: (from || new Date(c.from)).toISOString() });
  } else {
    state.countdowns.push({ id: uid(), title, target: target.toISOString(), color: formCdColor, from: new Date().toISOString() });
    state.cdIndex = pickDefaultCd();
  }
  closeSheets(); renderAll(); toast('已保存');
}

/* ================= Segmented ================= */
function segValue(seg) { return (seg.querySelector('.seg-item.active') || {}).dataset?.v; }
function setSegValue(seg, v) {
  $$('.seg-item', seg).forEach(b => b.classList.toggle('active', b.dataset.v === v));
  syncSeg(seg);
}
function syncSeg(seg) {
  const thumb = seg.querySelector('.seg-thumb');
  const active = seg.querySelector('.seg-item.active');
  if (!thumb || !active) return;
  thumb.style.width = active.offsetWidth + 'px';
  thumb.style.transform = `translateX(${active.offsetLeft - 2}px)`;
}
function bindSeg(seg, onChange) {
  seg.addEventListener('click', e => {
    const b = e.target.closest('.seg-item');
    if (!b) return;
    $$('.seg-item', seg).forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    syncSeg(seg);
    onChange && onChange(b.dataset);
  });
}

/* ================= 事件绑定 ================= */
function bind() {
  // 视图切换
  bindSeg($('#viewSeg'), d => {
    state.view = d.view;
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + d.view));
    renderAll();
  });
  bindSeg($('#filterSeg'), d => { state.filter = d.filter; renderAll(); });
  bindSeg($('#fStatus'), updateTaskSum);
  bindSeg($('#fPrio'), updateTaskSum);

  // 详细设置抽屉
  $('#fToggle').addEventListener('click', () => toggleMore('#fToggle', '#fMore'));
  $('#cToggle').addEventListener('click', () => toggleMore('#cToggle', '#cMore'));
  ['#fStart', '#fEnd'].forEach(s => $(s).addEventListener('input', updateTaskSum));
  ['#cTarget', '#cFrom'].forEach(s => $(s).addEventListener('input', updateCdSum));
  // 名称输入框回车直接保存
  $('#fTitle').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveTaskSheet(); } });
  $('#cTitle').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveCdSheet(); } });

  // 搜索
  $('#search').addEventListener('input', e => { state.search = e.target.value; renderAll(); });

  // 关键链
  $('#criticalToggle').addEventListener('change', e => { state.critical = e.target.checked; renderAll(); });

  // 每日一句
  $('#quoteCard').addEventListener('click', e => {
    if (e.target.closest('.hb')) return;
    openQuoteSheet();
  });
  $('#qPrev').addEventListener('click', () => shiftQuote(-1));
  $('#qNext').addEventListener('click', () => shiftQuote(1));
  $('#qsCancel').addEventListener('click', closeSheets);
  $('#qsSave').addEventListener('click', saveQuoteSheet);
  $('#qAdd').addEventListener('click', () => {
    const cur = state.quotes.find(x => x.id === editingQuoteId);
    if (cur) cur.text = $('#qInput').value.trim();
    const nq = { id: uid(), text: '' };
    state.quotes.push(nq);
    editingQuoteId = nq.id;
    $('#qInput').value = '';
    renderQuoteList();
    $('#qInput').focus();
  });
  $('#qUse').addEventListener('click', () => {
    const cur = state.quotes.find(x => x.id === editingQuoteId);
    if (cur) cur.text = $('#qInput').value.trim();
    if (!cur || !cur.text) { toast('先写点内容'); return; }
    state.quotes = state.quotes.filter(q => q.text.trim());
    state.qIndex = state.quotes.findIndex(q => q.id === editingQuoteId);
    state.qDate = todayKey();
    closeSheets(); renderAll(); toast('已设为今日一句');
  });
  $('#qDelete').addEventListener('click', () => {
    state.quotes = state.quotes.filter(q => q.id !== editingQuoteId);
    if (!state.quotes.length) {
      state.quotes.push({ id: uid(), text: '' });
      state.qIndex = 0; state.qDate = todayKey();
    }
    editingQuoteId = state.quotes[Math.min(state.qIndex, state.quotes.length - 1)].id;
    $('#qInput').value = state.quotes.find(q => q.id === editingQuoteId).text;
    renderQuoteList();
  });
  $('#qList').addEventListener('click', e => {
    const del = e.target.closest('[data-delq]');
    if (del) {
      state.quotes = state.quotes.filter(q => q.id !== del.dataset.delq);
      if (!state.quotes.length) state.quotes.push({ id: uid(), text: '' });
      if (!state.quotes.find(q => q.id === editingQuoteId)) {
        editingQuoteId = state.quotes[0].id;
        $('#qInput').value = state.quotes[0].text;
      }
      renderQuoteList();
      return;
    }
    const it = e.target.closest('[data-qid]');
    if (it) selectQuote(it.dataset.qid);
  });

  // 新建
  $('#addTask').addEventListener('click', () => openTaskSheet(null));

  // 时间轴交互
  $('#tlBody').addEventListener('click', e => {
    const act = e.target.closest('[data-act]');
    if (act) {
      const id = act.dataset.id;
      if (act.dataset.act === 'toggle') {
        const t = byId(id);
        t.status = t.status === 'done' ? (t.start && new Date(t.start) <= new Date() ? 'doing' : 'todo') : 'done';
        renderAll(); return;
      }
      if (act.dataset.act === 'edit') { openTaskSheet(byId(id)); return; }
      if (act.dataset.act === 'del') {
        const t = byId(id);
        askConfirm('删除事件？', `「${trunc(t.title, 18)}」将被移除，其它事件对它的前置引用也会解除。`, () => {
          state.tasks = state.tasks.filter(x => x.id !== id);
          state.tasks.forEach(x => x.deps = (x.deps || []).filter(d => d !== id));
          closeSheets(); renderAll(); toast('已删除');
        });
        return;
      }
      if (act.dataset.act === 'addAfter') {
        const t = byId(id);
        const base = t.end ? new Date(t.end) : (t.start ? new Date(t.start) : new Date());
        openTaskSheet(null, base, [id]);
        return;
      }
    }
    const goto = e.target.closest('[data-goto]');
    if (goto) focusTask(goto.dataset.goto);
  });

  // hover 高亮关联链
  $('#tlBody').addEventListener('mouseover', e => {
    const card = e.target.closest('.task-card');
    if (!card || card.dataset.hot === '1') return;
    highlightChain(card.dataset.id);
  });
  $('#tlBody').addEventListener('mouseleave', () => clearHighlight());

  // 甘特交互：拖拽改时间 / 拖手柄连依赖 / 点箭头解除
  $('#ganttBody').addEventListener('pointerdown', onGanttDown);
  $('#ganttBody').addEventListener('click', e => {
    if (suppressClick) return;
    if (e.target.closest('.gh')) return;
    const bar = e.target.closest('.g-bar');
    if (bar) { openTaskSheet(byId(bar.dataset.id)); return; }
    // 左侧事件列表也可单击编辑
    const name = e.target.closest('.g-name');
    if (name) {
      const row = name.closest('.g-row');
      const id = row && row.dataset.grow;
      if (id && byId(id)) openTaskSheet(byId(id));
    }
  });
  const hitLayer = $('#ganttHitLayer');
  hitLayer.addEventListener('click', e => {
    const p = e.target.closest('path');
    if (!p) return;
    const t = byId(p.dataset.to), f = byId(p.dataset.from);
    if (!t) return;
    t.deps = (t.deps || []).filter(x => x !== p.dataset.from);
    renderAll();
    toast(`已解除：${trunc(f ? f.title : '', 10)} ⇢ ${trunc(t.title, 10)}`);
  });
  hitLayer.addEventListener('mouseover', e => {
    const p = e.target.closest('path');
    if (!p) return;
    $$('#ganttLayer path[data-from]').forEach(x => {
      x.classList.toggle('hot', x.dataset.from === p.dataset.from && x.dataset.to === p.dataset.to);
    });
  });
  hitLayer.addEventListener('mouseleave', () => {
    $$('#ganttLayer path').forEach(x => x.classList.remove('hot'));
  });

  // 表单
  $('#tsCancel').addEventListener('click', closeSheets);
  $('#tsSave').addEventListener('click', saveTaskSheet);
  $('#tsDelete').addEventListener('click', () => {
    const t = byId(editingTaskId);
    askConfirm('删除事件？', `「${trunc(t.title, 18)}」将被移除。`, () => {
      state.tasks = state.tasks.filter(x => x.id !== editingTaskId);
      state.tasks.forEach(x => x.deps = (x.deps || []).filter(d => d !== editingTaskId));
      closeSheets(); renderAll(); toast('已删除');
    });
  });
  $('#fColor').addEventListener('click', e => {
    const b = e.target.closest('.sw'); if (!b) return;
    formColor = b.dataset.c; buildColorSwatches();
  });
  $('#fDeps').addEventListener('click', e => {
    const o = e.target.closest('.dep-opt'); if (!o) return;
    const id = o.dataset.id;
    if (formDeps.has(id)) formDeps.delete(id); else formDeps.add(id);
    o.classList.toggle('on', formDeps.has(id));
    updateTaskSum();
  });
  $('#fQuick').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.d != null) {
      const n = Number(b.dataset.d);
      const s0 = fromInput($('#fStart').value), e0 = fromInput($('#fEnd').value);
      let dur = (s0 && e0 && e0 > s0) ? e0 - s0 : HOUR;
      if (dur <= 0 || dur > 12 * HOUR) dur = HOUR;          // 异常时长兜底
      let d = new Date(); d.setDate(d.getDate() + n); d.setHours(9, 0, 0, 0);
      if (n === 0 && d.getTime() < Date.now()) d = nextHourSlot();   // 今天已过 9 点则用下一个整点
      $('#fStart').value = toInput(d);
      $('#fEnd').value = toInput(new Date(d.getTime() + dur));
    }
    if (b.dataset.dur) {
      const s = fromInput($('#fStart').value);
      if (s) $('#fEnd').value = toInput(new Date(s.getTime() + Number(b.dataset.dur) * 60000));
    }
    updateTaskSum();
  });

  // 倒计时
  $('#cdAdd').addEventListener('click', () => openCdSheet(null));
  $('#cdManage').addEventListener('click', () => openCdSheet(null));
  $('#cdPrev').addEventListener('click', () => {
    const n = sortedCds().length; if (!n) return;
    state.cdIndex = (state.cdIndex - 1 + n) % n; renderCountdown(); save();
  });
  $('#cdNext').addEventListener('click', () => {
    const n = sortedCds().length; if (!n) return;
    state.cdIndex = (state.cdIndex + 1) % n; renderCountdown(); save();
  });
  $('#csCancel').addEventListener('click', closeSheets);
  $('#csSave').addEventListener('click', saveCdSheet);
  $('#csDelete').addEventListener('click', () => {
    askConfirm('删除倒计时节点？', '该节点将从顶部倒计时中移除。', () => {
      state.countdowns = state.countdowns.filter(c => c.id !== editingCdId);
      state.cdIndex = pickDefaultCd();
      closeSheets(); renderAll(); toast('已删除');
    });
  });
  $('#cColor').addEventListener('click', e => {
    const b = e.target.closest('.sw'); if (!b) return;
    formCdColor = b.dataset.c; buildColorSwatches();
  });
  $('#cdList').addEventListener('click', e => {
    const del = e.target.closest('[data-delcd]');
    if (del) {
      const id = del.dataset.delcd;
      state.countdowns = state.countdowns.filter(c => c.id !== id);
      state.cdIndex = pickDefaultCd(); renderCdList(); renderCountdown(); save();
      return;
    }
    const it = e.target.closest('.cd-item');
    if (it) { const c = state.countdowns.find(x => x.id === it.dataset.id); if (c) openCdSheet(c); }
  });
  $('#cdSheet').addEventListener('click', e => {
    const b = e.target.closest('[data-cd]'); if (!b) return;
    const d = new Date(); d.setDate(d.getDate() + Number(b.dataset.cd)); d.setHours(18, 0, 0, 0);
    $('#cTarget').value = toInput(d);
    updateCdSum();
  });

  // 确认框
  $('#cfNo').addEventListener('click', () => { confirmCb = null; closeSheets(); });
  $('#cfYes').addEventListener('click', () => { const cb = confirmCb; confirmCb = null; closeSheets(); cb && cb(); });
  $('#mask').addEventListener('click', () => { confirmCb = null; closeSheets(); });

  // 导入导出
  $('#expBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ tasks: state.tasks, countdowns: state.countdowns, quotes: state.quotes }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `时间规划-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  });
  $('#impBtn').addEventListener('click', () => $('#impFile').click());
  $('#impFile').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const s = JSON.parse(r.result);
        if (!Array.isArray(s.tasks)) throw 0;
        state.tasks = s.tasks.map(normalizeTask);
        if (Array.isArray(s.countdowns)) state.countdowns = s.countdowns;
        if (Array.isArray(s.quotes)) { state.quotes = s.quotes.map(q => ({ id: q.id || uid(), text: String(q.text || '') })).filter(q => q.text.trim()); state.qIndex = 0; state.qDate = ''; }
        state.cdIndex = pickDefaultCd();
        renderAll(); toast('导入成功');
      } catch (err) { toast('文件格式不正确'); }
      e.target.value = '';
    };
    r.readAsText(f);
  });
  $('#resetBtn').addEventListener('click', () => {
    askConfirm('清空并载入示例？', '当前所有事件与倒计时都会被替换为示例数据。', () => {
      state.tasks = []; state.countdowns = []; seed(); state.cdIndex = pickDefaultCd(); renderAll(); toast('已载入示例');
    });
  });
  $('#clearBtn').addEventListener('click', () => {
    const n1 = state.tasks.length, n2 = state.countdowns.length, n3 = state.quotes.length;
    if (!n1 && !n2 && !n3) { toast('已经是空的了'); return; }
    askConfirm('清空全部数据？', `将删除 ${n1} 个事件、${n2} 个倒计时节点、${n3} 句话，且不会载入示例。此操作无法撤销，建议先导出备份。`, () => {
      state.tasks = []; state.countdowns = []; state.quotes = [];
      state.qIndex = 0; state.qDate = '';
      state.cdIndex = 0; state.filter = 'all'; state.search = '';
      $('#search').value = '';
      $$('#filterSeg .seg-item').forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
      syncSeg($('#filterSeg'));
      renderAll(); toast('已清空全部数据');
    });
  });

  // 快捷键
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSheets();
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      if ($('#taskSheet').classList.contains('on')) saveTaskSheet();
      if ($('#cdSheet').classList.contains('on')) saveCdSheet();
    }
    if (e.key === 'n' && !/input|textarea/i.test(document.activeElement.tagName) && !$('.sheet.on')) {
      e.preventDefault(); openTaskSheet(null);
    }
  });

  window.addEventListener('resize', () => {
    $$('.seg').forEach(syncSeg);
    if (state.view === 'timeline') drawArrows(); else renderGantt();
  });
}

function highlightChain(id) {
  const rel = relatedSet(id);
  $$('.task-card').forEach(c => {
    const on = rel.has(c.dataset.id);
    c.classList.toggle('hot', c.dataset.id === id);
    c.classList.toggle('dim', !on);
    c.dataset.hot = on ? '1' : '';
  });
  $$('#depLayer path').forEach(p => {
    const on = rel.has(p.dataset.from) && rel.has(p.dataset.to);
    p.classList.toggle('hot', on);
    p.classList.toggle('cold', !on);
  });
}
function clearHighlight() {
  $$('.task-card').forEach(c => { c.classList.remove('hot', 'dim'); c.dataset.hot = ''; });
  $$('#depLayer path').forEach(p => p.classList.remove('hot', 'cold'));
}
function focusTask(id) {
  if (state.view !== 'timeline') {
    $$('#viewSeg .seg-item').forEach(b => b.classList.toggle('active', b.dataset.view === 'timeline'));
    syncSeg($('#viewSeg'));
    state.view = 'timeline';
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-timeline'));
    renderAll();
  }
  setTimeout(() => {
    let el = document.querySelector(`.task-card[data-id="${id}"]`);
    if (!el) { // 可能被筛选/搜索隐藏，清除条件后重找
      state.filter = 'all'; state.search = ''; $('#search').value = '';
      $$('#filterSeg .seg-item').forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
      syncSeg($('#filterSeg'));
      renderAll();
      el = document.querySelector(`.task-card[data-id="${id}"]`);
    }
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    highlightChain(id);
    setTimeout(clearHighlight, 1600);
  }, 60);
}

/* ================= 启动 ================= */
function init() {
  if (!load()) { seed(); }
  state.cdIndex = pickDefaultCd();
  $$('#viewSeg .seg-item').forEach(b => b.classList.toggle('active', b.dataset.view === (state.view || 'timeline')));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + state.view));
  bind();
  $$('.seg').forEach(syncSeg);
  renderAll();
  setInterval(tickCountdown, 1000);
  setInterval(() => { if (state.view === 'timeline') drawArrows(); }, 2000);
}
init();
