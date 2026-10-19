// 作品の状態。決まった3つだけを使う。
// key は CSS のクラス名や URL に使う半角の名前。
export const STATUSES = [
  { value: '書きかけ', key: 'drafting' },
  { value: '改稿中', key: 'revising' },
  { value: 'ひとまず完成', key: 'done' },
] as const;

export type StatusValue = (typeof STATUSES)[number]['value'];

export const STATUS_VALUES = STATUSES.map((s) => s.value) as [StatusValue, ...StatusValue[]];

export function statusKey(value: string): string {
  return STATUSES.find((s) => s.value === value)?.key ?? 'unknown';
}
