// 長文の位置スライダー。
// 横書き：ページを上下にスクロール（スライダーは画面右端で上下。スマホでは上端の細い線と％だけ）。
// 縦書き：本文の枠を左右にスクロール（スライダーは右が冒頭、左が末尾）。
// 縦書きの scrollLeft はブラウザによって符号が違うので、「冒頭＝0、末尾＝1」にそろえて扱う。
import { SETTINGS_EVENT } from './reader-settings';

const STEPS = 1000;

const isVertical = () => document.documentElement.dataset.writing === 'vertical';

/** 縦書きの枠で scrollLeft が負の値になる（今の仕様どおり）か、古い方式（正の値）か */
function rtlScrollIsNegative(el: HTMLElement): boolean {
  if (el.scrollLeft < 0) return true;
  if (el.scrollLeft > 0) return false;
  const before = el.scrollLeft;
  el.scrollLeft = -1;
  const negative = el.scrollLeft < 0;
  el.scrollLeft = before;
  return negative;
}

export function initPosition(scroller: HTMLElement, box: HTMLElement) {
  const input = box.querySelector<HTMLInputElement>('input[type="range"]')!;
  const out = box.querySelector<HTMLOutputElement>('output');
  input.max = String(STEPS);
  let negative = true;
  let last = 0;

  const vMax = () => scroller.scrollWidth - scroller.clientWidth;

  const hRange = () => {
    const r = scroller.getBoundingClientRect();
    const start = r.top + window.scrollY - 16;
    const end = r.bottom + window.scrollY - window.innerHeight + 16;
    return { start, end, span: end - start };
  };

  const isLong = () => (isVertical() ? vMax() > 40 : hRange().span > window.innerHeight * 0.8);

  const getP = (): number => {
    if (isVertical()) {
      const max = vMax();
      if (max <= 0) return 0;
      const sl = scroller.scrollLeft;
      return negative ? -sl / max : 1 - sl / max;
    }
    const { start, span } = hRange();
    if (span <= 0) return 0;
    return (window.scrollY - start) / span;
  };

  const setP = (p: number) => {
    p = Math.min(1, Math.max(0, p));
    if (isVertical()) {
      const max = vMax();
      scroller.scrollLeft = negative ? -p * max : (1 - p) * max;
    } else {
      const { start, span } = hRange();
      window.scrollTo({ top: start + p * Math.max(0, span), behavior: 'auto' });
    }
  };

  const show = () => {
    const p = Math.min(1, Math.max(0, getP()));
    last = p;
    input.value = String(Math.round(p * STEPS));
    const pct = `${Math.round(p * 100)}%`;
    input.setAttribute('aria-valuetext', `${pct}（${isVertical() ? '右が冒頭' : '上が冒頭'}）`);
    if (out) out.textContent = pct;
    box.style.setProperty('--p', String(p));
  };

  const refresh = (keep: number | null) => {
    if (isVertical()) negative = rtlScrollIsNegative(scroller);
    box.hidden = !isLong();
    if (keep !== null) setP(keep);
    show();
  };

  input.addEventListener('input', () => {
    setP(Number(input.value) / STEPS);
    show();
  });

  scroller.addEventListener('scroll', () => isVertical() && show(), { passive: true });
  window.addEventListener('scroll', () => !isVertical() && show(), { passive: true });
  window.addEventListener('resize', () => refresh(last));
  document.addEventListener(SETTINGS_EVENT, () => {
    const keep = last;
    requestAnimationFrame(() => refresh(keep));
  });

  // 縦書きのとき、マウスホイールの上下で本文を左右に送る（端まで来たらページのスクロールに任せる）
  scroller.addEventListener(
    'wheel',
    (e) => {
      if (!isVertical() || e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const p = getP();
      if ((e.deltaY > 0 && p >= 0.999) || (e.deltaY < 0 && p <= 0.001)) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? scroller.clientWidth : 1;
      scroller.scrollBy({ left: -e.deltaY * unit });
    },
    { passive: false },
  );

  // 書体の読み込みなどで高さが変わったときにも合わせる
  if ('ResizeObserver' in window) new ResizeObserver(() => refresh(null)).observe(scroller);
  refresh(null);
}
