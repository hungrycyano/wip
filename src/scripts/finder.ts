// トップページの検索（Pagefind）と、状態・種類・タグの絞り込み。
// 絞り込みは URL（?tag=海&status=改稿中 など）にも残すので、作品ページのタグから飛んでこられる。

type Pagefind = {
  options: (o: Record<string, unknown>) => Promise<void>;
  search: (q: string) => Promise<{ results: { data: () => Promise<{ url: string; excerpt: string }> }[] }>;
};

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');
const FILTERS = ['status', 'kind', 'tag'] as const;

const norm = (u: string) => (u.endsWith('/') ? u : `${u}/`);

let pagefindPromise: Promise<Pagefind | null> | null = null;
function loadPagefind(): Promise<Pagefind | null> {
  pagefindPromise ??= (async () => {
    try {
      const url = `${BASE}/pagefind/pagefind.js`;
      const pf = (await import(/* @vite-ignore */ url)) as Pagefind;
      await pf.options({ baseUrl: `${BASE}/` });
      return pf;
    } catch {
      return null;
    }
  })();
  return pagefindPromise;
}

export function initFinder() {
  const form = document.querySelector<HTMLFormElement>('[data-finder]');
  const list = document.querySelector<HTMLElement>('[data-list]');
  if (!form || !list) return;
  const cards = [...list.querySelectorAll<HTMLElement>('.work-card')];
  const q = form.querySelector<HTMLInputElement>('input[name="q"]')!;
  const count = document.querySelector<HTMLElement>('[data-count]');
  const empty = document.querySelector<HTMLElement>('[data-empty]');
  const note = form.querySelector<HTMLElement>('[data-search-note]');

  // 検索結果（null は「検索していない」）
  let hits: Map<string, string> | null = null;
  let seq = 0;

  const value = (name: string) =>
    form.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value ?? '';

  const apply = () => {
    const status = value('status');
    const kind = value('kind');
    const tag = value('tag');
    let shown = 0;
    for (const card of cards) {
      const tags: string[] = JSON.parse(card.dataset.tags || '[]');
      const ok =
        (!status || card.dataset.status === status) &&
        (!kind || card.dataset.kind === kind) &&
        (!tag || tags.includes(tag)) &&
        (!hits || hits.has(norm(card.dataset.url!)));
      card.hidden = !ok;
      const ex = card.querySelector<HTMLElement>('[data-excerpt]');
      if (ex) {
        const html = hits?.get(norm(card.dataset.url!));
        ex.hidden = !html;
        ex.innerHTML = html ? `…${html}…` : '';
      }
      if (ok) shown++;
    }
    if (count) count.textContent = `${shown}件`;
    if (empty) empty.hidden = shown > 0;
  };

  const syncUrl = () => {
    const params = new URLSearchParams();
    if (q.value.trim()) params.set('q', q.value.trim());
    for (const f of FILTERS) if (value(f)) params.set(f, value(f));
    const s = params.toString();
    history.replaceState(null, '', s ? `?${s}` : location.pathname);
  };

  const runSearch = async () => {
    const term = q.value.trim();
    const my = ++seq;
    if (!term) {
      hits = null;
      if (note) note.hidden = true;
      apply();
      return;
    }
    const pf = await loadPagefind();
    if (my !== seq) return;
    if (!pf) {
      if (note) {
        note.hidden = false;
        note.textContent = '検索は、ビルドして公開したサイトで使えます（開発中の画面では動きません）。';
      }
      return;
    }
    const res = await pf.search(term);
    const data = await Promise.all(res.results.map((r) => r.data()));
    if (my !== seq) return;
    hits = new Map(data.map((d) => [norm(d.url), d.excerpt]));
    if (note) note.hidden = true;
    apply();
  };

  // URL の指定を反映
  const params = new URLSearchParams(location.search);
  for (const f of FILTERS) {
    const v = params.get(f);
    if (!v) continue;
    const input = [...form.querySelectorAll<HTMLInputElement>(`input[name="${f}"]`)].find((i) => i.value === v);
    if (input) input.checked = true;
  }
  if (params.get('q')) q.value = params.get('q')!;

  let timer = 0;
  q.addEventListener('input', () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      syncUrl();
      runSearch();
    }, 250);
  });
  form.addEventListener('change', (e) => {
    if ((e.target as HTMLElement).matches('input[type="radio"]')) {
      syncUrl();
      apply();
    }
  });

  apply();
  if (q.value) runSearch();
  else if (q === document.activeElement) loadPagefind();
  q.addEventListener('focus', () => loadPagefind(), { once: true });
}
