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
  function serialize() {
    // don't persist weeks that ended up empty — they're recreated on demand
    const plans = {};
    Object.entries(state.plans).forEach(([k, w]) => { if (w.days.some(d => d.length)) plans[k] = w; });
    Object.keys(plans).sort().slice(0, -12).forEach(k => delete plans[k]);
    return { settings: state.settings, plans };
  }
  function saveLocal(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }
  function saveState() {
    const data = serialize();
    saveLocal(data);
    Sync.save(data);
  }
  // Firebase drops empty arrays and may turn sparse arrays into objects — rebuild the
  // exact shape app code expects: plans[week].days = 7 arrays of food ids.
  function normalizeRemote(data) {
    const plans = {};
    Object.entries((data && data.plans) || {}).forEach(([k, w]) => {
      const src = (w && w.days) || {};
      const days = [];
      for (let d = 0; d < 7; d++) {
        const v = src[d];
        days.push(Array.isArray(v) ? v.filter(Boolean) : v && typeof v === 'object' ? Object.values(v) : []);
      }
      plans[k] = { days };
    });
    return { settings: { ...SETTINGS_DEFAULT, ...((data && data.settings) || {}) }, plans };
  }
  function applyRemote(data) {
    if (data === null || data === undefined) {
      // first sign-in for this group: seed the shared plan with whatever this browser has
      Sync.save(serialize());
      return;
    }
    const next = normalizeRemote(data);
    if (JSON.stringify(next) === JSON.stringify(serialize())) return;
    state.settings = next.settings;
    state.plans = next.plans;
    normalized.clear();
    saveLocal(next);
    render();
  }

  const state = loadState();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function sameDay(a, b) { return fmt(a) === fmt(b); }
  function daysFromToday(d) { return Math.round((d - today) / 86400000); }

  // היום שנבחר; אפשר לנוע שבועיים אחורה וארבעה שבועות קדימה
  const MIN_DAYS = -14, MAX_DAYS = 28;
  let selectedDate = new Date(today);

  const normalized = new Set();
  function getWeek(date = selectedDate) {
    const key = fmt(weekStart(date));
    let w = state.plans[key];
    if (!w || !Array.isArray(w.days) || w.days.length !== 7) w = state.plans[key] = { days: [[], [], [], [], [], [], []] };
    if (!normalized.has(key)) {
      normalized.add(key);
      // one portion per food, and drop foods that no longer exist in foods.js
      w.days = w.days.map(d => [...new Set(Array.isArray(d) ? d : [])].filter(id => FOOD_BY_ID[id]));
    }
    return w;
  }

  function dayItems(date) { return getWeek(date).days[date.getDay()]; }

  let tab = 'all';
  let nutrientFilter = null;   // סינון לפי פס תזונה (id של NUTRIENTS), null = כבוי

  function setNutrientFilter(id) {
    nutrientFilter = (nutrientFilter === id) ? null : id;
    render();
  }

  // ---------- derived ----------
  function dayInfo(date) {
    const items = dayItems(date);
    const totals = NUTRIENTS.map(() => 0);
    items.forEach(id => FOOD_BY_ID[id].n.forEach((v, i) => { totals[i] += v; }));
    const treat = items.some(id => FOOD_BY_ID[id].treat);
    const solo = items.some(id => FOOD_BY_ID[id].solo);
    const barsFull = NUTRIENTS.every((n, i) => totals[i] >= n.target);
    // ארוחה שלמה (פיצה, שניצל...) לא צריכה למלא פסים — היא ארוחה בפני עצמה
    const complete = items.length > 0 && !treat && (solo || barsFull);
    return { items, totals, treat, solo, complete, barsFull, empty: items.length === 0 };
  }
  // ימי פינוק בשבוע של היום שנבחר (ראשון–שבת)
  function treatDaysUsed(exceptDate = null) {
    let c = 0;
    weekDates().forEach(dt => { if (!(exceptDate && sameDay(dt, exceptDate)) && dayInfo(dt).treat) c++; });
    return c;
  }
  function weekDates() {
    const ws = weekStart(selectedDate);
    return Array.from({ length: 7 }, (_, d) => addDays(ws, d));
  }
  function missingNutrients(info) {
    return NUTRIENTS.filter((n, i) => info.totals[i] < n.target);
  }

  // ---------- actions ----------
  function addFood(id) {
    const f = FOOD_BY_ID[id];
    const items = dayItems(selectedDate);
    const info = dayInfo(selectedDate);
    const wasComplete = info.complete;
    const s = state.settings;

    if (items.includes(id)) { removeFood(id); return; }

    if (f.treat && !info.treat && treatDaysUsed(selectedDate) >= s.treatNights) {
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

    const now = dayInfo(selectedDate);
    if (f.treat) celebrate(`${f.emoji} ערב פינוק!`);
    else if (f.solo) celebrate(`${f.emoji} ${f.name} להערב!`);
    else if (!wasComplete && now.complete) celebrate('🌟 ארוחה מושלמת! כל הכבוד!');
  }

  function removeFood(id) {
    const items = dayItems(selectedDate);
    const idx = items.indexOf(id);
    if (idx >= 0) items.splice(idx, 1);
    saveState();
    render();
  }

  function clearDay() {
    getWeek().days[selectedDate.getDay()] = [];
    saveState();
    render();
  }

  // ---------- render ----------
  function render() {
    renderDays();
    renderPlate();
    renderStatus();
    renderBars();
    renderTabs();
    renderGrid();
  }

  function weekRange() {
    const start = weekStart(selectedDate);
    return `${shortDate(start)} – ${shortDate(addDays(start, 6))}`;
  }
  function weekName() {
    const w = Math.round((weekStart(selectedDate) - weekStart(today)) / (7 * 86400000));
    return w === 0 ? 'השבוע' : w === 1 ? 'שבוע הבא' : w === -1 ? 'שבוע שעבר' : '';
  }

  // רצועת ימים: היום שנבחר באמצע, שלושה לפניו ושלושה אחריו
  function renderDays() {
    const nav = $('#days');
    nav.innerHTML = '';
    for (let o = -3; o <= 3; o++) {
      const date = addDays(selectedDate, o);
      const info = dayInfo(date);
      const isToday = sameDay(date, today);
      const btn = document.createElement('button');
      btn.className = 'day' + (o === 0 ? ' active' : '') + (isToday ? ' today' : '') + (info.complete ? ' done' : '') + (info.treat ? ' treat' : '');
      const uniq = [...new Set(info.items)].slice(0, 4).map(id => FOOD_BY_ID[id].emoji).join('');
      let status = 'ריק';
      if (info.treat) status = '🎉 פינוק';
      else if (info.solo) status = '🍽️ ארוחה שלמה';
      else if (info.complete) status = '✅ מושלם';
      else if (!info.empty) status = '⏳ עוד קצת';
      btn.innerHTML = `
        ${isToday ? '<span class="today-tag">היום</span>' : ''}
        <span class="day-name">${DAYS[date.getDay()]}</span>
        <span class="day-date">${shortDate(date)}</span>
        <span class="day-foods">${uniq || '·'}</span>
        <span class="day-status">${status}</span>`;
      btn.addEventListener('click', () => { goDay(o); });
      nav.appendChild(btn);
    }
    $('#btn-day-prev').disabled = daysFromToday(selectedDate) <= MIN_DAYS;
    $('#btn-day-next').disabled = daysFromToday(selectedDate) >= MAX_DAYS;
    const active = nav.querySelector('.day.active');
    if (active && nav.scrollWidth > nav.clientWidth) active.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  function renderPlate() {
    const info = dayInfo(selectedDate);
    $('#day-title').textContent = `🍽️ ארוחת ערב של יום ${DAYS[selectedDate.getDay()]} · ${shortDate(selectedDate)}`;
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
    const info = dayInfo(selectedDate);
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
    const info = dayInfo(selectedDate);
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
    const info = dayInfo(selectedDate);
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
    const info = dayInfo(selectedDate);
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

    const treatsLeft = treatDaysUsed(selectedDate) < s.treatNights;
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
    weekDates().forEach((date, d) => {
      const info = dayInfo(date);
      const mark = info.treat ? ' 🎉' : info.solo ? ' 🍽️' : info.complete ? ' ✅' : info.empty ? '' : ' ⏳';
      const foods = info.items.map(id => `${FOOD_BY_ID[id].emoji} ${FOOD_BY_ID[id].name}`).join(' · ') || '—';
      lines.push(`יום ${DAYS[d]} ${shortDate(date)}: ${foods}${mark}`);
    });
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
    weekDates().forEach((date, d) => {
      const info = dayInfo(date);
      const foods = info.items.map(id => `${FOOD_BY_ID[id].emoji} ${FOOD_BY_ID[id].name}`).join(' · ');
      const status = info.treat ? '🎉' : info.solo ? '🍽️' : info.complete ? '✅' : info.empty ? '▫️' : '⏳';
      const row = document.createElement('div');
      row.className = 'summary-day';
      row.innerHTML = `
        <div class="sd-name">יום ${DAYS[d]}<br><span class="muted">${shortDate(date)}</span></div>
        <div class="sd-foods">${foods || '<span class="muted">עוד לא נבחר</span>'}</div>
        <div class="sd-status">${status}</div>`;
      body.appendChild(row);
    });
    openModal('#modal-summary');
  });
  $('#btn-print').addEventListener('click', () => window.print());

  $('#btn-clear').addEventListener('click', clearDay);

  function goDay(delta) {
    const next = Math.max(MIN_DAYS, Math.min(MAX_DAYS, daysFromToday(selectedDate) + delta));
    if (next === daysFromToday(selectedDate)) return;
    selectedDate = addDays(today, next);
    closeModals();
    render();
  }
  $('#btn-day-prev').addEventListener('click', () => goDay(-1));
  $('#btn-day-next').addEventListener('click', () => goDay(1));
  // חיצים במקלדת: בעברית שמאל = קדימה בזמן, ימין = אחורה
  document.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    if (document.querySelector('.modal:not(.hidden)')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); goDay(1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); goDay(-1); }
  });

  // ---------- sign-in / sharing ----------
  const gate = $('#gate');
  function showGate(kind, user) {
    gate.classList.remove('hidden');
    $('#gate-signin').classList.toggle('hidden', kind !== 'signed-out');
    $('#gate-denied').classList.toggle('hidden', kind !== 'denied');
    $('#gate-error').classList.toggle('hidden', kind !== 'error');
    $('#gate-email').textContent = user && user.email ? user.email : '';
  }
  function setAccount(user) {
    const btn = $('#btn-user');
    const img = $('#user-photo');
    btn.classList.toggle('hidden', !user);
    if (user) {
      img.src = user.photoURL || '';
      img.alt = user.displayName || user.email || '';
      $('#account-name').textContent = user.displayName || '';
      $('#account-email').textContent = user.email || '';
    }
    $('#account-row').classList.toggle('hidden', !user);
  }
  $('#gate-signin-btn').addEventListener('click', () => Sync.signIn());
  document.querySelectorAll('.btn-signout').forEach(b => b.addEventListener('click', () => Sync.signOut()));
  $('#btn-user').addEventListener('click', () => $('#btn-settings').click());

  Sync.start({
    onData: applyRemote,
    onAuth: (status, user, err) => {
      if (err) console.warn('[sync]', status, err);
      setAccount(user || null);
      if (status === 'local' || status === 'signed-in') gate.classList.add('hidden');
      else showGate(status, user);
      if (status === 'error') toast('בעיה בסנכרון 😕');
    },
  });

  render();
})();
