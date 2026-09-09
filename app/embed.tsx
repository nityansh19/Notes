'use client';
export function safeHttp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export default function Embed({ url }: { url: string }) {
  const safe = safeHttp(url);
  if (!safe) return null;
  const parsed = new URL(safe);
  let src: string | null = null;
  if (
    ['www.youtube.com', 'youtube.com', 'youtu.be'].includes(parsed.hostname)
  ) {
    const id =
      parsed.hostname === 'youtu.be'
        ? parsed.pathname.slice(1)
        : parsed.searchParams.get('v');
    if (id && /^[\w-]{11}$/.test(id))
      src = `https://www.youtube-nocookie.com/embed/${id}`;
  }
  if (
    ['vimeo.com', 'www.vimeo.com'].includes(parsed.hostname) &&
    /^\/\d+$/.test(parsed.pathname)
  )
    src = `https://player.vimeo.com/video${parsed.pathname}`;
  return (
    <div className="embed-card">
      {src && (
        <iframe
          src={src}
          title="Saved video"
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allowFullScreen
          style={{
            width: '100%',
            aspectRatio: '16 / 9',
            border: 0,
            marginBottom: 12,
          }}
        />
      )}
      <a href={safe} target="_blank" rel="noopener noreferrer">
        {safe}
      </a>
    </div>
  );
}
