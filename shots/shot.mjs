import fs from 'node:fs';
import { spawn } from 'node:child_process';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import WebSocket from 'ws';

const env = Object.fromEntries(
  fs
    .readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    })
);

const { Pool } = pg;
const pool = new Pool({ connectionString: env.DATABASE_URL });
const { rows } = await pool.query(
  `select t.id, t.name, s.id as session_id from teams t
   join sessions s on s.id = t.session_id
   where s.join_code = $1 order by t.created_at limit 1`,
  ['DEMO01']
);
await pool.end();

const team = rows[0];
if (!team) throw new Error('데모 조가 없습니다. seed 를 먼저 실행하세요.');

const teamToken = jwt.sign(
  { role: 'team', teamId: team.id, sessionId: team.session_id, teamName: team.name },
  env.JWT_SECRET,
  { expiresIn: '2h' }
);
const adminToken = jwt.sign({ role: 'instructor', name: 'instructor' }, env.JWT_SECRET, {
  expiresIn: '2h'
});

const chrome = spawn(
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--remote-debugging-port=9333',
    '--remote-allow-origins=*',
    `--user-data-dir=${process.cwd()}\\shots\\cdp-profile`,
    '--window-size=1400,900',
    'about:blank'
  ],
  { stdio: 'ignore' }
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function targetUrl() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch('http://127.0.0.1:9333/json/list');
      const list = await res.json();
      const page = list.find((item) => item.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // 아직 준비 안 됨
    }
    await sleep(250);
  }
  throw new Error('CDP 타깃을 찾지 못했습니다.');
}

const ws = new WebSocket(await targetUrl(), { perMessageDeflate: false });
await new Promise((resolve) => ws.once('open', resolve));

let seq = 0;
const pending = new Map();
ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(`${msg.method}: ${JSON.stringify(msg.error)}`));
    else resolve(msg.result);
  }
});

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

await send('Page.enable');
await send('Network.enable');
await send('Runtime.enable');

async function shoot(name, url, cookie, width, height, mobile, afterLoad) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile
  });
  await send('Network.clearBrowserCookies');
  if (cookie) {
    await send('Network.setCookie', {
      name: cookie.name,
      value: cookie.value,
      url: 'http://127.0.0.1:8080',
      path: '/',
      httpOnly: true
    });
  }
  await send('Page.navigate', { url });
  await sleep(4000);
  if (afterLoad) {
    await afterLoad();
    await sleep(3000);
  }
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`shots/${name}.png`, Buffer.from(data, 'base64'));
  console.log('saved shots/' + name + '.png');
}

await shoot('play', 'http://127.0.0.1:8080/play', { name: 'ts_team', value: teamToken }, 430, 960, true);
await shoot(
  'admin-console',
  'http://127.0.0.1:8080/admin',
  { name: 'ts_instructor', value: adminToken },
  1600,
  1000,
  false,
  async () => {
    await send('Runtime.evaluate', {
      expression: `[...document.querySelectorAll('button')].find((b) => b.textContent.includes('콘솔 열기'))?.click()`
    });
  }
);
await shoot('screen-idle', 'http://127.0.0.1:8080/screen/DEMO01', null, 1600, 900, false);

// 강사 로그인 후 강의자료/리뷰 모드 스크린샷
const loginRes = await fetch('http://127.0.0.1:8080/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: env.ADMIN_PASSWORD })
});
const instructorCookie = (loginRes.headers.getSetCookie?.()[0] ?? '').split(';')[0];

const listRes = await fetch('http://127.0.0.1:8080/api/admin/sessions', {
  headers: { Cookie: instructorCookie }
});
const sessionsPayload = await listRes.json();
const demo = sessionsPayload.sessions.find((item) => item.joinCode === 'DEMO01');

const patchScreen = (body) =>
  fetch(`http://127.0.0.1:8080/api/admin/sessions/${demo.id}/screen`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: instructorCookie },
    body: JSON.stringify(body)
  });

await patchScreen({ mode: 'lecture', slideIndex: 0 });
await shoot('screen-lecture', 'http://127.0.0.1:8080/screen/DEMO01', null, 1600, 900, false);

await patchScreen({ mode: 'review' });
await shoot('screen-review', 'http://127.0.0.1:8080/screen/DEMO01', null, 1600, 900, false);

await patchScreen({ mode: 'mission' });

ws.close();
chrome.kill();
process.exit(0);
