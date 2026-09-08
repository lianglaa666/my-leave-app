const STORAGE_KEY = 'personal_leave_tracker_v2';

// 依照目前 Python 程式提供的 2026 國定假日／補假日期，原樣保留。
const NATIONAL_HOLIDAYS_2026 = new Set([
  '2026-03-02',
  '2026-04-02',
  '2026-04-03',
  '2026-10-12'
]);

const TYPE_TEXT = {
  ot: '加班（賺取一般補休）',
  holiday_ot: '國定假日出勤（賺取國定假日補休）',
  leave_annual_wd: '請特休－【平日休】（扣特休）',
  leave_annual_we: '請特休－【假日休】（扣特休）',
  leave_comp_wd: '請調補休－【平日休】（扣一般補休）',
  leave_comp_we: '請調補休－【假日休】（扣一般補休）',
  leave_holiday_comp: '請國定假日補休（扣國定假日補休）'
};

const state = loadState();

const $ = (id) => document.getElementById(id);
const els = {
  initAnnual: $('initAnnual'),
  initComp: $('initComp'),
  initHolidayComp: $('initHolidayComp'),
  annualValue: $('annualValue'),
  compValue: $('compValue'),
  holidayCompValue: $('holidayCompValue'),
  totalValue: $('totalValue'),
  wdStat: $('wdStat'),
  weStat: $('weStat'),
  holidayStat: $('holidayStat'),
  recordDate: $('recordDate'),
  recordType: $('recordType'),
  recordHours: $('recordHours'),
  addBtn: $('addBtn'),
  hint: $('hint'),
  recordsList: $('recordsList'),
  emptyState: $('emptyState'),
  recordCount: $('recordCount'),
  exportBtn: $('exportBtn'),
  importFile: $('importFile'),
  clearBtn: $('clearBtn'),
  toast: $('toast')
};

function todayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultState() {
  return {
    init_annual: 74,
    init_comp: 0,
    init_holiday_comp: 0,
    records: []
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const data = JSON.parse(raw);
    return {
      init_annual: Number.isFinite(Number(data.init_annual)) ? Number(data.init_annual) : 74,
      init_comp: Number.isFinite(Number(data.init_comp)) ? Number(data.init_comp) : 0,
      init_holiday_comp: Number.isFinite(Number(data.init_holiday_comp)) ? Number(data.init_holiday_comp) : 0,
      records: Array.isArray(data.records) ? data.records : []
    };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatHoursToDays(totalHours) {
  totalHours = Number(totalHours) || 0;
  if (totalHours < 0) return '0 天 0 小時';
  const days = Math.floor(totalHours / 8);
  const hours = totalHours % 8;
  return `${days} 天 ${hours} 小時`;
}

function signedHours(rec) {
  return (rec.type === 'ot' || rec.type === 'holiday_ot' ? '+' : '-') + `${rec.hours} 小時`;
}

function isWeekend(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  return day === 0 || day === 6;
}

function autoDetectType() {
  const dateStr = els.recordDate.value;
  if (!dateStr) return;
  if (NATIONAL_HOLIDAYS_2026.has(dateStr)) {
    els.recordType.value = 'holiday_ot';
    els.hint.textContent = '此日期在目前程式的 2026 國定假日清單中，已自動帶入「國定假日出勤」。';
  } else if (isWeekend(dateStr)) {
    els.recordType.value = 'leave_annual_we';
    els.hint.textContent = '此日期為週末，已自動帶入「假日休」。';
  } else {
    els.recordType.value = 'leave_annual_wd';
    els.hint.textContent = '此日期為平日，已自動帶入「平日休」。';
  }
}

function updateDashboard() {
  let baseAnnual = Number(els.initAnnual.value) || 0;
  let baseComp = Number(els.initComp.value) || 0;
  let baseHolidayComp = Number(els.initHolidayComp.value) || 0;
  let totalWd = 0;
  let totalWe = 0;
  let totalHolidayUsed = 0;

  for (const rec of state.records) {
    const h = Number(rec.hours) || 0;
    switch (rec.type) {
      case 'ot':
        baseComp += h;
        break;
      case 'holiday_ot':
        baseHolidayComp += h;
        break;
      case 'leave_annual_wd':
        baseAnnual -= h;
        totalWd += h;
        break;
      case 'leave_annual_we':
        baseAnnual -= h;
        totalWe += h;
        break;
      case 'leave_comp_wd':
        baseComp -= h;
        totalWd += h;
        break;
      case 'leave_comp_we':
        baseComp -= h;
        totalWe += h;
        break;
      case 'leave_holiday_comp':
        baseHolidayComp -= h;
        totalHolidayUsed += h;
        break;
    }
  }

  els.annualValue.textContent = formatHoursToDays(baseAnnual);
  els.compValue.textContent = `${baseComp} 小時`;
  els.holidayCompValue.textContent = `${baseHolidayComp} 小時`;
  els.totalValue.textContent = formatHoursToDays(baseAnnual + baseComp + baseHolidayComp);
  els.wdStat.textContent = formatHoursToDays(totalWd);
  els.weStat.textContent = formatHoursToDays(totalWe);
  els.holidayStat.textContent = formatHoursToDays(totalHolidayUsed);
}

function renderRecords() {
  els.recordsList.innerHTML = '';
  els.recordCount.textContent = `${state.records.length} 筆`;
  els.emptyState.style.display = state.records.length ? 'none' : 'block';

  for (const rec of state.records) {
    const card = document.createElement('article');
    card.className = 'record';
    card.innerHTML = `
      <div class="record-top">
        <span class="record-date">${escapeHtml(rec.date)}</span>
        <button class="delete-btn" type="button" data-id="${escapeHtml(rec.id)}">刪除</button>
      </div>
      <div class="record-type">${escapeHtml(rec.type_text || TYPE_TEXT[rec.type] || rec.type)}</div>
      <div class="record-hours">${escapeHtml(signedHours(rec))}</div>
    `;
    card.querySelector('.delete-btn').addEventListener('click', () => deleteRecord(rec.id));
    els.recordsList.appendChild(card);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));
}

function syncSettingsFromInputs() {
  state.init_annual = Math.max(0, Math.trunc(Number(els.initAnnual.value) || 0));
  state.init_comp = Math.max(0, Math.trunc(Number(els.initComp.value) || 0));
  state.init_holiday_comp = Math.max(0, Math.trunc(Number(els.initHolidayComp.value) || 0));
  saveState();
  updateDashboard();
}

function addRecord() {
  const date = els.recordDate.value;
  if (!date) {
    showToast('請先選擇日期');
    return;
  }
  let hours = Math.trunc(Number(els.recordHours.value));
  if (!Number.isFinite(hours) || hours <= 0) hours = 8;
  const type = els.recordType.value;
  const now = Date.now();
  state.records.unshift({
    id: `${now}_${Math.random().toString(36).slice(2, 8)}`,
    date,
    type,
    type_text: TYPE_TEXT[type],
    hours
  });
  saveState();
  updateDashboard();
  renderRecords();
  showToast('已記下一筆並自動儲存');
}

function deleteRecord(id) {
  const target = state.records.find(r => r.id === id);
  if (!target) return;
  if (!confirm(`確定要刪除 ${target.date} 的紀錄嗎？`)) return;
  state.records = state.records.filter(r => r.id !== id);
  saveState();
  updateDashboard();
  renderRecords();
  showToast('紀錄已刪除');
}

function exportJson() {
  syncSettingsFromInputs();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leave_data_${todayString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('備份檔已匯出');
}

function importJson(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const imported = {
        init_annual: Number.isFinite(Number(data.init_annual)) ? Number(data.init_annual) : 74,
        init_comp: Number.isFinite(Number(data.init_comp)) ? Number(data.init_comp) : 0,
        init_holiday_comp: Number.isFinite(Number(data.init_holiday_comp)) ? Number(data.init_holiday_comp) : 0,
        records: Array.isArray(data.records) ? data.records.map(normalizeRecord).filter(Boolean) : []
      };
      if (!confirm(`確定匯入 ${imported.records.length} 筆紀錄並取代目前資料嗎？`)) return;
      Object.assign(state, imported);
      els.initAnnual.value = state.init_annual;
      els.initComp.value = state.init_comp;
      els.initHolidayComp.value = state.init_holiday_comp;
      saveState();
      updateDashboard();
      renderRecords();
      showToast('資料匯入成功');
    } catch {
      alert('這不是有效的 leave_data.json／JSON 備份檔。');
    } finally {
      els.importFile.value = '';
    }
  };
  reader.readAsText(file, 'utf-8');
}

function normalizeRecord(rec) {
  if (!rec || !rec.type || !rec.date) return null;
  return {
    id: String(rec.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    date: String(rec.date),
    type: String(rec.type),
    type_text: String(rec.type_text || TYPE_TEXT[rec.type] || rec.type),
    hours: Math.max(1, Math.trunc(Number(rec.hours) || 8))
  };
}

function clearAll() {
  if (!confirm('確定要清除所有紀錄與目前額度設定嗎？此動作無法復原。')) return;
  Object.assign(state, defaultState());
  els.initAnnual.value = state.init_annual;
  els.initComp.value = state.init_comp;
  els.initHolidayComp.value = state.init_holiday_comp;
  saveState();
  updateDashboard();
  renderRecords();
  showToast('資料已清除');
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add('show');
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1800);
}

function init() {
  els.initAnnual.value = state.init_annual;
  els.initComp.value = state.init_comp;
  els.initHolidayComp.value = state.init_holiday_comp;
  els.recordDate.value = todayString();
  autoDetectType();
  updateDashboard();
  renderRecords();

  [els.initAnnual, els.initComp, els.initHolidayComp].forEach(el => {
    el.addEventListener('input', syncSettingsFromInputs);
  });
  els.recordDate.addEventListener('change', autoDetectType);
  els.addBtn.addEventListener('click', addRecord);
  els.exportBtn.addEventListener('click', exportJson);
  els.importFile.addEventListener('change', e => importJson(e.target.files[0]));
  els.clearBtn.addEventListener('click', clearAll);
}

init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
