import fs from 'node:fs';
import path from 'node:path';
import { ax5dTemplate } from './ax-5d.js';

/**
 * 기본 콘텐츠를 JSON 으로 내보낸다.
 * Coolify/운영 서버에서는 이 파일을 그대로 `POST /api/admin/sessions/:id/content` 로 넣을 수 있다.
 */
const outDir = path.resolve('docs');
fs.mkdirSync(outDir, { recursive: true });

const outFile = path.join(outDir, 'content.ax-5d.json');
fs.writeFileSync(outFile, `${JSON.stringify(ax5dTemplate, null, 2)}\n`, 'utf8');

const missionCount = ax5dTemplate.stages.reduce(
  (total, stage) => total + (stage.missions?.length ?? 0),
  0
);
const slideCount = ax5dTemplate.stages.reduce(
  (total, stage) => total + (stage.slides?.length ?? 0),
  0
);

console.log(`[content] ${outFile}`);
console.log(`[content] ${ax5dTemplate.stages.length} stages / ${missionCount} missions / ${slideCount} slides`);
