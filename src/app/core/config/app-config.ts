export interface KSongConfig {
  apiBaseUrl: string;
  backgroundColor: string;
  accentColor: string;
  pageSize: number;
  refreshBufferSeconds: number;
}

declare global {
  interface Window {
    __KSONG_CONFIG__?: Partial<KSongConfig>;
  }
}

const defaults: KSongConfig = {
  apiBaseUrl: '',
  backgroundColor: '#000033',
  accentColor: '#f2f2f2',
  pageSize: 8,
  refreshBufferSeconds: 60,
};

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : fallback;
}

export function getAppConfig(): KSongConfig {
  const configured = typeof window === 'undefined' ? {} : window.__KSONG_CONFIG__ ?? {};
  return {
    apiBaseUrl: (configured.apiBaseUrl ?? defaults.apiBaseUrl).replace(/\/+$/, ''),
    backgroundColor: configured.backgroundColor ?? defaults.backgroundColor,
    accentColor: configured.accentColor ?? defaults.accentColor,
    pageSize: boundedInteger(configured.pageSize, defaults.pageSize, 1, 100),
    refreshBufferSeconds: boundedInteger(configured.refreshBufferSeconds, defaults.refreshBufferSeconds, 0, 3600),
  };
}
