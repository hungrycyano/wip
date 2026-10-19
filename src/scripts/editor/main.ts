// 編集画面の動き。
// - 入力するたびに、少し待ってからブラウザに自動保存（作品ごと）
// - 書き出し：先頭情報つきのMarkdownをダウンロード
// - 読み込み：Markdownファイル、またはサイトの作品から開く
// - プレビューは公開ページと同じ部品（lib/parts.ts）と同じCSSで作る
// - 参考パネル：選んだファイルをこのブラウザ内だけで表示（保存・送信しない）
import { KIND_IDS } from '../../lib/kinds';
import { STATUS_VALUES } from '../../lib/statuses';
import { articleHtml, bodyChars, metaHtml } from '../../lib/parts';
import { withBase } from '../../lib/paths';
import { emptyFields, parseWorkFile, serializeWork, today, type WorkFields } from '../../lib/frontmatter';
import { STORE_KEY, loadStore, mergeFromDisk, newKey, saveStore, type Draft } from './store';

const SAVE_DELAY = 600;
/** 最後に書き出してから（または書きはじめてから）この時間が過ぎたら、書き出しを促す */
const REMIND_AFTER = 60 * 60 * 1000;
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

type View = 'split' | 'editor' | 'preview';

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [
  ...root.querySelectorAll<T>(sel),
];

