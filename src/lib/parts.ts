// 作品ページの表示部品（HTMLを文字列で作る）。
// 公開ページ（Astro）と編集画面のプレビュー（ブラウザ）の両方から使い、見た目を必ずそろえる。
import { kindLabel } from './kinds';
import { statusKey } from './statuses';
import { withBase } from './paths';
import { countCharsInHtml, escapeHtml, formatDate, renderBody, renderInline } from './render';

export interface WorkData {
  title: string;
  summary?: string;
  kind: string;
  status: string;
  tags?: string[];
  created: Date | string;
  updated: Date | string;
  log?: { date: Date | string; note: string }[];
}

const STATUS_MARK: Record<string, string> = { drafting: '○', revising: '◐', done: '●' };

export function statusLabelHtml(status: string): string {
  const key = statusKey(status);
  return (
    `<span class="status status-${key}">` +
    `<span class="status-mark" aria-hidden="true">${STATUS_MARK[key] ?? '・'}</span>` +
    `${escapeHtml(status)}</span>`
  );
}

export function tagListHtml(tags: string[]): string {
  if (!tags.length) return '';
  const items = tags
    .map((t) => `<li><a class="tag" href="${withBase(`/?tag=${encodeURIComponent(t)}`)}">#${escapeHtml(t)}</a></li>`)
    .join('');
  return `<ul class="tags" aria-label="タグ">${items}</ul>`;
}

/** 本文（題名＋本文）。縦書き・横書きの切り替え対象になる部分 */
export function articleHtml(data: Pick<WorkData, 'title' | 'kind'>, markdown: string): string {
  return (
    `<h1 class="work-title">${renderInline(data.title)}</h1>` +
    `<div class="work-body">${renderBody(markdown, data.kind)}</div>`
  );
}

/** 状態・日付・文字数・タグ・更新メモ */
export function metaHtml(data: WorkData, chars: number): string {
  const log = (data.log ?? [])
    .map((l) => `<li><time>${escapeHtml(formatDate(l.date))}</time><span>${escapeHtml(l.note)}</span></li>`)
    .join('');
  return (
    `<div class="meta-line">` +
    statusLabelHtml(data.status) +
    `<span class="kind">${escapeHtml(kindLabel(data.kind))}</span>` +
    `<span class="date">最終更新 <time>${escapeHtml(formatDate(data.updated))}</time></span>` +
    `<span class="chars">本文 ${chars.toLocaleString('ja-JP')}字</span>` +
    `</div>` +
    tagListHtml(data.tags ?? []) +
    (log
      ? `<details class="work-log" open><summary>更新メモ</summary><ol>${log}</ol></details>`
      : '') +
    `<p class="created">書きはじめ <time>${escapeHtml(formatDate(data.created))}</time></p>`
  );
}

export function bodyChars(data: Pick<WorkData, 'kind'>, markdown: string): number {
  return countCharsInHtml(renderBody(markdown, data.kind));
}
