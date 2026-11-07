export function formatDate(value) {
  if (!value) return 'Без срока';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

export function formatDateTime(value) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

// Человекочитаемое устройство по User-Agent: «Chrome · macOS».
export function describeUserAgent(userAgent = '') {
  const browser = [
    [/Edg\//, 'Edge'], [/OPR\//, 'Opera'], [/YaBrowser/, 'Яндекс Браузер'], [/Firefox\//, 'Firefox'],
    [/Chrome\//, 'Chrome'], [/Safari\//, 'Safari'], [/curl\//, 'curl'], [/PostmanRuntime/, 'Postman'],
  ].find(([pattern]) => pattern.test(userAgent))?.[1];
  const os = [
    [/iPhone|iPad/, 'iOS'], [/Android/, 'Android'], [/Mac OS X|Macintosh/, 'macOS'],
    [/Windows/, 'Windows'], [/Linux/, 'Linux'],
  ].find(([pattern]) => pattern.test(userAgent))?.[1];
  const mobile = /Mobile|iPhone|Android/.test(userAgent);
  return {
    label: [browser, os].filter(Boolean).join(' · ') || userAgent || 'Неизвестное устройство',
    icon: mobile ? '📱' : '💻',
  };
}

export function formatRelative(value) {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'только что';
  const rtf = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' });
  if (seconds < 3600) return rtf.format(-Math.round(seconds / 60), 'minute');
  if (seconds < 86400) return rtf.format(-Math.round(seconds / 3600), 'hour');
  return rtf.format(-Math.round(seconds / 86400), 'day');
}
