function detectFaviconMimeType(faviconUrl: string): string {
  const normalized = faviconUrl.toLowerCase();

  if (normalized.startsWith('data:image/')) {
    const dataMime = normalized.match(/^data:(image\/[a-z0-9+.-]+);/i);
    return dataMime?.[1] || 'image/png';
  }

  if (normalized.endsWith('.svg')) return 'image/svg+xml';
  if (normalized.endsWith('.ico')) return 'image/x-icon';
  if (normalized.endsWith('.webp')) return 'image/webp';
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
  if (normalized.endsWith('.gif')) return 'image/gif';

  return 'image/png';
}

function withCacheBuster(url: string): string {
  if (url.startsWith('data:')) {
    return url;
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}fv=${Date.now()}`;
}

function upsertFaviconLink(rel: string, href: string, type: string): void {
  let link = document.querySelector(`link[rel='${rel}']`) as HTMLLinkElement | null;

  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }

  link.type = type;
  link.href = href;
}

export function applyFaviconToDocument(faviconUrl?: string | null): void {
  if (!faviconUrl) return;

  const href = withCacheBuster(faviconUrl);
  const type = detectFaviconMimeType(faviconUrl);

  upsertFaviconLink('icon', href, type);
  upsertFaviconLink('shortcut icon', href, type);
}
