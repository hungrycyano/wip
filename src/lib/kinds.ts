// 種類（kind）の一覧は src/config/kinds.json だけに書く。
// ここはそれを読み込んで、使いやすい形にするだけ。種類名をコードに直接書かないこと。
import kindsConfig from '../config/kinds.json';

export interface Kind {
  id: string;
  label: string;
  /** true のとき、本文の行末の改行をそのまま表示する（詩など） */
  keepLineBreaks?: boolean;
}

export const KINDS: Kind[] = kindsConfig.kinds;
export const KIND_IDS: string[] = KINDS.map((k) => k.id);

export function findKind(id: string): Kind | undefined {
  return KINDS.find((k) => k.id === id);
}

export function kindLabel(id: string): string {
  return findKind(id)?.label ?? id;
}

export function keepsLineBreaks(id: string): boolean {
  return findKind(id)?.keepLineBreaks === true;
}
