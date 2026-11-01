import {dayKey, addDays, milestones, shuffle, assignBatch, completedToday, dailyProgress, isDue, freshLibrary, createWord, learnWord, reviewWord, validateLibrary} from './core.js';

const $ = s => document.querySelector(s);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY = 'shici.web.library.v1';
let library = freshLibrary(), readOnly = false, rawLoaded = null;
let tab = ['today','library','plan'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';
let filter = 'all', query = '', editID = null, session = null, lastToday = dayKey();
let toastTimer;

function load() {
  try {
    rawLoaded = localStorage.getItem(KEY);
    library = rawLoaded ? validateLibrary(JSON.parse(rawLoaded)) : freshLibrary();
    readOnly = false;
    $('#storage-error').hidden = true;
  } catch {
    readOnly = true;
    $('#storage-error').textContent = '无法读取本机词库，已停止修改以保护数据。请到“计划”导出原始备份，或恢复有效备份。';
    $('#storage-error').hidden = false;
  }
}
function commit(next, restoring = false) {
  if (readOnly && !restoring) throw Error('请先恢复有效备份，再修改词库。');
  const current = localStorage.getItem(KEY);
  if (current !== rawLoaded) { load(); render(); throw Error('词库在另一个窗口发生了变化，已刷新，请重试。'); }
  next = validateLibrary(next);
  next.revision = library.revision + 1;
  const raw = JSON.stringify(next);
  try { localStorage.setItem(KEY, raw); }
  catch { throw Error('保存失败：设备存储空间不足，或浏览器限制了存储。请先导出备份。'); }
  library = next; rawLoaded = raw; readOnly = false;
  $('#storage-error').hidden = true;
}
function transaction(action) {
  const next = structuredClone(library);
  action(next);
  commit(next);
}
function toast(message) {
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false;
  toastTimer = setTimeout(() => $('#toast').hidden = true, 4000);
}
const dueWords = () => library.words.filter(w => isDue(w)).sort((a,b) => a.due.localeCompare(b.due));
const newWords = () => library.words.filter(w => w.learned === null);
const formatDay = day => `${Number(day.slice(5,7))}月${Number(day.slice(8,10))}日`;
const countReviewed = () => completedToday(library).length;
function render() {
  document.querySelectorAll('[data-tab]').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
    el.setAttribute('aria-current', el.dataset.tab === tab ? 'page' : 'false');
  });
  $('#main').innerHTML = tab === 'today' ? todayPage() : tab === 'library' ? libraryPage() : planPage();
  if (tab === 'library') $('#search').value = query;
}
function todayPage() {
  const due = dueWords(), fresh = newWords(), today = dayKey();
  const progress = dailyProgress(library);
  const overdue = due.filter(w => w.due < today).length;
  const date = new Date().toLocaleDateString('zh-CN', {month:'long',day:'numeric',weekday:'long'});
  return `<div class="page-heading"><div><div class="eyebrow">A LITTLE, EVERY DAY</div><h1>每天一点，记得更久。</h1></div></div>
    <div class="date" style="margin:-9px 0 19px">${date}</div>
    <section class="hero" aria-label="今日复习">
      <div class="eyebrow">TODAY'S REVIEW · 今日复盘</div>
      <h2>${library.words.length ? '昨天的努力，<br>今天再记牢一点。' : '从一个单词开始，<br>慢慢积累你的词库。'}</h2>
      <div class="count-row"><strong class="hero-count">${due.length}</strong><span>个单词待复习</span></div>
      <p class="hero-foot">${overdue ? `含 ${overdue} 个逾期单词，今天一起复盘` : due.length ? '先回想，再翻开答案，不着急。' : library.words.some(w=>w.due) ? '今天没有到期单词，下一次复盘已安排。' : '今天学过，明天会在这里遇见。'}</p>
      <button class="button lime full" data-action="${due.length ? 'review' : !progress.remaining ? 'plan' : fresh.length ? 'learn' : 'add'}">${due.length ? '开始今日复习' : !progress.remaining ? '新词目标已完成 · 查看计划' : fresh.length ? '开始学习新词' : '录入我的单词'}<span class="arrow">→</span></button>
    </section>
    <div class="stats"><div class="stat"><strong>${countReviewed()}</strong><span>今天已背过</span></div><div class="stat"><strong>${fresh.length}</strong><span>待学新词</span></div><div class="stat"><strong>${library.words.filter(w=>w.stage===6).length}</strong><span>本轮已完成</span></div></div>
    ${completedTodaySection()}
    <section class="daily-card" aria-label="每日新词目标"><div class="section-head"><h2>今日已选新词 <span class="daily-count">${progress.learned} / ${progress.goal}</span></h2><button class="text-button" data-action="plan">调整数量 →</button></div><progress value="${Math.min(progress.learned,progress.goal)}" max="${progress.goal}" aria-label="今日新词分组进度"></progress><p class="footnote">${!progress.remaining ? '今日新词已分组，未通过的词仍需在今日复盘中完成。想多学一点，可以调高目标。' : `还需学习 ${progress.remaining} 个新词${fresh.length < progress.remaining ? `，词库还有 ${fresh.length} 个待学，可继续录入。` : '，每学完一个都会保存进度。'}`}</p></section>
    <div class="learn-card"><div class="learn-icon">＋</div><div class="learn-copy"><strong>${!progress.remaining ? '今天的新词，已选定' : '给词库添一点新鲜感'}</strong><p>${!progress.remaining ? '未通过的词请在今日复盘中继续' : fresh.length ? `本次学习 ${progress.nextCount} 个 · 词库待学 ${fresh.length} 个` : '自己录入，建立专属四六级单词本'}</p></div><button class="button secondary" data-action="${!progress.remaining ? 'plan' : fresh.length ? 'learn' : 'add'}">${!progress.remaining ? '调整' : fresh.length ? '去学习' : '录入'}</button></div>
    <div class="section-head"><h2>未来 7 天</h2><span>当前已安排的任务</span></div>
    <div class="week">${Array.from({length:7},(_,i)=>{const d=addDays(today,i); const count=library.words.filter(w=>i===0 ? isDue(w,today) : w.due===d).length;return `<div class="day"><span>${i===0?'今天':['日','一','二','三','四','五','六'][new Date(d+'T12:00:00').getDay()]}</span><strong>${Number(d.slice(-2))}</strong><small>${count ? count+' 词' : '—'}</small></div>`;}).join('')}</div>
    <p class="footnote">复习会随每次回答更新。没背过的词当天继续复盘，通过后才安排下次复习。</p>
    <button class="install-banner" data-action="install"><span>↗ &nbsp; 添加到 iPhone 主屏幕，随时拾起一个词</span><span>→</span></button>`;
}
function completedTodaySection() {
  const words = completedToday(library);
  return `<section class="plan-card" aria-label="今天背过的单词"><details><summary style="cursor:pointer;padding:8px 0;font-weight:700">今天背过的单词 · ${words.length} 个 <span class="muted">（点击展开）</span></summary><p class="footnote">今天点过“背过了”的新词和复习词，每个词只列一次，最近完成的排在前面。查看不会改变复习计划。</p>${words.length ? `<div style="max-height:420px;overflow-y:auto">${words.map(w=>`<article class="word-row"><div class="word-info"><h3>${esc(w.spelling)}</h3><p>${esc(w.meaning)}</p>${w.example?`<p class="example">${esc(w.example)}</p>`:''}<div class="word-meta">CET-${w.level} · ${w.due?`${formatDay(w.due)}复习`:'本轮已完成 ✓'}</div></div></article>`).join('')}</div>` : '<p class="muted">今天还没有背过的单词。学习或复盘时点“背过了”，就会出现在这里。</p>'}</details></section>`;
}
function libraryPage() {
  return `<div class="page-heading"><div><div class="eyebrow">YOUR WORD COLLECTION</div><h1>我的词库 <span class="muted">${library.words.length}</span></h1></div><button class="button primary" data-action="add">＋ 录入</button></div>
    <input class="search" id="search" type="search" placeholder="搜索英文单词或中文释义" aria-label="搜索单词" autocomplete="off">
    <div class="filters" aria-label="筛选词库">${[['all','全部'],['4','四级 CET-4'],['6','六级 CET-6']].map(([v,n])=>`<button class="chip ${filter===v?'active':''}" data-filter="${v}" aria-pressed="${filter===v}">${n}</button>`).join('')}</div><div id="word-list">${wordRows()}</div>`;
}
function wordRows() {
  const words = library.words.filter(w => (filter === 'all' || w.level === filter) && (!query || (w.spelling+' '+w.meaning).toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>b.created.localeCompare(a.created));
  if (!words.length) return `<div class="empty"><div class="empty-symbol">Aa</div><h2>${library.words.length ? '没有找到匹配的单词' : '你的词库，从这里开始'}</h2><p>${library.words.length ? '换个关键词或词库试试。' : '录入一个想记住的词，剩下的交给复习计划。'}</p><button class="button secondary" data-action="add">录入单词</button></div>`;
  return words.map(w=>`<article class="word-row"><div class="word-info"><h3>${esc(w.spelling)}</h3><p>${esc(w.meaning)}</p><div class="word-meta">CET-${w.level} · ${w.learned===null?'未学习':w.stage===6?'本轮完成 ✓':isDue(w)?`待复习 · ${w.stage}/6 轮`:`${formatDay(w.due)}复习 · ${w.stage}/6 轮`}</div></div><div class="word-actions"><button data-edit="${esc(w.id)}" aria-label="编辑 ${esc(w.spelling)}">编辑</button><button class="delete" data-delete="${esc(w.id)}" aria-label="删除 ${esc(w.spelling)}">删除</button></div></article>`).join('');
}
function planPage() {
  return `<div class="page-heading"><div><div class="eyebrow">SMALL STEPS, LASTING MEMORY</div><h1>让记忆，有迹可循。</h1></div></div>
    <section class="plan-card"><h2>每天背多少个新词？</h2><p>选择适合你的数量，今天就开始生效。开始学习时选定当天一组，未背过的保留在今日复盘中；已选单词计入今日目标，到期复习不受新词数量限制。</p><div class="goal-options" aria-label="常用每日数量">${[5,10,20,30,50,100].map(n=>`<button class="chip ${library.dailyGoal===n?'active':''}" data-goal="${n}" aria-pressed="${library.dailyGoal===n}">${n} 个</button>`).join('')}</div><form id="goal-form"><label for="daily-goal">自定义每日新词数量（1–500）</label><div class="goal-input-row"><input id="daily-goal" name="dailyGoal" type="number" min="1" max="500" step="1" inputmode="numeric" required value="${library.dailyGoal}"><button type="submit" class="button primary">保存目标</button></div><p class="form-error" role="alert"></p></form><p class="footnote">当前目标：每天 ${library.dailyGoal} 个；今天已选 ${dailyProgress(library).learned} 个。设置会保存在本机，并包含在备份中。</p></section>
    <section class="plan-card"><div class="eyebrow">SPACED REPETITION</div><h2 style="margin-top:8px">你的 6 轮复习计划</h2><div class="milestones">${milestones.map(d=>`<span><b>${d+1}</b>第 ${d+1} 天</span>`).join('')}</div><p>以每组首次学习当天为第 1 天；第 2、4、7、15、30、60 天复盘。每组独立计算，顺序随机；每天的新词数量不限制到期复习数量。</p><ul><li>背过了：当天通过，按本组首次学习日期安排下一轮。</li><li>没背过：当天继续随机复盘，直到选择“背过了”。</li><li>逾期了：保留补背；通过后安排本组下一个未来日期，不在同一天补做多个历史轮次。</li></ul><p class="note">这是参考遗忘规律的固定间隔复习方案，并非适用于所有人的精确曲线。完成 6 轮不代表永久记住。</p></section>
    <section class="plan-card"><h2>安心保存你的积累</h2><p>单词和进度只保存在当前设备、当前浏览器中，不会自动同步。清理网站数据可能丢失记录，请定期备份。</p><div class="settings-row"><div><strong>导出备份</strong><small>单词、学习进度和复习记录</small></div><button class="button secondary" data-action="export">导出</button></div><div class="settings-row"><div><strong>恢复备份</strong><small>用 JSON 备份替换当前数据</small></div><button class="button secondary" data-action="import">恢复</button></div></section>
    <section class="plan-card"><h2>把复盘变成一个小习惯</h2><p>这一版打开时会自动列出到期单词，暂不发送后台通知。建议在 iPhone“提醒事项”中设置每天固定时间提醒：“打开拾词，复习今天的单词”。</p><button class="text-button" data-action="install">查看添加到主屏幕的方法 ↗</button></section>
    <p class="footnote" style="text-align:center">拾词 · CET 4 / 6<br>今天学一点，明天再见面。</p>`;
}
function openEditor(id = null) {
  editID = id;
  const form = $('#word-form'); form.reset(); form.querySelector('.form-error').textContent = '';
  $('#editor-title').textContent = id ? '编辑单词' : '录入一个新词';
  const word = library.words.find(w=>w.id===id);
  if (word) for (const key of ['spelling','meaning','level','example']) form.elements[key].value = word[key];
  $('#editor').showModal();
}
function confirmAction(title, message, label, action) {
  $('#confirm-title').textContent = title; $('#confirm-message').textContent = message;
  $('#confirm-yes').textContent = label;
  $('#confirm-yes').onclick = () => {
    try { action(); $('#confirm').close(); }
    catch(error) { $('#confirm').close(); toast(error.message); }
  };
  $('#confirm').showModal();
}
function startSession(learning) {
  const remaining = dailyProgress(library).remaining;
  if (learning && remaining === 0) { toast('今日新词已分组，可在“计划”调高数量'); return; }
  if (learning) transaction(next => assignBatch(next));
  const words = shuffle(learning ? library.words.filter(w => w.learned === dayKey() && isDue(w)) : dueWords());
  render();
  if (!words.length) { toast(learning ? '先录入一个新词吧' : '今天没有待复习单词'); return; }
  session = {ids:words.map(w=>w.id),position:0,revealed:false,learning,day:dayKey()};
  $('#review-title').textContent = learning ? '学习新词' : '今日复盘';
  renderReview(); $('#review').showModal();
}
function renderReview() {
  if (!session) return;
  const {ids,position,learning,revealed} = session;
  const word = library.words.find(w=>w.id===ids[position]);
  if (!word) {
    $('#review-content').innerHTML = `<div class="flashcard"><div class="done-icon">✓</div><h3 style="font-family:inherit;font-size:25px">这一组完成了</h3><p class="muted">${learning ? '学习进度已保存，明天记得回来复盘。' : '每一次回想，都让记忆更清晰。'}</p></div><button class="button primary full" data-close>回到今日</button>`;
    return;
  }
  $('#review-content').innerHTML = `<div class="progress"><span style="width:${position/ids.length*100}%"></span></div><div class="review-meta"><span>${learning?'本组新词 · 先回想再看答案':'今日复盘 · 随机顺序'}</span><span>${position+1} / ${ids.length}</span></div><div class="flashcard"><span class="level">CET-${word.level}</span><h3>${esc(word.spelling)}</h3>${revealed ? `<div class="meaning">${esc(word.meaning)}</div>${word.example?`<p class="example">${esc(word.example)}</p>`:''}` : '<p class="prompt">这个词的意思，你还记得吗？</p>'}</div>${revealed ? '<div class="button-row"><button class="button secondary" data-answer="forgot">没背过 · 今天再背</button><button class="button primary" data-answer="remembered">背过了 ✓</button></div><p class="footnote">没背过的留在本轮随机复盘；背过的今天不再出现。</p>' : '<button class="button primary full" data-answer="reveal">翻开答案</button>'}`;
}
function answer(kind) {
  if (!session || session.day !== dayKey()) { $('#review').close(); session=null; render(); toast('日期已变化，请重新开始今日复盘'); return; }
  if (kind === 'reveal') { session.revealed = true; renderReview(); return; }
  const id = session.ids[session.position], today = dayKey();
  transaction(next => {
    const index = next.words.findIndex(w=>w.id===id);
    if (index < 0) throw Error('该单词已删除，请重新开始');
    next.words[index] = reviewWord(next.words[index], kind==='remembered', today);
    next.events.push({wordID:id,day:today,remembered:kind==='remembered'});
  });
  if (kind === 'forgot') {
    const rest = shuffle(session.ids.slice(session.position + 1));
    const at = rest.length ? 1 + Math.floor(Math.random() * rest.length) : 0;
    rest.splice(at, 0, id);
    session.ids = [...session.ids.slice(0, session.position + 1), ...rest];
  }
  session.position++; session.revealed = false; renderReview(); render();
}
function exportBackup() {
  const data = readOnly && rawLoaded ? rawLoaded : JSON.stringify(library,null,2);
  const blob = new Blob([data],{type:'application/json'}), url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href=url; link.download=`拾词备份-${dayKey()}.json`; document.body.append(link); link.click(); link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000); toast('已发起导出，请保存到“文件”中');
}

