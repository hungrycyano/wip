// 本文の表示部品。公開ページと編集画面のプレビューは、必ずこの関数で本文を作る。
// （ブラウザ内でも動くよう、Node専用の機能は使わない）
import { Marked } from 'marked';
import { keepsLineBreaks } from './kinds';

const plain = new Marked({ gfm: true, breaks: false });
const withBreaks = new Marked({ gfm: true, breaks: true });

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 縦書きのときに縦中横にする、短い半角英数字（2026 のような長いものは横に寝かせる）。
// &amp; などの文字参照は書き換えないよう、先に拾って素通しする。
const TCY = /(&[#\w]+;)|(?<![0-9A-Za-z])([0-9]{1,3}|[A-Za-z]{1,2}|[!?]{1,2})(?![0-9A-Za-z!?])/g;

function addTcy(text: string): string {
  return text.replace(TCY, (m, entity: string | undefined) =>
    entity ? m : `<span class="tcy">${m}</span>`,
  );
}

// 日本語の文の途中の改行（Markdownでは段落内の改行）が、
// ブラウザによって空白に見えるのを防ぐ。
const CJK_NEWLINE = /([^\x00-\x7F])\n(?=[^\x00-\x7F])/g;

/** HTMLのうち、タグの外の文字だけを書き換える（pre/code の中は触らない） */
function mapText(html: string, fn: (text: string) => string): string {
  let inCode = 0;
  return html
    .split(/(<[^>]+>)/)
    .map((part) => {
      if (part.startsWith('<')) {
        if (/^<(pre|code)[\s>]/i.test(part)) inCode++;
        else if (/^<\/(pre|code)>/i.test(part)) inCode = Math.max(0, inCode - 1);
        return part;
      }
      return inCode > 0 ? part : fn(part);
    })
    .join('');
}

export function renderInline(text: string): string {
  return addTcy(escapeHtml(text));
}

export function renderBody(markdown: string, kind: string): string {
  const keep = keepsLineBreaks(kind);
  const md = keep ? withBreaks : plain;
  const html = md.parse(markdown, { async: false }) as string;
  return mapText(html, (t) => addTcy(keep ? t : t.replace(CJK_NEWLINE, '$1')));
}

/** 空白・改行を除いた文字数（絵文字なども1文字と数える） */
export function countChars(text: string): number {
  return Array.from(text.replace(/\s+/g, '')).length;
}

/** 本文のHTMLから文字数を数える（ビルド時用） */
export function countCharsInHtml(html: string): number {
  const text = html
    .replace(/<[^>]+>/g, '')
    .replace(/&(lt|gt|amp|quot|#39);/g, 'x');
  return countChars(text);
}

export function formatDate(d: Date | string): string {
  if (typeof d === 'string') return d;
  return d.toISOString().slice(0, 10);
}
