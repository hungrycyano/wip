// 作品ファイル（先頭情報＋本文のMarkdown）の読み込みと書き出し。編集画面で使う。
// 書き出す形は README・指示書の例と同じ並び順にそろえる。
import { load } from 'js-yaml';

export interface LogItem {
  date: string;
  note: string;
}

export interface WorkFields {
  title: string;
  summary: string;
  kind: string;
  status: string;
  tags: string[];
  created: string;
  updated: string;
  thumbnail: string;
  background: string;
  audio: string;
  draft: boolean;
  log: LogItem[];
}

export function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function emptyFields(kind: string, status: string): WorkFields {
  const t = today();
  return {
    title: '',
    summary: '',
    kind,
    status,
    tags: [],
    created: t,
    updated: t,
    thumbnail: '',
    background: '',
    audio: '',
    draft: false,
    log: [],
  };
}

function toDateString(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  return v == null ? '' : String(v);
}

const str = (v: unknown) => (v == null ? '' : String(v));

/** Markdownファイルを、先頭情報と本文に分ける。先頭情報が読めないときは例外を投げる */
export function parseWorkFile(text: string, defaults: WorkFields): { fields: WorkFields; body: string } {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const m = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(src);
  if (!m) return { fields: { ...defaults }, body: src };
  const raw = (load(m[1]) ?? {}) as Record<string, unknown>;
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('先頭情報の形が正しくありません');
  const tags = Array.isArray(raw.tags) ? raw.tags.map(str) : raw.tags ? [str(raw.tags)] : [];
  const log = Array.isArray(raw.log)
    ? raw.log.map((l) => {
        const o = (l ?? {}) as Record<string, unknown>;
        return { date: toDateString(o.date), note: str(o.note) };
      })
    : [];
  return {
    fields: {
      title: str(raw.title),
      summary: str(raw.summary),
      kind: raw.kind == null ? defaults.kind : str(raw.kind),
      status: raw.status == null ? defaults.status : str(raw.status),
      tags,
      created: toDateString(raw.created) || defaults.created,
      updated: toDateString(raw.updated) || defaults.updated,
      thumbnail: str(raw.thumbnail),
      background: str(raw.background),
      audio: str(raw.audio),
      draft: raw.draft === true,
      log,
    },
    body: src.slice(m[0].length).replace(/^\n+/, ''),
  };
}

// YAMLとして特別な意味を持つ書き方のときだけ、引用符で囲む
function q(s: string): string {
  if (s === '') return '""';
  const special =
    /^[\s\-?:,\[\]{}#&*!|>'"%@`]/.test(s) ||
    /\s$/.test(s) ||
    /: |\s#|\n/.test(s) ||
    /:$/.test(s) ||
    /^(true|false|yes|no|on|off|null|~)$/i.test(s) ||
    /^[-+]?(\d[\d_]*)?\.?\d+([eE][-+]?\d+)?$/.test(s) ||
    /^\d{4}-\d\d-\d\d/.test(s);
  return special ? JSON.stringify(s) : s;
}

const qTag = (s: string) => (/[,\[\]{}]/.test(s) ? JSON.stringify(s) : q(s));

/** 先頭情報つきのMarkdownにする */
export function serializeWork(f: WorkFields, body: string): string {
  const lines = ['---', `title: ${q(f.title)}`, `summary: ${q(f.summary)}`, `kind: ${q(f.kind)}`, `status: ${q(f.status)}`];
  lines.push(`tags: [${f.tags.map(qTag).join(', ')}]`);
  lines.push(`created: ${f.created}`, `updated: ${f.updated}`);
  if (f.thumbnail) lines.push(`thumbnail: ${q(f.thumbnail)}`);
  if (f.background) lines.push(`background: ${q(f.background)}`);
  if (f.audio) lines.push(`audio: ${q(f.audio)}`);
  lines.push(`draft: ${f.draft ? 'true' : 'false'}`);
  const log = f.log.filter((l) => l.note.trim() || l.date);
  if (log.length) {
    lines.push('log:');
    for (const l of log) lines.push(`  - date: ${l.date || today()}`, `    note: ${q(l.note)}`);
  }
  lines.push('---', '');
  return `${lines.join('\n')}\n${body.replace(/\s+$/, '')}\n`;
}
