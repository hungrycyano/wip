import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { KIND_IDS } from './lib/kinds';
import { STATUS_VALUES } from './lib/statuses';

// 作品：src/works/<作品ID>.md（1作品＝1ファイル）
// 章分けした長編：src/works/<作品ID>/index.md（作品の情報と、まえがき）＋ 01.md, 02.md …（章）
const works = defineCollection({
  loader: glob({ pattern: ['*.md', '*/index.md'], base: './src/works' }),
  schema: z.object({
    title: z.string().min(1, 'title（作品名）を書いてください'),
    summary: z.string().default(''),
    kind: z.string().refine((v) => KIND_IDS.includes(v), (v) => ({
      message:
        `kind「${v}」は src/config/kinds.json にありません。` +
        `この作品の kind を直すか、kinds.json に戻してください。使える値：${KIND_IDS.join(' / ')}`,
    })),
    status: z.enum(STATUS_VALUES, {
      errorMap: () => ({ message: `status は ${STATUS_VALUES.join(' / ')} のどれかにしてください` }),
    }),
    tags: z.array(z.coerce.string()).default([]),
    created: z.coerce.date(),
    updated: z.coerce.date(),
    thumbnail: z.string().optional(),
    background: z.string().optional(),
    audio: z.string().optional(),
    draft: z.boolean().default(false),
    log: z
      .array(z.object({ date: z.coerce.date(), note: z.string() }))
      .default([]),
  }),
});

// 長編の章：src/works/<作品ID>/01.md など（index.md 以外）。先頭情報は章の題名だけでよい
const chapters = defineCollection({
  loader: glob({ pattern: ['*/*.md', '!*/index.md'], base: './src/works' }),
  schema: z.object({
    title: z.string().min(1, 'title（章の題名）を書いてください'),
    draft: z.boolean().default(false),
    background: z.string().optional(),
    audio: z.string().optional(),
  }),
});

export const collections = { works, chapters };
