const http = require('http');
const fs = require('fs');
const path = require('path');

const host = '127.0.0.1';
const port = 3000;
const root = __dirname;
const dataDir = path.join(root, 'data');
const dataFile = path.join(dataDir, 'rankings.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify({ scores: [], dailyWinners: [] }, null, 2), 'utf8');
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

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

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

function getLocalDateParts(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function normalizeDate(value) {
  if (!value) return getLocalDateParts();
  return String(value).slice(0, 10);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('Body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function isValidPhone(phone) {
  return /^1\d{10}$/.test(phone);
}

function maskPhone(phone) {
  if (!phone || phone.length !== 11) return phone || '';
  return `${phone.slice(0, 3)}****${phone.slice(7)}`;
}

function formatScoreItem(item) {
  return {
    user_id: item.userId,
    nickname: item.nickname,
    phone_masked: item.phone ? maskPhone(item.phone) : '',
    used_seconds: item.usedSeconds,
    played_at: item.playedAt
  };
}

function getBestScoresByDate(dateStr) {
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

  return [...bestMap.values()].sort((a, b) => {
    return a.usedSeconds - b.usedSeconds || a.playedAt.localeCompare(b.playedAt) || String(a.phone || a.userId).localeCompare(String(b.phone || b.userId));
  });
}

function getTodayTop10(dateStr) {
  return getBestScoresByDate(dateStr).slice(0, 10).map(formatScoreItem);
}

function getPreviewTop(dateStr, limit = 5) {
  return getTodayTop10(dateStr).slice(0, limit);
}

function settleDailyWinners(dateStr) {
  const store = readStore();
  const winners = getBestScoresByDate(dateStr).slice(0, 10);
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
    played_at: item.playedAt,
    snapshot_at: snapshotAt
  }));
}

function getSettledWinners(dateStr) {
  const store = readStore();
  return store.dailyWinners
    .filter(item => item.winnerDate === dateStr)
    .sort((a, b) => a.rankNo - b.rankNo)
    .map(item => ({
      rank_no: item.rankNo,
      user_id: item.userId,
      nickname: item.nickname,
      phone_masked: maskPhone(item.phone),
      used_seconds: item.usedSeconds,
      played_at: item.playedAt,
      snapshot_at: item.snapshotAt
    }));
}

function serveStatic(req, res) {
  const urlPath = req.url === '/' ? '/index.html' : req.url;
  const safePath = path.normalize(urlPath.split('?')[0]).replace(/^([.][.][/\\])+/, '');
  const filePath = path.join(root, safePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || `${host}:${port}`}`);

  try {
    if (req.method === 'GET' && reqUrl.pathname === '/api/health') {
      sendJson(res, 200, { ok: true, now: new Date().toISOString(), today: getLocalDateParts(), dataFile });
      return;
    }

    if (req.method === 'POST' && reqUrl.pathname === '/api/score') {
      const body = await parseBody(req);
      const userId = String(body.userId || '').trim();
      const nickname = String(body.nickname || '').trim() || '蓝莓玩家';
      const phone = String(body.phone || '').trim();
      const usedSeconds = Number(body.usedSeconds);
      const playedAt = body.playedAt ? new Date(body.playedAt).toISOString() : new Date().toISOString();
      const playedDate = normalizeDate(body.playedDate || getLocalDateParts(new Date(playedAt)));

      if (!userId) {
        sendJson(res, 400, { ok: false, error: 'userId 必填' });
        return;
      }
      if (!isValidPhone(phone)) {
        sendJson(res, 400, { ok: false, error: '手机号格式不正确，请输入 11 位手机号' });
        return;
      }
      if (!Number.isFinite(usedSeconds) || usedSeconds <= 0) {
        sendJson(res, 400, { ok: false, error: 'usedSeconds 必须为正数' });
        return;
      }

      const store = readStore();
      store.scores.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId,
        nickname,
        phone,
        usedSeconds: Math.floor(usedSeconds),
        playedAt,
        playedDate,
        createdAt: new Date().toISOString()
      });
      writeStore(store);

      const bestScores = getBestScoresByDate(playedDate);
      const myBest = bestScores.find(item => item.phone === phone);
      const rank = bestScores.findIndex(item => item.phone === phone) + 1;

      sendJson(res, 200, {
        ok: true,
        message: '成绩已提交',
        playedDate,
        myBest: myBest ? formatScoreItem(myBest) : null,
        rank: rank || null,
        top10: getTodayTop10(playedDate)
      });
      return;
    }

    if (req.method === 'GET' && reqUrl.pathname === '/api/rankings/today') {
      const date = normalizeDate(reqUrl.searchParams.get('date'));
      sendJson(res, 200, {
        ok: true,
        date,
        top10: getTodayTop10(date),
        preview: getPreviewTop(date, 5)
      });
      return;
    }

    if (req.method === 'POST' && reqUrl.pathname === '/api/rankings/settle') {
      const body = await parseBody(req);
      const date = normalizeDate(body.date);
      const winners = settleDailyWinners(date);
      sendJson(res, 200, { ok: true, date, winners, count: winners.length });
      return;
    }

    if (req.method === 'GET' && reqUrl.pathname === '/api/rankings/winners') {
      const date = normalizeDate(reqUrl.searchParams.get('date'));
      sendJson(res, 200, { ok: true, date, winners: getSettledWinners(date) });
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || 'Server error' });
  }
});

server.listen(port, host, () => {
  console.log(`Blueberry game is running at http://${host}:${port}`);
  console.log(`Data file: ${dataFile}`);
});
