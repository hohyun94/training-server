#!/usr/bin/env node
/**
 * Coolify 자동 배포 (v1 API).
 *
 *   node scripts/coolify-deploy.mjs --check   # 읽기 전용: 프로젝트/서버/GitHub App/앱 목록 확인
 *   node scripts/coolify-deploy.mjs --plan    # 기본값: 무엇을 만들지 미리보기
 *   node scripts/coolify-deploy.mjs --apply   # 실제 생성 + 환경변수 + 볼륨 + 배포
 *
 * 필요한 값 (환경변수 또는 .env.coolify — gitignore 됨)
 *   COOLIFY_URL=https://coolify.example.com
 *   COOLIFY_TOKEN=<Keys & Tokens → API tokens>
 *   ADMIN_PASSWORD=<강사 로그인 비밀번호>
 *   JWT_SECRET=<32자 이상 (없으면 자동 생성해 출력)>
 *   APP_DOMAIN=https://training.example.com   (선택 — 없으면 자동 도메인)
 *
 * 선택
 *   COOLIFY_PROJECT=AX Training   COOLIFY_ENVIRONMENT=production
 *   COOLIFY_SERVER=<이름|uuid>    COOLIFY_GITHUB_APP=<이름|uuid>
 *   APP_NAME=training-server      DB_NAME=training-db
 *   GIT_REPOSITORY=https://github.com/hohyun94/training-server  GIT_BRANCH=main
 */
import crypto from 'node:crypto';
import fs from 'node:fs';

