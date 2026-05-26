export async function apiErrorMessage(error: any, fallback: string) {
  const data = error?.response?.data;

  if (data instanceof Blob) {
    const parsed = await parseBlobError(data);
    return parsed || fallback;
  }

  if (Array.isArray(data?.message)) return data.message.join(' ');
  if (typeof data?.message === 'string') return data.message;
  if (typeof data === 'string') return data;

  return fallback;
}

async function parseBlobError(blob: Blob) {
  try {
    const text = await blob.text();
    if (!text) return '';
    const json = JSON.parse(text);
    if (Array.isArray(json?.message)) return json.message.join(' ');
    if (typeof json?.message === 'string') return json.message;
    return text;
  } catch {
    return '';
  }
}

