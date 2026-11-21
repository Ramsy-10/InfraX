export function getEmbeddableVideoUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }

    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

    // YouTube standard, short, or shorts URLs
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname === '/watch') {
        const videoId = parsed.searchParams.get('v');
        if (videoId && /^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
          return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
        }
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        const videoId = parsed.pathname.split('/')[2];
        if (videoId && /^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
          return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
        }
      }
      if (parsed.pathname.startsWith('/embed/')) {
        const videoId = parsed.pathname.split('/')[2];
        if (videoId && /^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
          return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
        }
      }
    }

    if (host === 'youtu.be') {
      const videoId = parsed.pathname.replace(/^\/+/, '').split('/')[0];
      if (videoId && /^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
        return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
      }
    }

    // Vimeo
    if (host === 'vimeo.com') {
      const match = /^\/(\d{5,14})/.exec(parsed.pathname);
      if (match) {
        return `https://player.vimeo.com/video/${match[1]}`;
      }
    }

    // Google Drive preview
    if (host === 'drive.google.com') {
      const match = /^\/file\/d\/([a-zA-Z0-9_-]+)/.exec(parsed.pathname);
      if (match) {
        return `https://drive.google.com/file/d/${match[1]}/preview`;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function isSafeHttpUrl(rawUrl: string | null | undefined): boolean {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
