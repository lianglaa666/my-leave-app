const STORAGE_KEY = 'personal_leave_tracker_v4';

// 修正後的 2026 年完整國定假日與補休日清單
const NATIONAL_HOLIDAYS_2026 = new Set([
  '2026-01-01', // 元旦
  '2026-02-16', // 農曆春節彈性放假
  '2026-02-17', // 除夕
  '2026-02-18', // 春節初一
  '2026-02-19', // 春節初二
  '2026-02-20', // 春節初三
  '2026-02-27', // 228 和平紀念日（補假）
  '2026-04-03', // 兒童節（補假）
  '2026-04-06', // 清明節（補假）
  '2026-05-01', // 勞動節
  '2026-06-19', // 端午節
  '2026-09-25', // 中秋節
  '2026-09-28', // 教師節
  '2026-10-09', // 國慶日（補假）
  '2026-10-26', // 臺灣光復節（補假）
  '2026-12-25'  // 行憲紀念日
]);

const TYPE_TEXT = {
  ot_wd:'平日加班（+平日補休）',
  ot_we:'假日加班（+假日補休）',
  holiday_ot:'國定假日出勤（+國定假日補休）',
  leave_annual_wd:'請特休－平日（-特休）',
  leave_annual_we:'請特休－假日（-特休）',
  leave_comp_wd:'請平日補休（-平日補休）',
  leave_comp_we:'請假日補休（-假日補休）',
  leave_holiday_comp:'請國定假日補休（-國定補休）'
};

const TYPE_SHORT = {
  ot_wd:'平日加班補休',
  ot_we:'假日加班補休',
  holiday_ot:'國定假日補休',
  leave_annual_wd:'平日特休',
  leave_annual_we:'假日特休',
  leave_comp_wd:'使用平日補休',
  leave_comp_we:'使用假日補休',
  leave_holiday_comp:'使用國定補休'
};

const $ = id => document.getElementById(id);

const els = {
  initAnnual:$('initAnnual'),
  initCompWd:$('initCompWd'),
  initCompWe:$('initCompWe'),
  initHolidayComp:$('initHolidayComp'),
  annualValue:$('annualValue'),
  compWdValue:$('compWdValue'),
  compWeValue:$('compWeValue'),
  holidayCompValue:$('holidayCompValue'),
  totalValue:$('totalValue'),
  wdStat:$('wdStat'),
  weStat:$('weStat'),
  holidayStat:$('holidayStat'),
  recordDate:$('recordDate'),
  recordType:$('recordType'),
  recordHours:$('recordHours'),
  addBtn:$('addBtn'),
  hint:$('hint'),
  recordsList:$('recordsList'),
  emptyState:$('emptyState'),
  recordCount:$('recordCount'),
  exportBtn:$('exportBtn'),
  importFile:$('importFile'),
  clearBtn:$('clearBtn'),
  toast:$('toast'),
  rosterDate:$('rosterDate'),
  addRosterBtn:$('addRosterBtn'),
  rosterList:$('rosterList'),
  rosterEmpty:$('rosterEmpty'),
  rosterCount:$('rosterCount')
};

function todayString(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function halfHour(v, fallback=8){
  const n = Number(v);
  if(!Number.isFinite(n) || n <= 0) return fallback;
  return Math.round(n * 2) / 2;
}

function nonNegative(v){
  const n = Number(v);
  if(!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 2) / 2;
}

function num(n){
  const x = Math.round((Number(n)||0) * 10) / 10;
  return Number.isInteger(x) ? String(x) : x.toFixed(1);
}

function formatHours(h){
  return `${num(h)} 小時`;
}

function formatHoursToDays(h){
  const x = Math.max(0, Math.round((Number(h)||0) * 2) / 2);
  const d = Math.floor(x / 8);
  const r = x - d * 8;
  return `${d} 天 ${num(r)} 小時`;
}

function defaultState(){
  return {
    init_annual:74,
    init_comp_wd:0,
    init_comp_we:0,
    init_holiday_comp:0,
    roster_dates:[],
    records:[]
  };
}

function isWeekend(dateStr){
  const d = new Date(`${dateStr}T00:00:00`);
  return [0,6].includes(d.getDay());
}

function isRosterOff(dateStr){
  return Array.isArray(state.roster_dates) && state.roster_dates.includes(dateStr);
}

function normalizeRosterDates(arr){
  if(!Array.isArray(arr)) return [];
  return [...new Set(arr.map(String).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)))].sort();
}

