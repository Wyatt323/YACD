export type GroupIconAssignments = Record<string, Record<string, string>>;

const STORAGE_KEY = 'yacd-meta.group-icons.v1';

export function readGroupIconAssignments(): GroupIconAssignments {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as GroupIconAssignments;
    }
  } catch {
    // Browser storage may be unavailable or contain old, malformed data.
  }
  return {};
}

export function saveGroupIconAssignments(assignments: GroupIconAssignments): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
  } catch {
    // Selection still works for this session when browser storage is unavailable.
  }
}

export function isWebImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export type ServerIconSet = {
  profile: { id: string; name: string };
  icons: Record<string, string>;
  initialized: boolean;
};

const ICON_ENDPOINT = '/_yacd/icons';

export async function fetchServerIcons(): Promise<ServerIconSet | null> {
  const response = await fetch(ICON_ENDPOINT, { cache: 'no-store' });
  if ([401, 403, 404, 405].includes(response.status) ||
      !response.headers.get('content-type')?.includes('application/json')) {
    return null;
  }
  if (!response.ok) throw new Error(`Icon storage returned ${response.status}`);
  return (await response.json()) as ServerIconSet;
}

export async function importBrowserIcons(icons: Record<string, string>): Promise<ServerIconSet> {
  const response = await fetch(ICON_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ icons }),
  });
  if (!response.ok) throw new Error(`Icon import failed: ${response.status}`);
  return (await response.json()) as ServerIconSet;
}

export async function saveServerIcon(group: string, url: string | undefined): Promise<ServerIconSet> {
  const response = await fetch(ICON_ENDPOINT, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group, url: url ?? null }),
  });
  if (!response.ok) throw new Error(`Icon save failed: ${response.status}`);
  return (await response.json()) as ServerIconSet;
}
