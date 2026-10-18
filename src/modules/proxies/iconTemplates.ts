export type IconTemplate = { id: string; name: string };
export type IconTemplateState = { templates: IconTemplate[]; activeId: string };

const ENDPOINT = '/_yacd/templates';

async function request(method: string, body?: object): Promise<IconTemplateState> {
  const response = await fetch(ENDPOINT, {
    method,
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(payload.error || `Template request failed: ${response.status}`);
  }
  return response.json() as Promise<IconTemplateState>;
}

export function fetchIconTemplates() {
  return request('GET');
}

export function createIconTemplate(name: string) {
  return request('POST', { name });
}

export function selectIconTemplate(id: string) {
  return request('PATCH', { id });
}

export function renameIconTemplate(id: string, name: string) {
  return request('PATCH', { id, name });
}

export function deleteIconTemplate(id: string) {
  return request('DELETE', { id });
}
