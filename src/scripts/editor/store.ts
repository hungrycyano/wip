// 下書きの保存先（このブラウザの localStorage だけ）。どこにも送信しない。
// 編集画面を2つのタブで開いても消し合わないよう、保存のたびに保存済みの内容と合わせ、
// 下書きごとに新しく保存された方を残す。
import type { WorkFields } from '../../lib/frontmatter';

/** single：1ファイルの作品／index：章分けした長編の index.md／chapter：長編の章 */
export type DraftType = 'single' | 'index' | 'chapter';

export interface Draft {
  key: string; // ブラウザ内での識別用（ファイル名とは別）
  id: string; // 作品ID（章のときは章のファイル名。例：01）
  type?: DraftType; // 書いていないものは single
  work?: string; // 章のとき、属する長編の作品ID
  fields: WorkFields;
  body: string;
  createdAt: number;
  savedAt: number;
  exportedAt: number | null;
  /** 最後に書き出してから変更があるか */
  dirty: boolean;
}

export interface Store {
  current: string | null;
  drafts: Record<string, Draft>;
  /** 削除した下書き（ほかのタブが古い内容で戻さないように覚えておく） */
  deleted: Record<string, number>;
}

export const STORE_KEY = 'wip.drafts.v1';
export const EDITOR_USED_KEY = 'wip.editor.used';

function readDisk(): Store {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (s && typeof s === 'object' && s.drafts) return { current: s.current ?? null, drafts: s.drafts, deleted: s.deleted ?? {} };
  } catch {
    /* 壊れていたら空から始める */
  }
  return { current: null, drafts: {}, deleted: {} };
}

export function loadStore(): Store {
  return readDisk();
}

/** 保存済みの内容を mem に取り込む。新しくなった（または消えた）下書きの key を返す */
export function mergeFromDisk(mem: Store): string[] {
  const disk = readDisk();
  const changed: string[] = [];
  for (const [key, t] of Object.entries(disk.deleted)) {
    if (!mem.deleted[key]) mem.deleted[key] = t;
    if (mem.drafts[key] && mem.drafts[key].savedAt <= t) {
      delete mem.drafts[key];
      changed.push(key);
    }
  }
  for (const [key, d] of Object.entries(disk.drafts)) {
    if (mem.deleted[key] && mem.deleted[key] >= d.savedAt) continue;
    const m = mem.drafts[key];
    if (!m || d.savedAt > m.savedAt) {
      mem.drafts[key] = d;
      changed.push(key);
    }
  }
  return changed;
}

/** 保存できたら true。容量不足などで失敗したら false */
export function saveStore(mem: Store): boolean {
  mergeFromDisk(mem);
  // 削除の記録は30日で忘れる
  const old = Date.now() - 30 * 24 * 3600 * 1000;
  for (const [k, t] of Object.entries(mem.deleted)) if (t < old) delete mem.deleted[k];
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(mem));
    localStorage.setItem(EDITOR_USED_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

export function newKey(): string {
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
