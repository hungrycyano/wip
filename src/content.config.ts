import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { KIND_IDS } from './lib/kinds';
import { STATUS_VALUES } from './lib/statuses';

// 作品：src/works/<作品ID>.md（1作品＝1ファイル）。
// 長編の章分け（src/works/<作品ID>/01.md …）は第3段階で別に読み込む予定なので、
// ここでは直下の .md だけを対象にしている。
const works = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/works' }),
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

export const collections = { works };
