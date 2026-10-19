import { getCollection, type CollectionEntry } from 'astro:content';

export type Work = CollectionEntry<'works'>;

/** 公開する作品を、新しく更新した順に返す（draft: true は本番では出さない） */
export async function getPublishedWorks(): Promise<Work[]> {
  const all = await getCollection('works', (w) => (import.meta.env.PROD ? !w.data.draft : true));
  return all.sort(
    (a, b) =>
      b.data.updated.getTime() - a.data.updated.getTime() ||
      b.data.created.getTime() - a.data.created.getTime() ||
      a.data.title.localeCompare(b.data.title, 'ja'),
  );
}
