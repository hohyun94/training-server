import type { ReactNode } from 'react';

function inline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={`${keyPrefix}-${index}`} className="font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={`${keyPrefix}-${index}`}>{part}</span>;
  });
}

const HEADING = /^(#{1,4})\s+(.*)$/;
const BULLET = /^-\s+/;
const ORDERED = /^\d+\.\s+/;

/**
 * 강의자료용 최소 마크다운 렌더러.
 * 제목(#~####) · 목록(-, 1.) · 굵게(**), 문단만 지원한다(외부 의존성 없이 송출).
 */
export default function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const lines = text.split('\n');
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      i += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1].length;
      const content = inline(heading[2], `h${key}`);
      key += 1;
      if (level === 1) {
        nodes.push(
          <h1 key={`node-${key}`} className="text-[1.6em] font-black leading-tight">
            {content}
          </h1>
        );
      } else if (level === 2) {
        nodes.push(
          <h2 key={`node-${key}`} className="text-[1.3em] font-bold">
            {content}
          </h2>
        );
      } else {
        nodes.push(
          <h3 key={`node-${key}`} className="text-[1.1em] font-bold opacity-90">
            {content}
          </h3>
        );
      }
      i += 1;
      continue;
    }

    if (BULLET.test(line)) {
      const items: string[] = [];
      while (i < lines.length && BULLET.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(BULLET, ''));
        i += 1;
      }
      const listKey = key;
      key += 1;
      nodes.push(
        <ul
          key={`node-${listKey}`}
          className="list-disc space-y-1.5 pl-6 marker:text-current"
        >
          {items.map((item, index) => (
            <li key={index}>{inline(item, `li${listKey}-${index}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (ORDERED.test(line)) {
      const items: string[] = [];
      while (i < lines.length && ORDERED.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(ORDERED, ''));
        i += 1;
      }
      const listKey = key;
      key += 1;
      nodes.push(
        <ol key={`node-${listKey}`} className="list-decimal space-y-1.5 pl-6 marker:font-semibold">
          {items.map((item, index) => (
            <li key={index}>{inline(item, `ol${listKey}-${index}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length) {
      const current = lines[i].trim();
      if (!current || HEADING.test(current) || BULLET.test(current) || ORDERED.test(current)) {
        break;
      }
      paragraph.push(lines[i]);
      i += 1;
    }
    const paraKey = key;
    key += 1;
    nodes.push(
      <p key={`node-${paraKey}`} className="whitespace-pre-wrap leading-relaxed">
        {inline(paragraph.join('\n'), `p${paraKey}`)}
      </p>
    );
  }

  return <div className={`space-y-4 ${className}`}>{nodes}</div>;
}