function normalizeRecord(rec){
  if(!rec || !rec.type || !rec.date) return null;
  let type = String(rec.type);
  if(type === 'ot'){
    type = isRosterOff(rec.date) || isWeekend(rec.date) ? 'ot_we' : 'ot_wd';
  }
  return {
    id:String(rec.id || `${Date.now()}_${Math.random().toString(36).slice(2,8)}`),
    date:String(rec.date),
    type,
    type_text:TYPE_TEXT[type] || String(rec.type_text || type),
    hours:halfHour(rec.hours)
  };
}

function migrate(data){
  const oldComp = Number(data?.init_comp);
  const oldRoster = Array.isArray(data?.roster_dates) ? data.roster_dates : [];
  return {
    init_annual:nonNegative(data?.init_annual ?? 74),
    init_comp_wd:nonNegative(data?.init_comp_wd ?? (Number.isFinite(oldComp) ? oldComp : 0)),
    init_comp_we:nonNegative(data?.init_comp_we ?? 0),
    init_holiday_comp:nonNegative(data?.init_holiday_comp ?? 0),
    roster_dates:normalizeRosterDates(oldRoster),
    records:Array.isArray(data?.records) ? data.records.map(normalizeRecord).filter(Boolean) : []
  };
}

function loadState(){
  try{
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem('personal_leave_tracker_v3') ||
      localStorage.getItem('personal_leave_tracker_v2');
    return raw ? migrate(JSON.parse(raw)) : defaultState();
  }catch{
    return defaultState();
  }
}

const state = loadState();

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function autoDetectType(){
  const d = els.recordDate.value;
  if(!d) return;

  if(NATIONAL_HOLIDAYS_2026.has(d)){
    els.recordType.value = 'holiday_ot';
    els.hint.textContent = '此日期為國定假日，可記錄國定假日出勤。';
  }else if(isRosterOff(d)){
    els.recordType.value = 'leave_annual_we';
    els.hint.textContent = '此日期是你設定的「排休假日」，系統會視為假日。';
  }else if(isWeekend(d)){
    els.recordType.value = 'leave_annual_we';
    els.hint.textContent = '此日期為週末，可改選「假日加班」或「假日補休」。';
  }else{
    els.recordType.value = 'leave_annual_wd';
    els.hint.textContent = '此日期為平日，可改選「平日加班」或「平日補休」。';
  }
}

function getBalances(){
  let annual=nonNegative(els.initAnnual.value);
  let compWd=nonNegative(els.initCompWd.value);
  let compWe=nonNegative(els.initCompWe.value);
  let holidayComp=nonNegative(els.initHolidayComp.value);
  let totalWd=0,totalWe=0,totalHolidayUsed=0;

  for(const rec of state.records){
    const h=halfHour(rec.hours);

    switch(rec.type){
      case 'ot_wd': compWd += h; break;
      case 'ot_we': compWe += h; break;
      case 'holiday_ot': holidayComp += h; break;
      case 'leave_annual_wd': annual -= h; totalWd += h; break;
      case 'leave_annual_we': annual -= h; totalWe += h; break;
      case 'leave_comp_wd': compWd -= h; totalWd += h; break;
      case 'leave_comp_we': compWe -= h; totalWe += h; break;
      case 'leave_holiday_comp': holidayComp -= h; totalHolidayUsed += h; break;
    }
  }

  return {
    annual:Math.max(0,annual),
    compWd:Math.max(0,compWd),
    compWe:Math.max(0,compWe),
    holidayComp:Math.max(0,holidayComp),
    totalWd,
    totalWe,
    totalHolidayUsed
  };
}

function updateDashboard(){
  const b=getBalances();

  els.annualValue.textContent=formatHoursToDays(b.annual);
  els.compWdValue.textContent=formatHours(b.compWd);
  els.compWeValue.textContent=formatHours(b.compWe);
  els.holidayCompValue.textContent=formatHours(b.holidayComp);
  els.totalValue.textContent=formatHoursToDays(b.annual+b.compWd+b.compWe+b.holidayComp);
  els.wdStat.textContent=formatHoursToDays(b.totalWd);
  els.weStat.textContent=formatHoursToDays(b.totalWe);
  els.holidayStat.textContent=formatHoursToDays(b.totalHolidayUsed);
}

function signed(rec){
  return `${['ot_wd','ot_we','holiday_ot'].includes(rec.type)?'+':'-'}${num(rec.hours)} 小時`;
}

function displayDate(d){
  const p=String(d).split('-');
  return p.length===3 ? `${p[1]}/${p[2]}` : d;
}

