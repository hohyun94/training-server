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

/** 강의자료용 최소 마크다운 렌더러 (제목 / 목록 / 굵게 / 문단) */
export default function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/);

  return (
    <div className={`space-y-4 ${className}`}>
      {blocks.map((block, blockIndex) => {
        const lines = block.split('\n').filter((line) => line.trim().length > 0);
        if (!lines.length) return null;

        if (lines[0].startsWith('# ')) {
          return (
            <h1 key={blockIndex} className="text-4xl font-black leading-tight">
              {inline(lines[0].slice(2), `h1-${blockIndex}`)}
            </h1>
          );
        }
        if (lines[0].startsWith('## ')) {
          return (
            <h2 key={blockIndex} className="text-2xl font-bold">
              {inline(lines[0].slice(3), `h2-${blockIndex}`)}
            </h2>
          );
        }
        if (lines.every((line) => line.trimStart().startsWith('- '))) {
          return (
            <ul key={blockIndex} className="space-y-2">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex} className="flex gap-2">
                  <span className="mt-[0.95rem] h-2 w-2 shrink-0 rounded-full bg-current opacity-60" />
                  <span>{inline(line.trimStart().slice(2), `li-${blockIndex}-${lineIndex}`)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={blockIndex} className="whitespace-pre-wrap leading-relaxed">
            {inline(blocks[blockIndex], `p-${blockIndex}`)}
          </p>
        );
      })}
    </div>
  );
}
