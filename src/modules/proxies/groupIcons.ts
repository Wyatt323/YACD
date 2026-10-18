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
