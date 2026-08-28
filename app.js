(() => {
  'use strict';

  const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const STORAGE_KEY = 'dinnermaker.v1';
  const FOOD_BY_ID = Object.fromEntries(FOODS.map(f => [f.id, f]));
  const $ = sel => document.querySelector(sel);

  // ---------- dates ----------
  function pad(n) { return String(n).padStart(2, '0'); }
  function fmt(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function weekStart(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - x.getDay()); return x; }
  function shortDate(d) { return `${d.getDate()}.${d.getMonth() + 1}`; }

  // ---------- state ----------
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        return { settings: { ...SETTINGS_DEFAULT, ...(s.settings || {}) }, plans: s.plans || {} };
      }
    } catch (e) { /* ignore */ }
    return { settings: { ...SETTINGS_DEFAULT }, plans: {} };
  }
  function saveState() {
    // don't persist weeks that ended up empty — they're recreated on demand
    const plans = {};
    Object.entries(state.plans).forEach(([k, w]) => { if (w.days.some(d => d.length)) plans[k] = w; });
    Object.keys(plans).sort().slice(0, -12).forEach(k => delete plans[k]);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings: state.settings, plans })); } catch (e) { /* ignore */ }
  }

  const state = loadState();
  const today = new Date();
  const thisWeekStart = weekStart(today);

  // איזה שבוע מוצג: 0 = השבוע, 1 = שבוע הבא וכו'
  const MIN_OFFSET = -2, MAX_OFFSET = 4;
  let weekOffset = 0;

  function viewWeekStart() { const d = new Date(thisWeekStart); d.setDate(d.getDate() + weekOffset * 7); return d; }
  const normalized = new Set();
  function getWeek() {
    const key = fmt(viewWeekStart());
    let w = state.plans[key];
    if (!w || !Array.isArray(w.days) || w.days.length !== 7) w = state.plans[key] = { days: [[], [], [], [], [], [], []] };
    if (!normalized.has(key)) {
      normalized.add(key);
      // one portion per food, and drop foods that no longer exist in foods.js
      w.days = w.days.map(d => [...new Set(Array.isArray(d) ? d : [])].filter(id => FOOD_BY_ID[id]));
    }
    return w;
  }

  let selectedDay = today.getDay();
  let tab = 'all';
  let nutrientFilter = null;   // סינון לפי פס תזונה (id של NUTRIENTS), null = כבוי

  function setNutrientFilter(id) {
    nutrientFilter = (nutrientFilter === id) ? null : id;
    render();
  }

  // ---------- derived ----------
  function dayInfo(d) {
    const items = getWeek().days[d];
    const totals = NUTRIENTS.map(() => 0);
    items.forEach(id => FOOD_BY_ID[id].n.forEach((v, i) => { totals[i] += v; }));
    const treat = items.some(id => FOOD_BY_ID[id].treat);
    const solo = items.some(id => FOOD_BY_ID[id].solo);
    const barsFull = NUTRIENTS.every((n, i) => totals[i] >= n.target);
    // ארוחה שלמה (פיצה, שניצל...) לא צריכה למלא פסים — היא ארוחה בפני עצמה
    const complete = items.length > 0 && !treat && (solo || barsFull);
    return { items, totals, treat, solo, complete, barsFull, empty: items.length === 0 };
  }
  function treatDaysUsed(exceptDay = -1) {
    let c = 0;
    for (let d = 0; d < 7; d++) if (d !== exceptDay && dayInfo(d).treat) c++;
    return c;
  }
  function missingNutrients(info) {
    return NUTRIENTS.filter((n, i) => info.totals[i] < n.target);
  }

  // ---------- actions ----------
  function addFood(id) {
    const f = FOOD_BY_ID[id];
    const items = getWeek().days[selectedDay];
    const info = dayInfo(selectedDay);
    const wasComplete = info.complete;
    const s = state.settings;

    if (items.includes(id)) { removeFood(id); return; }

    if (f.treat && !info.treat && treatDaysUsed(selectedDay) >= s.treatNights) {
      toast(s.treatNights === 0 ? 'אין ערבי פינוק השבוע 🙈' : 'נגמרו ערבי הפינוק לשבוע הזה 🙈');
      shake(id);
      return;
    }

    if (f.solo && items.length > 0) {
      toast('זו ארוחה שלמה — קודם צריך לנקות את הצלחת 🗑️');
      shake(id);
      return;
    }
    if (info.solo) {
      toast(`${FOOD_BY_ID[items[0]].name} זו כל הארוחה הערב 😊`);
      shake(id);
      return;
    }
    if (!f.solo && items.length >= s.maxItems) {
      toast('הצלחת מלאה! אפשר להוריד משהו 🍽️');
      shake(id);
      return;
    }
    items.push(id);
    if (f.solo) toast(`${f.emoji} ${f.name} — זו כל הארוחה הערב!`);

    saveState();
    render();
    bump(id);

    const now = dayInfo(selectedDay);
    if (f.treat) celebrate(`${f.emoji} ערב פינוק!`);
    else if (f.solo) celebrate(`${f.emoji} ${f.name} להערב!`);
    else if (!wasComplete && now.complete) celebrate('🌟 ארוחה מושלמת! כל הכבוד!');
  }

  function removeFood(id) {
    const items = getWeek().days[selectedDay];
    const idx = items.indexOf(id);
    if (idx >= 0) items.splice(idx, 1);
    saveState();
    render();
  }

  function clearDay() {
    getWeek().days[selectedDay] = [];
    saveState();
    render();
  }

  // ---------- render ----------
  function render() {
    renderHeader();
    renderDays();
    renderPlate();
    renderStatus();
    renderBars();
    renderTabs();
    renderGrid();
  }

  function weekRange() {
    const start = viewWeekStart(), end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${shortDate(start)} – ${shortDate(end)}`;
  }
  function weekName() {
    return weekOffset === 0 ? 'השבוע' : weekOffset === 1 ? 'שבוע הבא' : weekOffset === -1 ? 'שבוע שעבר' : '';
  }
  function renderHeader() {
    const name = weekName();
    $('#week-label').textContent = `📅 ${name ? name + ' · ' : ''}${weekRange()}`;
    $('#btn-week-prev').disabled = weekOffset <= MIN_OFFSET;
    $('#btn-week-next').disabled = weekOffset >= MAX_OFFSET;
    const used = treatDaysUsed();
    const el = $('#treat-counter');
    el.textContent = `🥞 פינוקים: ${used}/${state.settings.treatNights}`;
    el.classList.toggle('warn', used >= state.settings.treatNights);
  }

  function renderDays() {
    const nav = $('#days');
    nav.innerHTML = '';
    for (let d = 0; d < 7; d++) {
      const info = dayInfo(d);
      const btn = document.createElement('button');
      btn.className = 'day' + (d === selectedDay ? ' active' : '') + (info.complete ? ' done' : '') + (info.treat ? ' treat' : '');
      const uniq = [...new Set(info.items)].slice(0, 4).map(id => FOOD_BY_ID[id].emoji).join('');
      let status = 'ריק';
      if (info.treat) status = '🎉 פינוק';
      else if (info.solo) status = '🍽️ ארוחה שלמה';
      else if (info.complete) status = '✅ מושלם';
      else if (!info.empty) status = '⏳ עוד קצת';
      btn.innerHTML = `
        ${weekOffset === 0 && d === today.getDay() ? '<span class="today-tag">היום</span>' : ''}
        <span class="day-name">${DAYS[d]}</span>
        <span class="day-foods">${uniq || '·'}</span>
        <span class="day-status">${status}</span>`;
      btn.addEventListener('click', () => { selectedDay = d; render(); });
      nav.appendChild(btn);
    }
  }

  function renderPlate() {
    const info = dayInfo(selectedDay);
    $('#day-title').textContent = `🍽️ ארוחת ערב של יום ${DAYS[selectedDay]}`;
    const plate = $('#plate');
    plate.innerHTML = '';
    if (info.empty) {
      plate.innerHTML = '<div class="empty">הצלחת ריקה…<br>בחרי אוכל מלמטה 👇</div>';
      return;
    }
    info.items.forEach(id => {
      const f = FOOD_BY_ID[id];
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.innerHTML = `
        <span class="chip-emoji">${f.emoji}</span>
        <span>${f.name}</span>
        <button class="chip-x" aria-label="להוריד ${f.name}">✕</button>`;
      chip.querySelector('.chip-x').addEventListener('click', () => removeFood(id));
      plate.appendChild(chip);
    });
  }

  function renderStatus() {
    const info = dayInfo(selectedDay);
    const el = $('#status');
    el.className = 'status';
    if (info.treat) {
      el.classList.add('treat');
      el.textContent = '🎉 ערב פינוק! בלי פסים הערב';
    } else if (info.solo) {
      el.classList.add('ok');
      el.textContent = `🍽️ ${FOOD_BY_ID[info.items[0]].name} — זו כל הארוחה הערב!`;
    } else if (info.complete) {
      el.classList.add('ok');
      el.textContent = '🌟 כל הכבוד! ארוחה מושלמת';
    } else if (info.empty) {
      el.textContent = 'תבחרי אוכל עד שכל הפסים יתמלאו';
    } else {
      el.textContent = '';
      el.appendChild(document.createTextNode('חסר עוד:'));
      missingNutrients(info).forEach(n => {
        const b = document.createElement('button');
        b.className = 'miss' + (nutrientFilter === n.id ? ' active' : '');
        b.textContent = `${n.emoji} ${n.name}`;
        b.title = `להראות אוכל עם ${n.name}`;
        b.addEventListener('click', () => setNutrientFilter(n.id));
        el.appendChild(b);
      });
    }
  }

  function renderBars() {
    const info = dayInfo(selectedDay);
    const bars = $('#bars');
    // build once, then only update — keeps the CSS width transition
    if (!bars.children.length) {
      NUTRIENTS.forEach(n => {
        const bar = document.createElement('button');
        bar.className = 'bar';
        bar.dataset.id = n.id;
        bar.title = `להראות אוכל עם ${n.name}`;
        bar.innerHTML = `
          <span class="bar-label">${n.emoji} ${n.name}</span>
          <div class="bar-track"><div class="bar-fill" style="background-color:${n.color}"></div></div>
          <span class="bar-check">✅</span>`;
        bar.addEventListener('click', () => setNutrientFilter(n.id));
        bars.appendChild(bar);
      });
    }
    NUTRIENTS.forEach((n, i) => {
      const bar = bars.children[i];
      const pct = Math.min(100, Math.round(info.totals[i] / n.target * 100));
      bar.querySelector('.bar-fill').style.width = pct + '%';
      bar.classList.toggle('full', info.totals[i] >= n.target && !info.treat && !info.solo);
      bar.classList.toggle('filtering', nutrientFilter === n.id);
      bar.style.opacity = (info.treat || info.solo) ? .4 : 1;
    });
  }

  function renderTabs() {
    const tabs = $('#tabs');
    tabs.innerHTML = '';
    const list = [{ id: 'all', name: 'הכל', emoji: '🍽️' }, { id: 'fav', name: 'האהובים', emoji: '❤️' }, ...CATEGORIES];
    list.forEach(c => {
      const b = document.createElement('button');
      b.className = 'tab' + (!nutrientFilter && tab === c.id ? ' active' : '');
      b.setAttribute('role', 'tab');
      b.textContent = `${c.emoji} ${c.name}`;
      b.addEventListener('click', () => { tab = c.id; nutrientFilter = null; render(); });
      tabs.appendChild(b);
    });

    const nutTabs = $('#nutrient-tabs');
    nutTabs.innerHTML = '';
    const info = dayInfo(selectedDay);
    NUTRIENTS.forEach((n, i) => {
      const b = document.createElement('button');
      const done = !info.treat && !info.solo && info.totals[i] >= n.target;
      b.className = 'tab nut' + (nutrientFilter === n.id ? ' active' : '') + (done ? ' done' : '');
      b.style.setProperty('--nut', n.color);
      b.textContent = `${n.emoji} ${n.name}${done ? ' ✅' : ''}`;
      b.title = `להראות אוכל עם ${n.name}`;
      b.addEventListener('click', () => setNutrientFilter(n.id));
      nutTabs.appendChild(b);
    });
  }

  function hearts(r) {
    if (!r) return '<span class="hearts none">❓ לא דירגתי</span>';
    const pct = Math.max(0, Math.min(5, r)) / 5 * 100;
    return `<span class="hearts" title="${r}/5"><span class="hearts-base">🤍🤍🤍🤍🤍</span><span class="hearts-fill" style="width:${pct}%">❤️❤️❤️❤️❤️</span></span>`;
  }

  function renderGrid() {
    const info = dayInfo(selectedDay);
    const s = state.settings;
    const grid = $('#grid');
    grid.innerHTML = '';
    const nutIdx = nutrientFilter ? NUTRIENTS.findIndex(n => n.id === nutrientFilter) : -1;
    let foods;
    if (nutIdx >= 0) {
      // ארוחות שלמות לא ממלאות פסים, אז אין טעם להציע אותן כאן
      foods = FOODS.filter(f => !f.solo && f.n[nutIdx] > 0)
        .sort((a, b) =>
          (b.n[nutIdx] - a.n[nutIdx]) ||
          ((b.rating || 0) - (a.rating || 0)) ||
          a.name.localeCompare(b.name, 'he'));
    } else {
      foods = FOODS.filter(f => tab === 'all' || (tab === 'fav' ? (f.rating || 0) >= 4 : f.cat === tab))
        .sort((a, b) =>
          ((b.rating || 0) - (a.rating || 0)) ||
          a.name.localeCompare(b.name, 'he'));
    }

    const treatsLeft = treatDaysUsed(selectedDay) < s.treatNights;
    foods.forEach(f => {
      const selected = info.items.includes(f.id);
      let disabled = false;
      if (selected) disabled = false;
      else if (f.solo && info.items.length > 0) disabled = true;   // כבר התחילה לבחור
      else if (info.solo) disabled = true;                          // כבר יש ארוחה שלמה
      else if (f.treat && !treatsLeft) disabled = true;
      else if (info.items.length >= s.maxItems) disabled = true;

      const b = document.createElement('button');
      b.className = 'food' + (selected ? ' selected' : '') + (disabled ? ' disabled' : '');
      b.dataset.id = f.id;
      let tag = f.treat ? '<span class="tag treat">🎉 פינוק</span>' : (f.solo ? '<span class="tag">🍽️ ארוחה שלמה</span>' : '');
      if (nutIdx >= 0) {
        const n = NUTRIENTS[nutIdx];
        tag = `<span class="tag nut" style="--nut:${n.color}">${n.emoji.repeat(f.n[nutIdx])}</span>`;
      }
      b.innerHTML = `
        ${selected ? '<span class="badge">✓</span>' : ''}
        <span class="emoji">${f.emoji}</span>
        <span class="name">${f.name}</span>
        ${hearts(f.rating)}
        ${tag}`;
      b.addEventListener('click', () => addFood(f.id));
      grid.appendChild(b);
    });
  }

  // ---------- effects ----------
  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 2200);
  }
  function shake(id) {
    const el = document.querySelector(`.food[data-id="${id}"]`);
    if (!el) return;
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  }
  function bump(id) {
    const el = document.querySelector(`.food[data-id="${id}"]`);
    if (!el) return;
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 400);
  }
  function celebrate(msg) {
    const c = $('#celebrate');
    c.innerHTML = `<span>${msg}</span>`;
    c.classList.remove('hidden');
    setTimeout(() => c.classList.add('hidden'), 1900);
    confetti();
  }
  function confetti() {
    const box = $('#confetti');
    const emojis = ['🎉', '⭐', '🌟', '✨', '🍓', '💚', '🎈', '🥳'];
    for (let i = 0; i < 40; i++) {
      const s = document.createElement('span');
      s.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      s.style.left = Math.random() * 100 + 'vw';
      s.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
      s.style.animationDelay = (Math.random() * .5) + 's';
      s.style.fontSize = (18 + Math.random() * 18) + 'px';
      box.appendChild(s);
      setTimeout(() => s.remove(), 3500);
    }
  }

  // ---------- modals ----------
  function openModal(id) { $(id).classList.remove('hidden'); }
  function closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); }
  document.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', closeModals));
  document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeModals(); }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModals(); });

  // settings
  const resetBtn = $('#btn-reset-week');
  let resetArmed = false;
  function armReset(on) {
    resetArmed = on;
    resetBtn.classList.toggle('confirm', on);
    resetBtn.textContent = on ? '⚠️ בטוח? כל הארוחות של השבוע יימחקו' : '🔄 להתחיל את השבוע מחדש';
  }
  $('#btn-settings').addEventListener('click', () => {
    $('#set-treats').value = state.settings.treatNights;
    $('#set-max-items').value = state.settings.maxItems;
    armReset(false);
    openModal('#modal-settings');
  });
  function bindSetting(sel, key, min, max) {
    $(sel).addEventListener('change', e => {
      const v = Math.max(min, Math.min(max, parseInt(e.target.value, 10) || min));
      e.target.value = v;
      state.settings[key] = v;
      saveState();
      render();
    });
  }
  bindSetting('#set-treats', 'treatNights', 0, 7);
  bindSetting('#set-max-items', 'maxItems', 2, 12);
  resetBtn.addEventListener('click', () => {
    if (!resetArmed) { armReset(true); return; }
    getWeek().days = [[], [], [], [], [], [], []];
    saveState();
    closeModals();
    render();
    toast('שבוע חדש! 🌈');
  });

  // summary
  function weekText() {
    const lines = [`🍽️ ארוחות ערב · ${weekRange()}`, ''];
    for (let d = 0; d < 7; d++) {
      const info = dayInfo(d);
      const mark = info.treat ? ' 🎉' : info.solo ? ' 🍽️' : info.complete ? ' ✅' : info.empty ? '' : ' ⏳';
      const foods = info.items.map(id => `${FOOD_BY_ID[id].emoji} ${FOOD_BY_ID[id].name}`).join(' · ') || '—';
      lines.push(`יום ${DAYS[d]}: ${foods}${mark}`);
    }
    return lines.join('\n');
  }

  async function copyWeek() {
    const text = weekText();
    try {
      await navigator.clipboard.writeText(text);
      toast('הועתק! 📄');
      return;
    } catch (e) { /* fall through to the old-school way */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      toast(ok ? 'הועתק! 📄' : 'לא הצלחתי להעתיק 😕');
    } catch (e) { toast('לא הצלחתי להעתיק 😕'); }
  }
  $('#btn-copy').addEventListener('click', copyWeek);

  $('#btn-summary').addEventListener('click', () => {
    const name = weekName();
    $('#summary-title').textContent = `📋 ארוחות ${name || weekRange()}`;
    const body = $('#summary-body');
    body.innerHTML = '';
    for (let d = 0; d < 7; d++) {
      const info = dayInfo(d);
      const foods = info.items.map(id => `${FOOD_BY_ID[id].emoji} ${FOOD_BY_ID[id].name}`).join(' · ');
      const status = info.treat ? '🎉' : info.solo ? '🍽️' : info.complete ? '✅' : info.empty ? '▫️' : '⏳';
      const row = document.createElement('div');
      row.className = 'summary-day';
      row.innerHTML = `
        <div class="sd-name">יום ${DAYS[d]}</div>
        <div class="sd-foods">${foods || '<span class="muted">עוד לא נבחר</span>'}</div>
        <div class="sd-status">${status}</div>`;
      body.appendChild(row);
    }
    openModal('#modal-summary');
  });
  $('#btn-print').addEventListener('click', () => window.print());

  $('#btn-clear').addEventListener('click', clearDay);

  function goWeek(delta) {
    const next = Math.max(MIN_OFFSET, Math.min(MAX_OFFSET, weekOffset + delta));
    if (next === weekOffset) return;
    weekOffset = next;
    if (weekOffset !== 0) selectedDay = 0;
    else selectedDay = today.getDay();
    closeModals();
    render();
  }
  $('#btn-week-prev').addEventListener('click', () => goWeek(-1));
  $('#btn-week-next').addEventListener('click', () => goWeek(1));

  render();
})();
