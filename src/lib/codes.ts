import { randomInt } from 'node:crypto';

/** 헷갈리는 문자(I, O, 0, 1) 제외 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

export async function uniqueCode(
  isTaken: (code: string) => Promise<boolean>,
  length = 6
): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const code = randomCode(length);
    // eslint-disable-next-line no-await-in-loop
    if (!(await isTaken(code))) return code;
  }
  throw new Error('고유 코드 생성에 실패했습니다. 다시 시도해주세요.');
}

export const TEAM_COLORS = [
  'sky',
  'violet',
  'amber',
  'emerald',
  'rose',
  'cyan',
  'lime',
  'fuchsia',
  'orange',
  'teal'
] as const;

export function pickColor(index: number): string {
  return TEAM_COLORS[index % TEAM_COLORS.length];
}