const pad = (n: number) => String(n).padStart(2, '0');
const clock = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const splitTags = (s: string) =>
  s
    .split(/[、,，]/)
    .map((t) => t.trim().replace(/^#/, ''))
    .filter(Boolean);

export function initEditor() {
  const app = document.querySelector<HTMLElement>('[data-editor]');
  if (!app) return;

  const store = loadStore();
  const siteWorks: { id: string; title: string; raw: string }[] = JSON.parse(
    document.getElementById('site-works')?.textContent || '[]',
  );

  const els = {
    draftSelect: $<HTMLSelectElement>('[data-draft-select]', app),
    siteSelect: $<HTMLSelectElement>('[data-site-select]', app),
    importInput: $<HTMLInputElement>('[data-import]', app),
    refInput: $<HTMLInputElement>('[data-ref-input]', app),
    saved: $('[data-saved]', app),
    dirty: $('[data-dirty]', app),
    touchUpdated: $<HTMLInputElement>('[data-touch-updated]', app),
    banner: $('[data-banner]', app),
    bannerText: $('[data-banner-text]', app),
    message: $('[data-message]', app),
    main: $('[data-main]', app),
    id: $<HTMLInputElement>('[data-id]', app),
    idNote: $('[data-id-note]', app),
    log: $('[data-log]', app),
    body: $<HTMLTextAreaElement>('[data-body]', app),
    count: $('[data-count]', app),
    prevPage: $('[data-preview-page]', app),
    prevAudio: $('[data-preview-audio]', app),
    prevArticle: $('[data-preview-article]', app),
    prevMeta: $('[data-preview-meta]', app),
    ref: $('[data-ref]', app),
    refName: $('[data-ref-name]', app),
    refBody: $('[data-ref-body]', app),
  };
  const field = <T extends HTMLElement = HTMLInputElement>(name: string) => $<T & HTMLElement>(`[data-f="${name}"]`, app);
  const kindSelect = field<HTMLSelectElement>('kind');

  let cur: Draft;
  let saveTimer = 0;
  let view: View = 'split';
  let refUrl: string | null = null;

  // ---------- 下書きの作成・切り替え ----------

  function makeDraft(fields: WorkFields, body: string, id = ''): Draft {
    const now = Date.now();
    const d: Draft = { key: newKey(), id, fields, body, createdAt: now, savedAt: now, exportedAt: null, dirty: true };
    store.drafts[d.key] = d;
    return d;
  }

  const defaults = () => emptyFields(KIND_IDS[0] ?? '', STATUS_VALUES[0]);

  function sortedDrafts(): Draft[] {
    return Object.values(store.drafts).sort((a, b) => b.savedAt - a.savedAt);
  }

  function renderDraftSelect() {
    els.draftSelect.innerHTML = '';
    for (const d of sortedDrafts()) {
      const o = document.createElement('option');
      o.value = d.key;
      const name = d.fields.title || '（題名なし）';
      o.textContent = `${d.dirty ? '● ' : ''}${name}${d.id ? `（${d.id}）` : ''}`;
      els.draftSelect.append(o);
    }
    els.draftSelect.value = cur.key;
  }

  function switchTo(d: Draft) {
    flushSave();
    cur = d;
    store.current = d.key;
    fillForm();
    // 題名がまだない下書きは「作品の情報」を開き、書きかけの作品は本文がすぐ見えるよう閉じておく
    $<HTMLDetailsElement>('.ed-fields', app).open = !d.fields.title;
    renderDraftSelect();
    renderPreview();
    renderStatus();
    saveNow();
  }

  // ---------- フォーム ----------

  function ensureKindOption(kind: string) {
    $$('option[data-unknown]', kindSelect).forEach((o) => o.remove());
    if (kind && !KIND_IDS.includes(kind)) {
      const o = document.createElement('option');
      o.value = kind;
      o.dataset.unknown = '';
      o.textContent = `${kind}（kinds.json にない種類）`;
      kindSelect.append(o);
      showMessage(`種類「${kind}」は src/config/kinds.json にありません。このまま公開するとビルドエラーになります。`, true);
    }
  }

  function fillForm() {
    const f = cur.fields;
    ensureKindOption(f.kind);
    for (const name of ['title', 'summary', 'kind', 'status', 'created', 'updated', 'thumbnail', 'background', 'audio']) {
      field<HTMLInputElement>(name).value = (f as unknown as Record<string, string>)[name] ?? '';
    }
    field<HTMLInputElement>('tags').value = f.tags.join('、');
    field<HTMLInputElement>('draft').checked = f.draft;
    els.id.value = cur.id;
    els.body.value = cur.body;
    renderLog();
    checkId();
  }

  function readForm() {
    const f = cur.fields;
    const v = (name: string) => field<HTMLInputElement>(name).value;
    f.title = v('title');
    f.summary = v('summary');
    f.kind = v('kind');
    f.status = v('status');
    f.tags = splitTags(v('tags'));
    f.created = v('created');
    f.updated = v('updated');
    f.thumbnail = v('thumbnail').trim();
    f.background = v('background').trim();
    f.audio = v('audio').trim();
    f.draft = field<HTMLInputElement>('draft').checked;
    cur.id = els.id.value.trim();
    cur.body = els.body.value;
  }

  function renderLog() {
    els.log.innerHTML = '';
    cur.fields.log.forEach((l, i) => {
      const li = document.createElement('li');
      li.innerHTML =
        `<input type="date" aria-label="日付" />` +
        `<input type="text" aria-label="メモ" placeholder="直したことを一言" />` +
        `<button type="button" class="ed-quiet" aria-label="このメモを消す">消す</button>`;
      const [date, note] = $$<HTMLInputElement>('input', li);
      date.value = l.date;
      note.value = l.note;
      date.addEventListener('input', () => {
        l.date = date.value;
        changed();
      });
      note.addEventListener('input', () => {
        l.note = note.value;
        changed();
      });
      $('button', li).addEventListener('click', () => {
        cur.fields.log.splice(i, 1);
        renderLog();
        changed();
      });
      els.log.append(li);
    });
  }

  function checkId(): boolean {
    const ok = ID_PATTERN.test(cur.id);
    els.idNote.textContent = !cur.id
      ? '半角英小文字・数字・ハイフン。公開URLになります。'
      : ok
        ? `書き出すファイル名：${cur.id}.md`
        : '使えるのは半角英小文字・数字・ハイフン・下線だけです（先頭は英数字）。';
    els.idNote.classList.toggle('ed-error', !!cur.id && !ok);
    return ok;
  }

  // ---------- プレビュー（公開ページと同じ部品） ----------

  function renderPreview() {
    const f = cur.fields;
    els.prevArticle.innerHTML = articleHtml(f, cur.body);
    els.prevMeta.innerHTML = metaHtml(f, bodyChars(f, cur.body));
    els.count.textContent = `本文 ${bodyChars(f, cur.body).toLocaleString('ja-JP')}字`;
    els.prevPage.classList.toggle('has-bg', !!f.background);
    els.prevPage.style.backgroundImage = f.background ? `url("${withBase(f.background)}")` : '';
    const audio = els.prevAudio.querySelector('audio');
    if (f.audio) {
      const src = withBase(f.audio);
      if (!audio || audio.getAttribute('src') !== src) {
        els.prevAudio.innerHTML = `<audio controls preload="none"></audio>`;
        els.prevAudio.querySelector('audio')!.setAttribute('src', src);
      }
      els.prevAudio.hidden = false;
    } else {
      els.prevAudio.hidden = true;
      els.prevAudio.innerHTML = '';
    }
  }

  // プレビュー内のリンクで画面を移動しない
  els.prevPage.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) e.preventDefault();
  });

  // ---------- 保存・状態表示 ----------

  function saveNow() {
    window.clearTimeout(saveTimer);
    saveTimer = 0;
    const ok = saveStore(store);
    // 別のタブで、この下書きがもっと新しく保存されていたら、そちらに合わせる
    if (store.drafts[cur.key] !== cur) adoptCurrent();
    if (!ok) {
      showMessage('ブラウザに保存できませんでした（容量がいっぱいの可能性があります）。今すぐ書き出してください。', true);
      return;
    }
    renderStatus();
  }

  /** 保存済みの内容が変わったあと、表示中の下書きを合わせる */
  function adoptCurrent() {
    const fresh = store.drafts[cur.key];
    if (fresh) {
      cur = fresh;
      fillForm();
      showMessage('別のタブで保存された内容を反映しました。');
    } else {
      cur = sortedDrafts()[0] ?? makeDraft(defaults(), '');
      store.current = cur.key;
      fillForm();
      showMessage('表示していた下書きは、別のタブで削除されました。');
    }
    renderDraftSelect();
    renderPreview();
  }

  function flushSave() {
    if (saveTimer) saveNow();
  }

  function changed() {
    cur.savedAt = Date.now();
    cur.dirty = true;
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveNow();
      renderDraftSelect();
    }, SAVE_DELAY);
    renderPreview();
    els.dirty.hidden = false;
  }

  function renderStatus() {
    els.saved.textContent = saveTimer ? '保存待ち…' : `ブラウザに保存 ${clock(cur.savedAt)}`;
    els.dirty.hidden = !cur.dirty;
    const stale = (d: Draft) => d.dirty && Date.now() - (d.exportedAt ?? d.createdAt) > REMIND_AFTER;
    const others = Object.values(store.drafts).filter((d) => d.key !== cur.key && stale(d)).length;
    const remind = stale(cur);
    els.banner.hidden = !remind && others === 0;
    els.bannerText.textContent = [
      remind
        ? cur.exportedAt
          ? `前回の書き出し（${new Date(cur.exportedAt).toLocaleString('ja-JP')}）から時間がたっています。`
          : 'この下書きはまだ一度も書き出していません。'
        : '',
      others ? `${remind ? 'ほかにも、' : ''}しばらく書き出していない下書きが${others}件あります。` : '',
      'ブラウザのデータを消すと、下書きも消えます。',
    ]
      .filter(Boolean)
      .join(' ');
    $$<HTMLButtonElement>('[data-banner] [data-act="export"]', app).forEach((b) => (b.hidden = !remind));
  }

  let messageTimer = 0;
  function showMessage(text: string, warn = false) {
    els.message.textContent = text;
    els.message.hidden = false;
    els.message.classList.toggle('ed-error', warn);
    window.clearTimeout(messageTimer);
    messageTimer = window.setTimeout(() => (els.message.hidden = true), warn ? 12000 : 5000);
  }

  // ---------- 書き出し・読み込み ----------

  function exportCurrent() {
    readForm();
    if (!cur.fields.title.trim()) {
      showMessage('題名を書いてから書き出してください。', true);
      field('title').focus();
      return;
    }
    if (!checkId()) {
      showMessage('作品ID（ファイル名）を、半角英小文字・数字・ハイフンで決めてください。', true);
      els.id.focus();
      return;
    }
    if (els.touchUpdated.checked) {
      cur.fields.updated = today();
      field<HTMLInputElement>('updated').value = cur.fields.updated;
    }
    const text = serializeWork(cur.fields, cur.body);
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cur.id}.md`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    cur.exportedAt = Date.now();
    cur.savedAt = cur.exportedAt;
    cur.dirty = false;
    renderPreview();
    saveNow();
    renderDraftSelect();
    showMessage(`「${cur.id}.md」を書き出しました。公開するには、リポジトリの src/works/ に置いてください。`);
  }

  /** ファイルの中身を下書きとして開く。同じ作品IDの下書きがあれば、置きかえるか聞く（quiet のときは聞かずに置きかえる） */
  function openText(text: string, id: string, source: string, quiet = false) {
    let parsed;
    try {
      parsed = parseWorkFile(text, defaults());
    } catch (e) {
      showMessage(`${source}の先頭情報を読めませんでした：${(e as Error).message}`, true);
      return;
    }
    const same = Object.values(store.drafts).find((d) => d.id === id);
    if (same) {
      const overwrite = quiet || window.confirm(
        `作品ID「${id}」の下書きがすでにあります。\n\n` +
          `OK：その下書きを、${source}の内容で置きかえる\n` +
          `キャンセル：別の下書きとして開く`,
      );
      if (overwrite) {
        same.fields = parsed.fields;
        same.body = parsed.body;
        same.savedAt = Date.now();
        same.dirty = false;
        same.exportedAt = Date.now();
        switchTo(same);
        openedMessage(source);
        return;
      }
    }
    const d = makeDraft(parsed.fields, parsed.body, id);
    // サイトやファイルと同じ内容なので、まだ「書き出していない変更」はない
    d.dirty = false;
    d.exportedAt = Date.now();
    switchTo(d);
    openedMessage(source);
  }

  // 種類が kinds.json にないときは、その警告を残す
  function openedMessage(source: string) {
    if (KIND_IDS.includes(cur.fields.kind)) showMessage(`${source}から開きました。`);
  }

  function openSiteWork(id: string, quiet = false): boolean {
    const w = siteWorks.find((s) => s.id === id);
    if (!w) return false;
    openText(w.raw, w.id, 'サイトの作品', quiet);
    return true;
  }

  // ---------- 画面の分け方・参考パネル ----------

  function setView(v: View) {
    view = v;
    if (!els.ref.hidden) closeRef();
    applyView();
  }

  function applyView() {
    const refOpen = !els.ref.hidden;
    els.main.dataset.view = refOpen ? 'ref' : view;
    $$<HTMLButtonElement>('[data-view-btn]', app).forEach((b) =>
      b.setAttribute('aria-pressed', String(!refOpen && b.dataset.viewBtn === view)),
    );
    try {
      localStorage.setItem('wip.editor.view', view);
    } catch {
      /* 保存できなくても動く */
    }
  }

  function openRef(file: File) {
    closeRef();
    refUrl = URL.createObjectURL(file);
    els.refName.textContent = file.name;
    const type = file.type;
    const body = els.refBody;
    if (type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = refUrl;
      img.alt = file.name;
      body.append(img);
    } else if (type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      const frame = document.createElement('iframe');
      frame.src = refUrl;
      frame.title = file.name;
      body.append(frame);
    } else if (type.startsWith('audio/')) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = refUrl;
      body.append(audio);
    } else {
      const pre = document.createElement('pre');
      pre.textContent = '読み込み中…';
      body.append(pre);
      file.text().then((t) => (pre.textContent = t));
    }
    els.ref.hidden = false;
    applyView();
    $<HTMLButtonElement>('[data-act="close-ref"]', app).focus();
  }

  function closeRef() {
    if (refUrl) URL.revokeObjectURL(refUrl);
    refUrl = null;
    els.refBody.innerHTML = '';
    els.ref.hidden = true;
    applyView();
  }

  // ---------- イベント ----------

  app.addEventListener('input', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-log]') || t.closest('[data-settings]')) return;
    if (t.matches('[data-f], [data-id], [data-body]')) {
      readForm();
      if (t.matches('[data-id]')) checkId();
      changed();
    }
  });
  // 選択肢・チェックボックスは change で拾う
  app.addEventListener('change', (e) => {
    const t = e.target as HTMLElement;
    if (t.matches('select[data-f], input[type="checkbox"][data-f], input[type="date"][data-f]')) {
      readForm();
      changed();
    }
  });

  els.draftSelect.addEventListener('change', () => {
    const d = store.drafts[els.draftSelect.value];
    if (d) switchTo(d);
  });

  els.siteSelect.addEventListener('change', () => {
    const id = els.siteSelect.value;
    els.siteSelect.value = '';
    if (id) openSiteWork(id);
  });

  els.importInput.addEventListener('change', async () => {
    const file = els.importInput.files?.[0];
    els.importInput.value = '';
    if (!file) return;
    const id = file.name.replace(/\.(md|markdown|txt)$/i, '');
    openText(await file.text(), ID_PATTERN.test(id) ? id : '', `ファイル「${file.name}」`);
  });

  els.refInput.addEventListener('change', () => {
    const file = els.refInput.files?.[0];
    els.refInput.value = '';
    if (file) openRef(file);
  });

  app.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-act], [data-view-btn]');
    if (!btn) return;
    if (btn.dataset.viewBtn) return setView(btn.dataset.viewBtn as View);
    switch (btn.dataset.act) {
      case 'new':
        switchTo(makeDraft(defaults(), ''));
        field('title').focus();
        break;
      case 'delete': {
        const name = cur.fields.title || '（題名なし）';
        const warn = cur.dirty ? '\n\nまだ書き出していない変更があります。削除すると元に戻せません。' : '';
        if (!window.confirm(`下書き「${name}」を削除しますか？${warn}`)) return;
        delete store.drafts[cur.key];
        store.deleted[cur.key] = Date.now();
        const next = sortedDrafts()[0] ?? makeDraft(defaults(), '');
        switchTo(next);
        break;
      }
      case 'export':
        exportCurrent();
        break;
      case 'add-log':
        cur.fields.log.unshift({ date: today(), note: '' });
        renderLog();
        changed();
        $<HTMLInputElement>('li input[type="text"]', els.log).focus();
        break;
      case 'close-ref':
        closeRef();
        break;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.ref.hidden) closeRef();
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      // Ctrl+S：すぐにブラウザへ保存（書き出しはしない）
      e.preventDefault();
      readForm();
      saveNow();
      showMessage('ブラウザに保存しました（ファイルにするには「書き出し」）。');
    }
  });

  // 別のタブで保存されたとき
  window.addEventListener('storage', (e) => {
    if (e.key !== STORE_KEY || saveTimer) return;
    const changedKeys = mergeFromDisk(store);
    if (changedKeys.includes(cur.key)) adoptCurrent();
    else if (changedKeys.length) renderDraftSelect();
    renderStatus();
  });

  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushSave());
  window.setInterval(renderStatus, 60 * 1000);

  // ---------- はじめの表示 ----------

  try {
    const v = localStorage.getItem('wip.editor.view') as View | null;
    if (v === 'split' || v === 'editor' || v === 'preview') view = v;
  } catch {
    /* なくてもよい */
  }
  applyView();

  const openId = new URLSearchParams(location.search).get('open');
  const existing = store.current ? store.drafts[store.current] : undefined;
  cur = existing ?? sortedDrafts()[0] ?? makeDraft(defaults(), '');
  store.current = cur.key;
  fillForm();
  $<HTMLDetailsElement>('.ed-fields', app).open = !cur.fields.title;
  renderDraftSelect();
  renderPreview();
  renderStatus();

  if (openId) {
    history.replaceState(null, '', location.pathname);
    const same = Object.values(store.drafts).find((d) => d.id === openId);
    if (same && same.dirty) {
      switchTo(same);
      showMessage(`「${openId}」には書き出していない下書きがあるので、そちらを開きました。サイトの版から開き直すには「サイトの作品を開く」を使ってください。`);
    } else if (same) {
      openSiteWork(openId, true);
    } else if (!openSiteWork(openId)) {
      showMessage(`サイトに「${openId}」という作品が見つかりませんでした。`, true);
    }
  }
}
