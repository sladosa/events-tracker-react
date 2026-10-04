// Odgovor Help AI-ja kao lagani markdown — v. `src/lib/helpMarkdown.ts` (S160).
import { Fragment } from 'react';
import { parseHelpMarkdown, type Inline } from '@/lib/helpMarkdown';

function InlineText({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.t === 'bold' ? <strong key={i} className="font-semibold">{p.v}</strong>
        : p.t === 'code' ? <code key={i} className="px-1 rounded bg-gray-200/70 text-[0.85em] font-mono">{p.v}</code>
        : <Fragment key={i}>{p.v}</Fragment>,
      )}
    </>
  );
}

export function HelpMarkdown({ text }: { text: string }) {
  const blocks = parseHelpMarkdown(text);
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        if (b.kind === 'heading') return <p key={i} className="font-semibold"><InlineText parts={b.text} /></p>;
        if (b.kind === 'code') {
          return <pre key={i} className="text-xs font-mono bg-gray-200/70 rounded p-2 overflow-x-auto whitespace-pre">{b.text}</pre>;
        }
        if (b.kind === 'list') {
          const Tag = b.ordered ? 'ol' : 'ul';
          return (
            <Tag key={i} className={`${b.ordered ? 'list-decimal' : 'list-disc'} pl-5 space-y-0.5`}>
              {b.items.map((it, j) => <li key={j}><InlineText parts={it} /></li>)}
            </Tag>
          );
        }
        return (
          <p key={i}>
            {b.lines.map((l, j) => (
              <Fragment key={j}>{j > 0 && <br />}<InlineText parts={l} /></Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
