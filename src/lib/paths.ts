// GitHub Pages のサブパス（/wip/ など）を付けたURLを作る。
// サイト内のリンクと画像は、必ずこれを通すこと。
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

export function withBase(path: string): string {
  if (/^[a-z]+:\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${BASE}${clean}`;
}

export function workUrl(id: string): string {
  return withBase(`/works/${id}/`);
}
