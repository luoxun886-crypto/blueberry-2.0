const fs = require('fs');
const path = require('path');

const root = __dirname;
const dataFile = path.join(root, 'data', 'rankings.json');

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch {
    return { scores: [], dailyWinners: [] };
  }
}

function writeStore(store) {
  fs.writeFileSync(dataFile, JSON.stringify(store, null, 2), 'utf8');
}

function getShanghaiDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function getPreviousDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() - 1);
  return utc.toISOString().slice(0, 10);
}

function maskPhone(phone) {
  if (!phone || phone.length !== 11) return phone || '';
  return `${phone.slice(0, 3)}****${phone.slice(7)}`;
}

function settleDailyWinners(dateStr) {
  const store = readStore();
  const dayScores = store.scores.filter(item => item.playedDate === dateStr);
  const bestMap = new Map();

  for (const item of dayScores) {
    const key = item.phone || `legacy:${item.userId}`;
    const current = bestMap.get(key);
    if (!current) {
      bestMap.set(key, item);
      continue;
    }
    if (item.usedSeconds < current.usedSeconds) {
      bestMap.set(key, item);
      continue;
    }
    if (item.usedSeconds === current.usedSeconds && item.playedAt < current.playedAt) {
      bestMap.set(key, item);
    }
  }

  const winners = [...bestMap.values()]
    .sort((a, b) => a.usedSeconds - b.usedSeconds || a.playedAt.localeCompare(b.playedAt) || String(a.phone || a.userId).localeCompare(String(b.phone || b.userId)))
    .slice(0, 10);

  const snapshotAt = new Date().toISOString();
  store.dailyWinners = store.dailyWinners.filter(item => item.winnerDate !== dateStr);
  winners.forEach((item, index) => {
    store.dailyWinners.push({
      winnerDate: dateStr,
      rankNo: index + 1,
      userId: item.userId,
      nickname: item.nickname,
      phone: item.phone,
      usedSeconds: item.usedSeconds,
      playedAt: item.playedAt,
      snapshotAt
    });
  });
  writeStore(store);

  return winners.map((item, index) => ({
    rank_no: index + 1,
    nickname: item.nickname,
    phone_masked: maskPhone(item.phone),
    used_seconds: item.usedSeconds,
    played_at: item.playedAt
  }));
}

const today = getShanghaiDate();
const targetDate = process.argv[2] || getPreviousDate(today);
const result = settleDailyWinners(targetDate);
console.log(JSON.stringify({ ok: true, date: targetDate, count: result.length, winners: result }, null, 2));
