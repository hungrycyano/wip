// @ts-check
import { defineConfig } from 'astro/config';

// GitHub Pages の公開先。リポジトリ名を変えたら base も合わせて変える。
// 例：https://<ユーザー名>.github.io/<リポジトリ名>/
export default defineConfig({
  site: 'https://hungrycyano.github.io',
  base: '/wip',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
