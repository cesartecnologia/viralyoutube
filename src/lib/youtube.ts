const BASE_URL = "https://www.googleapis.com/youtube/v3";

export async function getYouTubeChannel(channelId: string) {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY não configurada");
  }

  const params = new URLSearchParams({
    part: "snippet,statistics,contentDetails",
    id: channelId,
    key: apiKey,
  });

  const response = await fetch(`${BASE_URL}/channels?${params}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Erro na API do YouTube: ${response.status}`);
  }

  const data = await response.json();
  return data.items?.[0] ?? null;
}
