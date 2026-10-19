// 表示設定（縦書き／横書き、文字の大きさ、行間、1行の文字数）。
// ブラウザ（localStorage）に保存して、次に開いたときも引き継ぐ。
// ※ キー名と反映のしかたは src/layouts/Base.astro の先読みスクリプトとそろえること。

export type WritingMode = 'horizontal' | 'vertical';

export interface ReaderSettings {
  mode: WritingMode;
  fontSize: number;
  lineHeight: number;
  chars: number;
}

const KEY = 'wip.reader.v1';
export const DEFAULT_SETTINGS: ReaderSettings = { mode: 'horizontal', fontSize: 18, lineHeight: 1.9, chars: 35 };
export const SETTINGS_EVENT = 'wip:settings';

export function loadSettings(): ReaderSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULT_SETTINGS, ...raw };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(s: ReaderSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 保存できない環境（プライベートモードなど）では、その場だけ反映する */
  }
}

export function applySettings(s: ReaderSettings) {
  const root = document.documentElement;
  if (s.mode === 'vertical') root.dataset.writing = 'vertical';
  else delete root.dataset.writing;
  root.style.setProperty('--fs', `${s.fontSize}px`);
  root.style.setProperty('--lh', String(s.lineHeight));
  root.style.setProperty('--chars', String(s.chars));
}

/** 画面に収まらず止まっているとき、実際に1行に入る文字数 */
function effectiveChars(): number | null {
  const work = document.querySelector<HTMLElement>('.work');
  if (!work) return null;
  const fs = parseFloat(getComputedStyle(work).fontSize);
  const vertical = document.documentElement.dataset.writing === 'vertical';
  const size = vertical ? work.getBoundingClientRect().height : work.getBoundingClientRect().width;
  return fs > 0 ? Math.floor(size / fs + 0.01) : null;
}

export function initSettingsPanels() {
  let settings = loadSettings();
  const panels = document.querySelectorAll<HTMLElement>('[data-settings]');

  const render = () => {
    panels.forEach((panel) => {
      panel.querySelectorAll<HTMLButtonElement>('[data-mode-btn]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.modeBtn === settings.mode));
      });
      panel.querySelectorAll<HTMLInputElement>('input[data-key]').forEach((input) => {
        const k = input.dataset.key as keyof ReaderSettings;
        input.value = String(settings[k]);
      });
      const out = (k: string, text: string) => {
        const o = panel.querySelector<HTMLOutputElement>(`[data-out="${k}"]`);
        if (o) o.textContent = text;
      };
      out('fontSize', `${settings.fontSize}px`);
      out('lineHeight', settings.lineHeight.toFixed(1));
      const eff = effectiveChars();
      out(
        'chars',
        eff !== null && eff < settings.chars ? `${settings.chars}字（画面いっぱい：約${eff}字）` : `${settings.chars}字`,
      );
    });
  };

  const update = (patch: Partial<ReaderSettings>) => {
    settings = { ...settings, ...patch };
    applySettings(settings);
    saveSettings(settings);
    render();
    document.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: settings }));
  };

  panels.forEach((panel) => {
    // パソコンでは開いておき、スマホでは折りたたんでおく
    if (panel instanceof HTMLDetailsElement && matchMedia('(min-width: 768px)').matches) panel.open = true;
    panel.querySelectorAll<HTMLButtonElement>('[data-mode-btn]').forEach((b) => {
      b.addEventListener('click', () => update({ mode: b.dataset.modeBtn as WritingMode }));
    });
    panel.querySelectorAll<HTMLInputElement>('input[data-key]').forEach((input) => {
      input.addEventListener('input', () => {
        update({ [input.dataset.key as string]: Number(input.value) });
      });
    });
    panel.querySelector('[data-reset]')?.addEventListener('click', () => update({ ...DEFAULT_SETTINGS }));
  });

  applySettings(settings);
  render();
  window.addEventListener('resize', render);
}