/** .env.coolify 가 있으면 읽어 process.env 에 채운다(이미 있는 값 우선). */
if (fs.existsSync('.env.coolify')) {
  for (const line of fs.readFileSync('.env.coolify', 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match || line.trim().startsWith('#')) continue;
    if (!process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
}

const argv = new Set(process.argv.slice(2));
const MODE = argv.has('--apply') ? 'apply' : argv.has('--check') ? 'check' : 'plan';

const BASE = (process.env.COOLIFY_URL ?? '').replace(/\/+$/, '');
const TOKEN = (process.env.COOLIFY_TOKEN ?? '').trim();

const cfg = {
  projectName: process.env.COOLIFY_PROJECT ?? 'AX Training',
  environment: process.env.COOLIFY_ENVIRONMENT ?? 'production',
  server: process.env.COOLIFY_SERVER ?? '',
  githubApp: process.env.COOLIFY_GITHUB_APP ?? '',
  appName: process.env.APP_NAME ?? 'training-server',
  dbName: process.env.DB_NAME ?? 'training-db',
  domain: (process.env.APP_DOMAIN ?? '').replace(/\/+$/, ''),
  repo: process.env.GIT_REPOSITORY ?? 'https://github.com/hohyun94/training-server',
  branch: process.env.GIT_BRANCH ?? 'main',
  port: process.env.APP_PORT ?? '8080',
  adminPassword: process.env.ADMIN_PASSWORD ?? '',
  jwtSecret: process.env.JWT_SECRET ?? '',
  uploadDir: process.env.UPLOAD_DIR_CONTAINER ?? '/data/uploads'
};

const log = {
  step: (message) => console.log(`\n▶ ${message}`),
  info: (message) => console.log(`  · ${message}`),
  ok: (message) => console.log(`  ✓ ${message}`),
  warn: (message) => console.log(`  ! ${message}`)
};

function die(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

async function api(path, init = {}) {
  if (!BASE || !TOKEN) die('COOLIFY_URL / COOLIFY_TOKEN 이 필요합니다 (.env.coolify 또는 환경변수).');
  const response = await fetch(`${BASE}/api/v1${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers ?? {})
    },
    signal: AbortSignal.timeout(45_000)
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const detail = typeof body === 'string' ? body.slice(0, 400) : JSON.stringify(body).slice(0, 400);
    throw new Error(`HTTP ${response.status} ${path} → ${detail}`);
  }
  return body;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function pickBy(list, needle, keys = ['name', 'uuid']) {
  const target = needle.toLowerCase();
  return list.find((item) =>
    keys.some((key) => String(item?.[key] ?? '').toLowerCase() === target)
  ) ?? list.find((item) =>
    keys.some((key) => String(item?.[key] ?? '').toLowerCase().includes(target))
  ) ?? null;
}

async function discover() {
  log.step(`Coolify 확인 (${BASE})`);

  const [projects, servers, githubApps] = await Promise.all([
    api('/projects'),
    api('/servers'),
    api('/github-apps').catch(() => [])
  ]);

  const projectList = asList(projects);
  const serverList = asList(servers);
  const appList = asList(githubApps);

  log.info(`프로젝트 ${projectList.length}개 · 서버 ${serverList.length}개 · GitHub App ${appList.length}개`);

  if (!serverList.length) {
    die('Coolify 에 등록된 서버가 없습니다. Coolify 에서 서버(localhost 포함)를 먼저 등록하세요.');
  }

  const server = cfg.server ? pickBy(serverList, cfg.server) : serverList[0];
  if (!server) die(`서버를 찾지 못했습니다: ${cfg.server}`);

  let project = pickBy(projectList, cfg.projectName);
  let environment = null;

  if (project?.uuid) {
    const detail = await api(`/projects/${project.uuid}`);
    const envs = asList(detail?.environments);
    environment =
      envs.find((env) => String(env?.name).toLowerCase() === cfg.environment.toLowerCase()) ?? null;
    project = { ...project, detail };
  }

  const githubApp = cfg.githubApp ? pickBy(appList, cfg.githubApp) : appList[0] ?? null;

  log.ok(`서버: ${server.name} (${server.uuid})`);
  if (project?.uuid) {
    log.ok(`프로젝트: ${project.name} (${project.uuid})`);
    log.ok(environment ? `환경: ${environment.name}` : `환경 '${cfg.environment}' 없음 → 생성 예정`);
  } else {
    log.info(`프로젝트 '${cfg.projectName}' 없음 → 생성 예정`);
  }
  if (githubApp) log.ok(`GitHub App: ${githubApp.name} (${githubApp.uuid})`);
  else {
    log.warn(
      'GitHub App 을 찾지 못했습니다. Coolify → Sources 에서 GitHub App 을 연결해야 private 레포를 받을 수 있습니다.'
    );
  }

  return {
    project,
    environment,
    server,
    githubApp,
    githubApps: appList,
    projects: projectList
  };
}

async function ensureProject(state) {
  if (state.project?.uuid) {
    if (!state.environment) state.environment = { name: cfg.environment };
    return state.project;
  }
  if (MODE !== 'apply') {
    log.info(`[plan] POST /projects { name: '${cfg.projectName}' }`);
    return { uuid: '<new-project>', name: cfg.projectName };
  }
  const created = await api('/projects', {
    method: 'POST',
    body: JSON.stringify({ name: cfg.projectName, description: 'AX 5D 실습 진행 서버' })
  });
  log.ok(`프로젝트 생성: ${cfg.projectName} (${created?.uuid})`);
  state.project = created;
  state.environment = { name: cfg.environment };
  return created;
}

async function ensureDatabase(state) {
  log.step('PostgreSQL 리소스');
  const databases = asList(await api('/databases').catch(() => []));
  const existing = pickBy(databases, cfg.dbName);

  if (existing) {
    log.ok(`기존 DB 사용: ${existing.name} (${existing.uuid})`);
    return api(`/databases/${existing.uuid}`);
  }

  const body = {
    server_uuid: state.server.uuid,
    project_uuid: state.project.uuid,
    environment_name: cfg.environment,
    name: cfg.dbName,
    postgres_user: process.env.DB_USER ?? 'training',
    postgres_password: process.env.DB_PASSWORD ?? crypto.randomBytes(12).toString('hex'),
    postgres_db: process.env.DB_DATABASE ?? 'training',
    instant_deploy: true
  };

  if (MODE !== 'apply') {
    log.info(
      `[plan] POST /databases/postgresql { name: '${cfg.dbName}', user: '${body.postgres_user}', db: '${body.postgres_db}' }`
    );
    return null;
  }

  const created = await api('/databases/postgresql', {
    method: 'POST',
    body: JSON.stringify(body)
  });
  log.ok(`DB 생성 요청: ${cfg.dbName} (${created?.uuid})`);

  for (let i = 0; i < 40; i += 1) {
    await sleep(4000);
    const row = await api(`/databases/${created.uuid}`).catch(() => null);
    if (row?.internal_db_url) {
      log.ok('DB 준비 완료 (internal URL 확보)');
      return row;
    }
  }
  log.warn('DB 가 아직 준비 중입니다. Coolify 화면에서 상태를 확인한 뒤 다시 실행하세요.');
  return api(`/databases/${created.uuid}`).catch(() => null);
}

function databaseUrl(row, state) {
  if (row?.internal_db_url) return row.internal_db_url;
  const user = row?.postgres_user ?? process.env.DB_USER ?? 'training';
  const password = row?.postgres_password ?? process.env.DB_PASSWORD ?? '';
  const host = row?.internal_hostname ?? row?.uuid ?? cfg.dbName;
  const db = row?.postgres_db ?? process.env.DB_DATABASE ?? 'training';
  return `postgres://${user}:${password}@${host}:5432/${db}`;
}

async function ensureApplication(state) {
  log.step('애플리케이션 리소스');
  const applications = asList(await api('/applications'));
  const existing = pickBy(applications, cfg.appName);

  if (existing) {
    log.ok(`기존 앱 사용: ${existing.name} (${existing.uuid})`);
    return api(`/applications/${existing.uuid}`);
  }

  if (!state.githubApp?.uuid) {
    die(
      'GitHub App UUID 를 찾지 못했습니다.\n' +
        '  Coolify → Sources → GitHub App 에서 이 저장소에 대한 권한을 부여하고,\n' +
        '  COOLIFY_GITHUB_APP=<app 이름 또는 uuid> 로 다시 실행하세요.'
    );
  }

  const body = {
    project_uuid: state.project.uuid,
    environment_name: cfg.environment,
    server_uuid: state.server.uuid,
    github_app_uuid: state.githubApp.uuid,
    git_repository: cfg.repo,
    git_branch: cfg.branch,
    build_pack: 'dockerfile',
    dockerfile_location: '/Dockerfile',
    ports_exposes: cfg.port,
    name: cfg.appName,
    description: 'AX 5D 실습 진행 서버',
    ...(cfg.domain ? { domains: cfg.domain } : {})
  };

  if (MODE !== 'apply') {
    log.info(`[plan] POST /applications/private-github-app ${JSON.stringify(body, null, 2)}`);
    return { uuid: '<new-app>', name: cfg.appName };
  }

  const created = await api('/applications/private-github-app', {
    method: 'POST',
    body: JSON.stringify(body)
  });
  log.ok(`앱 생성: ${cfg.appName} (${created?.uuid})`);
  return api(`/applications/${created.uuid}`);
}

async function setEnvs(uuid, values) {
  const payload = Object.entries(values).map(([key, value]) => ({
    key,
    value: String(value ?? ''),
    is_preview: false,
    is_runtime: true,
    is_buildtime: false
  }));

  if (MODE !== 'apply') {
    log.info(`[plan] 환경변수 ${payload.map((item) => item.key).join(', ')}`);
    return;
  }

  try {
    await api(`/applications/${uuid}/envs`, { method: 'PATCH', body: JSON.stringify(payload) });
    log.ok(`환경변수 ${payload.length}개 반영`);
    return;
  } catch (error) {
    log.warn(`벌크 갱신 실패 → 단건으로 재시도 (${String(error.message).slice(0, 120)})`);
  }

  for (const item of payload) {
    try {
      await api(`/applications/${uuid}/envs`, { method: 'POST', body: JSON.stringify(item) });
    } catch {
      await api(`/applications/${uuid}/envs`, { method: 'PATCH', body: JSON.stringify([item]) });
    }
  }
  log.ok(`환경변수 ${payload.length}개 반영 (단건)`);
}

async function configureApp(uuid) {
  const patch = {
    build_pack: 'dockerfile',
    dockerfile_location: '/Dockerfile',
    ports_exposes: cfg.port,
    health_check_enabled: true,
    health_check_method: 'GET',
    health_check_path: '/api/public/health',
    health_check_return_code: 200,
    health_check_interval: 30,
    health_check_timeout: 5,
    health_check_retries: 3,
    health_check_start_period: 25,
    ...(cfg.domain ? { domains: cfg.domain } : {})
  };

  if (MODE !== 'apply') {
    log.info('[plan] PATCH 애플리케이션 (dockerfile 경로·포트·헬스체크·도메인)');
    return;
  }
  await api(`/applications/${uuid}`, { method: 'PATCH', body: JSON.stringify(patch) });
  log.ok('앱 설정 반영 (Dockerfile · 8080 · 헬스체크)');
}

async function ensureStorage(uuid) {
  if (MODE !== 'apply') {
    log.info(`[plan] POST /applications/{uuid}/storages { name: 'uploads', mount_path: '${cfg.uploadDir}' }`);
    return;
  }

  const storages = asList(await api(`/applications/${uuid}/storages`).catch(() => []));
  const normalized = cfg.uploadDir.replace(/\/+$/, '');
  const exists = storages.some(
    (row) => String(row?.mount_path ?? '').replace(/\/+$/, '') === normalized
  );
  if (exists) {
    log.ok(`볼륨 이미 연결됨: ${cfg.uploadDir}`);
    return;
  }

  const attempts = [
    { type: 'volume', name: 'uploads', mount_path: cfg.uploadDir },
    { name: 'uploads', mount_path: cfg.uploadDir }
  ];
  let lastError = null;
  for (const body of attempts) {
    try {
      await api(`/applications/${uuid}/storages`, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      log.ok(`볼륨 연결: ${cfg.uploadDir}`);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  log.warn(
    `볼륨 자동 연결 실패 — Coolify UI → Persistent Storage 에서 ${cfg.uploadDir} 를 추가하세요. (${String(
      lastError?.message ?? ''
    ).slice(0, 100)})`
  );
}

async function deployApp(uuid) {
  log.step('배포');
  if (MODE !== 'apply') {
    log.info('[plan] GET /deploy?uuid=...&force=true');
    return null;
  }

  const result = await api(`/deploy?uuid=${encodeURIComponent(uuid)}&force=true`);
  const deploymentUuid =
    result?.deployments?.[0]?.deployment_uuid ??
    result?.deployment_uuid ??
    result?.deployments?.[0]?.uuid ??
    null;
  log.ok(`배포 요청${deploymentUuid ? ` (deployment ${deploymentUuid})` : ''}`);

  if (!deploymentUuid) return null;

  for (let i = 0; i < 120; i += 1) {
    await sleep(6000);
    const rows = await api(`/deployments/${deploymentUuid}`).catch(() => null);
    const row = Array.isArray(rows) ? rows[0] : rows;
    const status = String(row?.status ?? '').toLowerCase();
    if (status.includes('finished') || status.includes('success')) {
      log.ok('배포 완료');
      return 'finished';
    }
    if (status.includes('failed') || status.includes('cancelled')) {
      log.warn('배포 실패 — Coolify 로그를 확인하세요.');
      return 'failed';
    }
  }
  log.warn('배포가 12분 안에 끝나지 않았습니다. Coolify 화면에서 상태를 확인하세요.');
  return 'timeout';
}

async function waitHealthy(baseUrl) {
  if (!baseUrl) return 'skipped';
  const target = `${baseUrl.replace(/\/+$/, '')}/api/public/health`;
  log.step(`헬스체크 ${target}`);
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(target, { signal: AbortSignal.timeout(10_000) });
      if (response.ok) {
        log.ok('HTTP 200 OK — 정상 기동');
        return 'ok';
      }
    } catch {
      // 아직 기동 중
    }
    await sleep(6000);
  }
  log.warn('헬스체크 응답이 없습니다. Coolify 배포 로그를 확인하세요.');
  return 'fail';
}

function usage() {
  console.log(`
사용법
  node scripts/coolify-deploy.mjs --check    # 읽기 전용 점검
  node scripts/coolify-deploy.mjs --plan     # 생성 계획 미리보기(기본)
  node scripts/coolify-deploy.mjs --apply    # 실제 배포

필수 환경변수 (.env.coolify 파일 또는 셸 환경변수)
  COOLIFY_URL=https://coolify.example.com
  COOLIFY_TOKEN=<Coolify → Keys & Tokens → API tokens>
  ADMIN_PASSWORD=<강사 로그인 비밀번호>

권장
  JWT_SECRET=<32자 이상>
  APP_DOMAIN=https://training.example.com

선택
  COOLIFY_PROJECT=AX Training   COOLIFY_ENVIRONMENT=production
  COOLIFY_SERVER=<이름|uuid>    COOLIFY_GITHUB_APP=<이름|uuid>
  APP_NAME=training-server      DB_NAME=training-db
`);
}

async function main() {
  console.log(`\nCoolify 배포 (mode=${MODE})`);
  if (!BASE || !TOKEN) {
    usage();
    process.exit(1);
  }

  if (MODE === 'apply' && !cfg.adminPassword) {
    die('ADMIN_PASSWORD 를 .env.coolify 에 설정하세요. (강사 콘솔 로그인 비밀번호)');
  }
  if (!cfg.jwtSecret) {
    cfg.jwtSecret = crypto.randomBytes(32).toString('hex');
    if (MODE === 'apply') {
      log.warn(`JWT_SECRET 자동 생성 — .env.coolify 에 저장해 두세요: ${cfg.jwtSecret}`);
    }
  }

  const state = await discover();

  if (MODE === 'check') {
    console.log('\n점검 완료. 문제가 없으면 --plan 또는 --apply 로 실행하세요.\n');
    return;
  }

  await ensureProject(state);
  const database = await ensureDatabase(state);
  const application = await ensureApplication(state);
  const appUuid = application?.uuid;
  if (!appUuid) die('앱 UUID 를 확보하지 못했습니다.');

  const baseUrl = cfg.domain;
  await setEnvs(appUuid, {
    DATABASE_URL: database ? databaseUrl(database, state) : '<internal-db-url>',
    ADMIN_PASSWORD: cfg.adminPassword,
    JWT_SECRET: cfg.jwtSecret,
    PUBLIC_BASE_URL: baseUrl,
    COOKIE_SECURE: baseUrl.startsWith('https') ? 'true' : 'false',
    UPLOAD_DIR: cfg.uploadDir,
    PORT: cfg.port,
    RUN_MIGRATIONS: 'true',
    NODE_ENV: 'production'
  });

  await configureApp(appUuid);
  await ensureStorage(appUuid);
  const deployStatus = await deployApp(appUuid);
  const health = deployStatus === 'finished' ? await waitHealthy(baseUrl) : 'skipped';

  console.log('\n────────────────────────────────────────');
  console.log(`앱         : ${cfg.appName} (${appUuid})`);
  console.log(`프로젝트   : ${cfg.projectName} / ${cfg.environment}`);
  console.log(`도메인     : ${baseUrl || '(Coolify 자동 도메인)'}`);
  console.log(`배포 상태  : ${deployStatus ?? 'plan'}`);
  console.log(`헬스체크   : ${health}`);
  console.log(`강사 콘솔  : ${baseUrl || '(도메인)'}/admin`);
  console.log('────────────────────────────────────────\n');
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}\n`);
  process.exit(1);
});




