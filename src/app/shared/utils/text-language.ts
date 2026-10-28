const KHMER_TEXT_PATTERN = /[\u1780-\u17ff\u19e0-\u19ff]/u;

export function textLanguage(...values: Array<string | null | undefined>): 'km' | null {
  return values.some((value) => value !== null && value !== undefined && KHMER_TEXT_PATTERN.test(value))
    ? 'km'
    : null;
}