document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  try {
    if (button.hasAttribute('data-close')) { button.closest('dialog')?.close(); return; }
    if (button.dataset.tab) { tab=button.dataset.tab; history.replaceState(null,'','#'+tab); render(); window.scrollTo(0,0); }
    if (button.dataset.filter) { filter=button.dataset.filter; render(); }
    if (button.dataset.edit) openEditor(button.dataset.edit);
    if (button.dataset.delete) {
      const word=library.words.find(w=>w.id===button.dataset.delete);
      confirmAction('删除这个单词？',`“${word.spelling}”及其学习进度将被删除。`,'删除',()=>{
        transaction(next=>{next.words=next.words.filter(w=>w.id!==word.id);next.events=next.events.filter(e=>e.wordID!==word.id);}); render(); toast('单词已删除');
      });
    }
    if (button.dataset.answer) answer(button.dataset.answer);
    if (button.dataset.goal) { transaction(next=>{next.dailyGoal=Number(button.dataset.goal);}); render(); toast('每日新词目标已保存'); }
    switch(button.dataset.action) {
      case 'add':openEditor();break;
      case 'learn':startSession(true);break;
      case 'review':startSession(false);break;
      case 'install':$('#help').showModal();break;
      case 'export':exportBackup();break;
      case 'import':$('#restore-file').click();break;
      case 'plan':tab='plan';history.replaceState(null,'','#plan');render();window.scrollTo(0,0);break;
    }
  } catch(error) { toast(error.message); }
});
$('#install-button').onclick=()=>$('#help').showModal();
document.addEventListener('input',event=>{
  if(event.target.id==='search'){query=event.target.value;$('#word-list').innerHTML=wordRows();}
});
document.addEventListener('submit',event=>{
  if(event.target.id!=='goal-form')return;
  event.preventDefault();
  try {
    const goal=Number(new FormData(event.target).get('dailyGoal'));
    transaction(next=>{next.dailyGoal=goal;}); render(); toast('每日新词目标已保存');
  } catch(error){event.target.querySelector('.form-error').textContent=error.message;}
});
$('#word-form').addEventListener('submit',event=>{
  event.preventDefault();
  try {
    const fields=Object.fromEntries(new FormData(event.target));
    fields.spelling=fields.spelling.trim(); fields.meaning=fields.meaning.trim(); fields.example=fields.example.trim();
    if (!fields.spelling || !fields.meaning) throw Error('请填写单词和中文释义。');
    transaction(next=>{
      if(next.words.some(w=>w.id!==editID && w.level===fields.level && w.spelling.toLowerCase()===fields.spelling.toLowerCase())) throw Error('这个词已在所选词库中，可直接编辑已有单词。');
      if(editID){const index=next.words.findIndex(w=>w.id===editID);if(index<0)throw Error('该单词已不存在');next.words[index]={...next.words[index],...fields};}
      else next.words.push(createWord(fields));
    });
    $('#editor').close();render();toast(editID?'修改已保存':'已加入词库，到“今日”开始学习');
  } catch(error){event.target.querySelector('.form-error').textContent=error.message;}
});
$('#restore-file').addEventListener('change',async event=>{
  const file=event.target.files[0]; event.target.value=''; if(!file)return;
  try {
    if(file.size>10*1024*1024)throw Error('备份文件不能超过 10 MB');
    const imported=validateLibrary(JSON.parse(await file.text()));
    confirmAction('恢复这份备份？',`将用备份中的 ${imported.words.length} 个单词替换当前 ${library.words.length} 个单词及其进度。建议先导出当前词库。`,'确认恢复',()=>{
      commit(imported,true);render();toast('词库和进度已恢复');
    });
  } catch(error){toast('无法恢复：'+error.message);}
});
window.addEventListener('storage',event=>{if(event.key===KEY){load();$('#review').close();session=null;render();toast('词库已更新');}});
function refreshDate(){if(dayKey()!==lastToday){lastToday=dayKey();render();}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDate();});
setInterval(refreshDate,30000);
window.addEventListener('hashchange',()=>{const next=location.hash.slice(1);if(['today','library','plan'].includes(next)){tab=next;render();}});
load();render();
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
