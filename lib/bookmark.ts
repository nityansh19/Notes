export async function bookmarkPreview(input: string) {
  const url = new URL(input);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw Error('Use a public http or https URL.');
  const fallback = {
    url: url.href,
    domain: url.hostname,
    siteTitle: url.hostname.replace(/^www\./, ''),
    description: '',
    previewImage: '',
  };
  if (
    url.hostname === 'localhost' ||
    url.hostname.endsWith('.local') ||
    url.hostname.endsWith('.internal') ||
    /^(\d+\.|\[)/.test(url.hostname)
  )
    return fallback;
  try {
    const r = await fetch(url.href, {
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok || !r.headers.get('content-type')?.includes('text/html'))
      return fallback;
    const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
    const meta = (name: string) =>
      doc
        .querySelector(`meta[property="${name}"],meta[name="${name}"]`)
        ?.getAttribute('content') || '';
    const image = meta('og:image');
    const imageUrl = image ? new URL(image, url).href : '';
    return {
      ...fallback,
      siteTitle: meta('og:title') || doc.title || fallback.siteTitle,
      description: meta('og:description') || meta('description'),
      previewImage: imageUrl.startsWith('https://') ? imageUrl : '',
    };
  } catch {
    return fallback;
  }
}
