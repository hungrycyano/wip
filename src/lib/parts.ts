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

const num = (n: number) => n.toLocaleString('ja-JP');

/** 状態・日付・文字数・タグ・更新メモ（chapters を渡すと「全○章・○字」と出す） */
export function metaHtml(data: WorkData, chars: number, opts: { chapters?: number } = {}): string {
  const log = (data.log ?? [])
    .map((l) => `<li><time>${escapeHtml(formatDate(l.date))}</time><span>${escapeHtml(l.note)}</span></li>`)
    .join('');
  return (
    `<div class="meta-line">` +
    statusLabelHtml(data.status) +
    `<span class="kind">${escapeHtml(kindLabel(data.kind))}</span>` +
    `<span class="date">最終更新 <time>${escapeHtml(formatDate(data.updated))}</time></span>` +
    `<span class="chars">${opts.chapters ? `全${opts.chapters}章・${num(chars)}字` : `本文 ${num(chars)}字`}</span>` +
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

// ---------- 一覧のカード ----------

export interface CardData {
  url: string;
  data: WorkData & { thumbnail?: string };
  /** サムネイル画像のURL（編集画面では手元のファイルを指すこともある）。なければ代わりの表示 */
  thumbSrc?: string;
  chapters?: number;
}

/** 一覧の1件分（li の中身）。トップページと編集画面の「一覧での見え方」で共通 */
export function cardHtml(c: CardData): string {
  const d = c.data;
  const url = escapeHtml(c.url);
  const thumb = c.thumbSrc
    ? `<img src="${escapeHtml(c.thumbSrc)}" alt="" loading="lazy" decoding="async" />`
    : `<span class="thumb thumb-fallback status-${statusKey(d.status)}">${escapeHtml(kindLabel(d.kind))}</span>`;
  const updated = escapeHtml(formatDate(d.updated));
  return (
    `<a class="thumb" href="${url}" tabindex="-1" aria-hidden="true">${thumb}</a>` +
    `<div class="card-body">` +
    `<h2 class="card-title"><a href="${url}">${escapeHtml(d.title)}</a></h2>` +
    (d.summary ? `<p class="card-summary">${escapeHtml(d.summary)}</p>` : '') +
    `<div class="card-meta">` +
    statusLabelHtml(d.status) +
    `<span class="kind">${escapeHtml(kindLabel(d.kind))}</span>` +
    (c.chapters ? `<span class="chapters">全${c.chapters}章</span>` : '') +
    `<span class="date">最終更新 <time datetime="${updated}">${updated}</time></span>` +
    `</div>` +
    tagListHtml(d.tags ?? []) +
    `<p class="search-excerpt" data-excerpt hidden></p>` +
    `</div>`
  );
}

// ---------- 章分けした長編 ----------

export interface TocItem {
  url: string;
  title: string;
  chars: number;
}

/** 目次 */
export function tocHtml(items: TocItem[]): string {
  if (!items.length) return '';
  const li = items
    .map(
      (it, i) =>
        `<li><a href="${escapeHtml(it.url)}"><span class="toc-no">${i + 1}</span>` +
        `<span class="toc-title">${escapeHtml(it.title)}</span></a>` +
        `<span class="toc-chars">${num(it.chars)}字</span></li>`,
    )
    .join('');
  return `<nav class="toc" aria-label="目次"><h2>目次</h2><ol>${li}</ol></nav>`;
}

/** 章の本文（作品名＋章の題名＋本文）。縦書き・横書きの切り替え対象 */
export function chapterArticleHtml(
  c: { workTitle: string; title: string; kind: string; no?: number },
  markdown: string,
): string {
  return (
    `<p class="chapter-work">${renderInline(c.workTitle)}</p>` +
    `<h1 class="work-title">${c.no ? `<span class="chapter-no">${renderInline(String(c.no))}</span>` : ''}${renderInline(c.title)}</h1>` +
    `<div class="work-body">${renderBody(markdown, c.kind)}</div>`
  );
}

/** 章の下の「前の章／目次／次の章」 */
export function chapterNavHtml(n: {
  prev?: { url: string; title: string };
  next?: { url: string; title: string };
  toc: string;
}): string {
  const link = (cls: string, label: string, it?: { url: string; title: string }) =>
    it
      ? `<a class="${cls}" href="${escapeHtml(it.url)}" rel="${cls === 'prev' ? 'prev' : 'next'}"><small>${label}</small>${escapeHtml(it.title)}</a>`
      : `<span class="${cls}"></span>`;
  return (
    `<nav class="chapter-nav" aria-label="章の移動">` +
    link('prev', '← 前の章', n.prev) +
    `<a class="toc-link" href="${escapeHtml(n.toc)}">目次</a>` +
    link('next', '次の章 →', n.next) +
    `</nav>`
  );
}

/** 章ページの情報（何章目か・文字数・作品の状態） */
export function chapterMetaHtml(work: WorkData, no: number, total: number, chars: number): string {
  return (
    `<div class="meta-line">` +
    statusLabelHtml(work.status) +
    `<span class="kind">${escapeHtml(kindLabel(work.kind))}</span>` +
    `<span class="chars">第${no}章／全${total}章・${num(chars)}字</span>` +
    `<span class="date">作品の最終更新 <time>${escapeHtml(formatDate(work.updated))}</time></span>` +
    `</div>`
  );
}
