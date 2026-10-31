export const milestones = [1, 2, 4, 7, 15, 30];
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addDays(day, days) {
  const [y, m, d] = day.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + days, 12));
}
export function nextDue(day, stage) {
  if (!Number.isInteger(stage) || stage < 0 || stage > 6) throw Error('复习进度无效');
  return stage === 6 ? null : addDays(day, milestones[stage] - (stage ? milestones[stage - 1] : 0));
}
export const isDue = (word, today = dayKey()) => word.learned !== null && word.due !== null && word.due <= today;
export const freshLibrary = () => ({version: 1, revision: 0, dailyGoal: 20, words: [], events: []});
export function dailyProgress(library, today = dayKey()) {
  const goal = library.dailyGoal ?? 20;
  const learned = library.words.filter(w => w.learned === today).length;
  const remaining = Math.max(0, goal - learned);
  const available = library.words.filter(w => w.learned === null).length;
  return {goal, learned, remaining, available, nextCount: Math.min(remaining, available)};
}
export function createWord({spelling, meaning, example = '', level = '4'}, id = crypto.randomUUID()) {
  return {id, spelling: spelling.trim(), meaning: meaning.trim(), example: example.trim(), level,
    created: new Date().toISOString(), learned: null, due: null, stage: 0, lapses: 0};
}
export function learnWord(word, today = dayKey()) {
  if (word.learned !== null) throw Error('这个单词已经开始学习');
  return {...word, learned: today, due: nextDue(today, 0)};
}
export function reviewWord(word, remembered, today = dayKey()) {
  if (!isDue(word, today)) throw Error('这个单词尚未到复习时间');
  const stage = remembered ? word.stage + 1 : 0;
  return {...word, stage, due: nextDue(today, stage), lapses: word.lapses + (remembered ? 0 : 1)};
}
function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return addDays(value, 0) === value;
}
export function validateLibrary(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.words) || !Array.isArray(value.events) || value.words.length > 20000 || value.events.length > 200000) throw Error('不是有效的拾词网页版备份，或数据量过大');
  const dailyGoal = value.dailyGoal ?? 20;
  if (!Number.isInteger(dailyGoal) || dailyGoal < 1 || dailyGoal > 500) throw Error('每日新词数量需为 1–500 的整数');
  const ids = new Set(), keys = new Set();
  for (const w of value.words) {
    if (!w || typeof w.id !== 'string' || !w.id || ids.has(w.id) ||
        !['4', '6'].includes(w.level) || typeof w.spelling !== 'string' || !w.spelling.trim() || w.spelling.length > 120 ||
        typeof w.meaning !== 'string' || !w.meaning.trim() || w.meaning.length > 2000 || typeof w.example !== 'string' || w.example.length > 4000 ||
        !Number.isInteger(w.stage) || w.stage < 0 || w.stage > 6 || !Number.isInteger(w.lapses) || w.lapses < 0 ||
        typeof w.created !== 'string' || !Number.isFinite(Date.parse(w.created))) throw Error('备份包含无效的单词记录');
    const key = w.level + ':' + w.spelling.trim().toLowerCase();
    if (keys.has(key)) throw Error('备份包含重复的单词');
    keys.add(key); ids.add(w.id);
    if (w.learned === null) {
      if (w.due !== null || w.stage !== 0) throw Error('未学单词的进度无效');
    } else if (!validDay(w.learned) || (w.stage === 6 ? w.due !== null : !validDay(w.due))) throw Error('复习日期无效');
  }
  for (const e of value.events) {
    if (!e || !ids.has(e.wordID) || !validDay(e.day) || typeof e.remembered !== 'boolean') throw Error('复习记录无效');
  }
  return {version: 1, revision: Number.isSafeInteger(value.revision) ? value.revision : 0, dailyGoal, words: value.words, events: value.events};
}
