import { getCollection, type CollectionEntry } from 'astro:content';

export type Work = CollectionEntry<'works'>;
export type Chapter = CollectionEntry<'chapters'>;

const visible = (draft: boolean) => (import.meta.env.PROD ? !draft : true);

/** 公開する作品を、新しく更新した順に返す（draft: true は本番では出さない） */
export async function getPublishedWorks(): Promise<Work[]> {
  const all = await getCollection('works', (w) => visible(w.data.draft));
  return all.sort(
    (a, b) =>
      b.data.updated.getTime() - a.data.updated.getTime() ||
      b.data.created.getTime() - a.data.created.getTime() ||
      a.data.title.localeCompare(b.data.title, 'ja'),
  );
}

/** 章のファイル名（拡張子なし）。test-novel/01 → 01 */
export const chapterSlug = (c: Chapter) => c.id.slice(c.id.indexOf('/') + 1);
/** 章が属する作品ID。test-novel/01 → test-novel */
export const chapterWorkId = (c: Chapter) => c.id.slice(0, c.id.indexOf('/'));

let chaptersCache: Promise<Chapter[]> | null = null;

/** すべての公開する章（ファイル名の数字順）。index.md のないフォルダがあればビルドを止めて知らせる */
async function allChapters(): Promise<Chapter[]> {
  chaptersCache ??= (async () => {
    const chapters = await getCollection('chapters', (c) => visible(c.data.draft));
    const works = await getCollection('works');
    const folders = new Set(works.filter((w) => w.filePath?.endsWith('/index.md')).map((w) => w.id));
    const orphans = [...new Set(chapters.map(chapterWorkId))].filter((id) => !folders.has(id));
    if (orphans.length) {
      throw new Error(
        `章のフォルダに index.md（作品の情報）がありません：${orphans.map((id) => `src/works/${id}/`).join('、')}`,
      );
    }
    return chapters.sort((a, b) => a.id.localeCompare(b.id, 'ja', { numeric: true }));
  })();
  return chaptersCache;
}

export async function getChapters(workId: string): Promise<Chapter[]> {
  return (await allChapters()).filter((c) => chapterWorkId(c) === workId);
}

/** 章分けした長編（src/works/<ID>/index.md）か */
export const isFolderWork = (w: Work) => !!w.filePath?.endsWith('/index.md');
