import { isWebImageUrl } from './groupIcons';

export type LibraryIcon = { name: string; category: string; url: string };
export type IconLibrary = {
  id: string;
  name: string;
  source: string;
  kind: 'github' | 'json';
  icons: LibraryIcon[];
};
type NewIconLibrary = Omit<IconLibrary, 'id'>;

const STORAGE_KEY = 'yacd-meta.icon-libraries.v1';
const ENDPOINT = '/_yacd/libraries';
const IMAGE_EXTENSION = /\.(?:png|jpe?g|webp|svg|gif|avif)$/i;

function readLocalLibraries(): IconLibrary[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? (value as IconLibrary[]) : [];
  } catch {
    return [];
  }
}

function writeLocalLibraries(libraries: IconLibrary[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(libraries));
  return libraries;
}

async function fetchJSON(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function normalizeJSONCatalog(value: unknown, source: string): NewIconLibrary {
  const input = value as { name?: unknown; icons?: unknown } | LibraryIcon[];
  const rows = Array.isArray(input) ? input : input?.icons;
  if (!Array.isArray(rows)) throw new Error('JSON needs an icons array');
  const icons: LibraryIcon[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || typeof row.url !== 'string') continue;
    let url: string;
    try {
      url = new URL(row.url, source).href;
    } catch {
      continue;
    }
    if (!isWebImageUrl(url) || url.length > 2048) continue;
    const filename = new URL(url).pathname.split('/').pop() || 'Icon';
    icons.push({
      name: (typeof row.name === 'string' && row.name.trim()
        ? row.name.trim()
        : filename.replace(IMAGE_EXTENSION, '')
      ).slice(0, 160),
      category: (typeof row.category === 'string' ? row.category : '').slice(0, 160),
      url,
    });
  }
  if (icons.length === 0 || icons.length > 5000)
    throw new Error('No usable icons or too many icons');
  const name =
    !Array.isArray(input) && typeof input.name === 'string' && input.name.trim()
      ? input.name.trim()
      : new URL(source).pathname.split('/').pop() || 'JSON icons';
  return { name: name.slice(0, 100), source, kind: 'json', icons };
}

async function loadGitHubRepository(url: URL): Promise<NewIconLibrary> {
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length !== 2) throw new Error('Use a GitHub repository URL: github.com/owner/repo');
  const [owner, rawRepo] = segments;
  const repo = rawRepo.replace(/\.git$/, '');
  const metadata = (await fetchJSON(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
  )) as {
    default_branch?: string;
    full_name?: string;
  };
  if (!metadata.default_branch) throw new Error('Cannot read GitHub repository');
  const tree = (await fetchJSON(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(metadata.default_branch)}?recursive=1`,
  )) as { tree?: Array<{ path: string; type: string }>; truncated?: boolean };
  if (tree.truncated) throw new Error('GitHub repository tree is too large');
  const icons = (tree.tree || [])
    .filter((entry) => entry.type === 'blob' && IMAGE_EXTENSION.test(entry.path))
    .map((entry) => {
      const parts = entry.path.split('/');
      const filename = parts.pop() || '';
      return {
        name: filename.replace(IMAGE_EXTENSION, ''),
        category: parts.join('/').slice(0, 160),
        url: `https://raw.githubusercontent.com/${owner}/${repo}/${metadata.default_branch}/${entry.path.split('/').map(encodeURIComponent).join('/')}`,
      };
    });
  if (icons.length === 0 || icons.length > 5000)
    throw new Error('No usable icons or too many icons');
  return {
    name: (metadata.full_name || `${owner}/${repo}`).slice(0, 100),
    source: `https://github.com/${owner}/${repo}`,
    kind: 'github',
    icons,
  };
}

export async function loadLibraryFromURL(input: string): Promise<NewIconLibrary> {
  const url = new URL(input.trim());
  if (!isWebImageUrl(url.href)) throw new Error('Use an HTTP or HTTPS URL');
  if (url.hostname.toLowerCase() === 'github.com') return loadGitHubRepository(url);
  return normalizeJSONCatalog(await fetchJSON(url.href), url.href);
}

export async function getIconLibraries(server: boolean): Promise<IconLibrary[]> {
  if (!server) return readLocalLibraries();
  const response = await fetch(ENDPOINT, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Cannot load icon libraries: ${response.status}`);
  const data = (await response.json()) as { libraries: IconLibrary[] };
  return data.libraries;
}

export async function saveIconLibrary(
  library: NewIconLibrary,
  server: boolean,
): Promise<IconLibrary[]> {
  if (!server) {
    const libraries = readLocalLibraries();
    const existing = libraries.findIndex((item) => item.source === library.source);
    const id =
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const entry = { ...library, id: existing >= 0 ? libraries[existing].id : id };
    if (existing >= 0) libraries[existing] = entry;
    else libraries.push(entry);
    return writeLocalLibraries(libraries);
  }
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(library),
  });
  if (!response.ok) throw new Error(`Cannot save icon library: ${response.status}`);
  const data = (await response.json()) as { libraries: IconLibrary[] };
  return data.libraries;
}

export async function deleteIconLibrary(id: string, server: boolean): Promise<IconLibrary[]> {
  if (!server) return writeLocalLibraries(readLocalLibraries().filter((item) => item.id !== id));
  const response = await fetch(ENDPOINT, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) throw new Error(`Cannot delete icon library: ${response.status}`);
  const data = (await response.json()) as { libraries: IconLibrary[] };
  return data.libraries;
}
