import 'server-only';

type YoutubeChannel = {
  id: string;
  snippet: { title: string; description?: string; thumbnails?: { default?: { url: string }; medium?: { url: string } } };
  statistics?: { subscriberCount?: string; videoCount?: string; viewCount?: string };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
};

async function youtube(path: string, params: Record<string, string>) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY não configurada');
  const query = new URLSearchParams({ ...params, key });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${query}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`YouTube API retornou HTTP ${response.status}`);
  return response.json();
}

export async function resolveChannel(raw: string): Promise<YoutubeChannel> {
  const value = raw.trim();
  let id: string | undefined;
  let handle: string | undefined;
  let username: string | undefined;
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(value)) id = value;
  else if (/^@[a-zA-Z0-9._-]{3,30}$/.test(value)) handle = value;
  else {
    let url: URL;
    try { url = new URL(value); } catch { throw new Error('Informe uma URL do YouTube, @handle ou ID UC...'); }
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) throw new Error('URL deve ser do youtube.com');
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'channel' && /^UC[a-zA-Z0-9_-]{22}$/.test(parts[1] || '')) id = parts[1];
    else if (parts[0]?.startsWith('@')) handle = parts[0];
    else if (parts[0] === 'user' && parts[1]) username = parts[1];
    else throw new Error('Use URL /@handle, /channel/UC... ou /user/nome');
  }
  const params = { part: 'snippet,statistics,contentDetails', ...(id ? { id } : handle ? { forHandle: handle } : { forUsername: username! }) };
  const result = await youtube('channels', params);
  if (!result.items?.[0]) throw new Error('Canal não encontrado');
  return result.items[0];
}