function escapeHtml(v){
  return String(v).replace(/[&<>'"]/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[ch]));
}

function renderRoster(){
  els.rosterList.innerHTML='';
  const dates = normalizeRosterDates(state.roster_dates);
  state.roster_dates = dates;
  els.rosterCount.textContent=`${dates.length} 天`;
  els.rosterEmpty.style.display=dates.length ? 'none' : 'block';

  for(const date of dates){
    const row=document.createElement('div');
    row.className='roster-row';
    row.innerHTML=`
      <span>${escapeHtml(date)}</span>
      <button type="button" class="roster-delete" aria-label="刪除排休 ${escapeHtml(date)}">刪除</button>
    `;
    row.querySelector('.roster-delete').addEventListener('click',()=>deleteRosterDate(date));
    els.rosterList.appendChild(row);
  }
}

function addRosterDate(){
  const date=els.rosterDate.value;
  if(!date){
    showToast('請先選擇排休日期');
    return;
  }

  if(NATIONAL_HOLIDAYS_2026.has(date)){
    showToast('這天是國定假日，可不用另外加入排休');
    return;
  }

  if(state.roster_dates.includes(date)){
    showToast('這個日期已經加入排休');
    return;
  }

  state.roster_dates.push(date);
  state.roster_dates=normalizeRosterDates(state.roster_dates);
  saveState();
  renderRoster();
  renderCalendar();
  autoDetectType();
  showToast('排休日期已加入');
}

function deleteRosterDate(date){
  if(!confirm(`確定刪除 ${date} 的排休設定嗎？`)) return;
  state.roster_dates=state.roster_dates.filter(d=>d!==date);
  saveState();
  renderRoster();
  renderCalendar();
  autoDetectType();
  showToast('排休日期已刪除');
}

function renderRecords(){
  els.recordsList.innerHTML='';
  els.recordCount.textContent=`${state.records.length} 筆`;
  els.emptyState.style.display=state.records.length ? 'none' : 'block';

  for(const rec of state.records){
    const row=document.createElement('article');
    row.className='record';
    const positive=['ot_wd','ot_we','holiday_ot'].includes(rec.type);

    row.innerHTML=`
      <div class="record-main">
        <div class="record-date">${escapeHtml(displayDate(rec.date))}</div>
        <div class="record-type">${escapeHtml(TYPE_SHORT[rec.type]||rec.type_text||rec.type)}</div>
        <div class="record-hours ${positive?'positive':'negative'}">${escapeHtml(signed(rec))}</div>
        <button class="delete-btn" type="button" aria-label="刪除紀錄">×</button>
      </div>`;

    row.querySelector('.delete-btn').addEventListener('click',()=>deleteRecord(rec.id));
    els.recordsList.appendChild(row);
  }
}

let calendarCursor = new Date();
calendarCursor.setDate(1);

function dateToISO(year, monthIndex, day){
  return `${year}-${String(monthIndex+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function renderCalendar(){
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();

  $('calendarMonthLabel').textContent = `${year}/${String(month+1).padStart(2,'0')}`;
  const grid = $('calendarGrid');
  grid.innerHTML = '';

  for(let i=0;i<firstDay;i++){
    const empty=document.createElement('div');
    empty.className='calendar-cell empty';
    grid.appendChild(empty);
  }

  const today=todayString();

  for(let day=1;day<=lastDate;day++){
    const date=dateToISO(year,month,day);
    const cell=document.createElement('button');
    cell.type='button';
    cell.className='calendar-cell';

    const roster=isRosterOff(date);
    const holiday=NATIONAL_HOLIDAYS_2026.has(date);

    if(roster) cell.classList.add('roster');
    if(holiday) cell.classList.add('holiday');
    if(date===today) cell.classList.add('today');

    cell.innerHTML=`<span class="day-number">${day}</span>`;

    const label = holiday
      ? (roster ? `${date} 國定假日＋我的排休` : `${date} 國定假日`)
      : (roster ? `${date} 我的排休，點擊取消` : `${date} 點擊加入排休`);
    cell.setAttribute('aria-label',label);
    cell.title=label;

    cell.addEventListener('click',()=>{
      cell.classList.add('selected-flash');
      setTimeout(()=>cell.classList.remove('selected-flash'),120);
      toggleRosterDate(date);
    });

    grid.appendChild(cell);
  }
}

function toggleRosterDate(date){
  const idx=state.roster_dates.indexOf(date);

  if(idx>=0){
    state.roster_dates.splice(idx,1);
    showToast(`${date} 已取消排休`);
  }else{
    if(NATIONAL_HOLIDAYS_2026.has(date)){
      showToast('國定假日不需另外加入排休');
      return;
    }
    state.roster_dates.push(date);
    showToast(`${date} 已加入排休`);
  }

  state.roster_dates=normalizeRosterDates(state.roster_dates);
  saveState();
  renderCalendar();
  renderRoster();
  autoDetectType();
}

function moveCalendarMonth(delta){
  calendarCursor.setMonth(calendarCursor.getMonth()+delta);
  renderCalendar();
}

function goCalendarToday(){
  const d=new Date();
  calendarCursor=new Date(d.getFullYear(),d.getMonth(),1);
  renderCalendar();
}

function syncSettings(){
  state.init_annual=nonNegative(els.initAnnual.value);
  state.init_comp_wd=nonNegative(els.initCompWd.value);
  state.init_comp_we=nonNegative(els.initCompWe.value);
  state.init_holiday_comp=nonNegative(els.initHolidayComp.value);
  saveState();
  updateDashboard();
}

function addRecord(){
  const date=els.recordDate.value;
  if(!date){
    showToast('請先選擇日期');
    return;
  }

  const hours=halfHour(els.recordHours.value,0);
  if(hours<=0){
    showToast('時數至少 0.5 小時');
    return;
  }

  const type=els.recordType.value;

  state.records.unshift({
    id:`${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    date,
    type,
    type_text:TYPE_TEXT[type],
    hours
  });

  saveState();
  updateDashboard();
  renderRecords();
  showToast('已記下一筆並自動儲存');
}

function deleteRecord(id){
  const target=state.records.find(r=>r.id===id);
  if(!target) return;

  if(!confirm(`確定刪除 ${displayDate(target.date)} ${TYPE_SHORT[target.type]||''} ${num(target.hours)} 小時？`)) return;

  state.records=state.records.filter(r=>r.id!==id);
  saveState();
  updateDashboard();
  renderRecords();
  showToast('紀錄已刪除');
}

function exportJson(){
  syncSettings();

  const blob=new Blob([JSON.stringify(state,null,2)],{
    type:'application/json;charset=utf-8'
  });

  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`leave_data_${todayString()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('備份檔已匯出');
}

function importJson(file){
  if(!file) return;

  const reader=new FileReader();

  reader.onload=()=>{
    try{
      const imported=migrate(JSON.parse(reader.result));

      if(!confirm(`確定匯入 ${imported.records.length} 筆紀錄與 ${imported.roster_dates.length} 天排休設定，並取代目前資料嗎？`)) return;

      Object.assign(state,imported);

      els.initAnnual.value=state.init_annual;
      els.initCompWd.value=state.init_comp_wd;
      els.initCompWe.value=state.init_comp_we;
      els.initHolidayComp.value=state.init_holiday_comp;

      saveState();
      renderRoster();
      renderCalendar();
      updateDashboard();
      renderRecords();
      autoDetectType();
      showToast('資料匯入成功');
    }catch{
      alert('這不是有效的 JSON 備份檔。');
    }finally{
      els.importFile.value='';
    }
  };

  reader.readAsText(file,'utf-8');
}

function clearAll(){
  if(!confirm('確定要清除所有紀錄、額度設定與排休假日嗎？此動作無法復原。')) return;

  Object.assign(state,defaultState());

  els.initAnnual.value=state.init_annual;
  els.initCompWd.value=0;
  els.initCompWe.value=0;
  els.initHolidayComp.value=0;

  saveState();
  renderRoster();
  renderCalendar();
  updateDashboard();
  renderRecords();
  autoDetectType();
  showToast('資料已清除');
}

let toastTimer;
function showToast(m){
  clearTimeout(toastTimer);
  els.toast.textContent=m;
  els.toast.classList.add('show');
  toastTimer=setTimeout(()=>els.toast.classList.remove('show'),1800);
}

function init(){
  els.initAnnual.value=state.init_annual;
  els.initCompWd.value=state.init_comp_wd;
  els.initCompWe.value=state.init_comp_we;
  els.initHolidayComp.value=state.init_holiday_comp;
  els.recordDate.value=todayString();
  els.rosterDate.value=todayString();

  renderRoster();
  renderCalendar();
  autoDetectType();
  updateDashboard();
  renderRecords();

  [els.initAnnual,els.initCompWd,els.initCompWe,els.initHolidayComp].forEach(el=>{
    el.addEventListener('input',syncSettings);
    el.addEventListener('blur',()=>{
      el.value=nonNegative(el.value);
      syncSettings();
    });
  });

  els.recordDate.addEventListener('change',autoDetectType);
  els.addBtn.addEventListener('click',addRecord);
  els.addRosterBtn.addEventListener('click',addRosterDate);
  $('prevMonthBtn').addEventListener('click',()=>moveCalendarMonth(-1));
  $('nextMonthBtn').addEventListener('click',()=>moveCalendarMonth(1));
  $('todayMonthBtn').addEventListener('click',goCalendarToday);
  els.exportBtn.addEventListener('click',exportJson);
  els.importFile.addEventListener('change',e=>importJson(e.target.files[0]));
  els.clearBtn.addEventListener('click',clearAll);
}

init();

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  });
}