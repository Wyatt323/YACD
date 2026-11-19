// Recognise the dedicated selectors, not business groups that merely use a chain.
// A suffix lets one config have several independent entries and exits.
export function chainRole(name: string): number {
  const label = name.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '');
  const roles = ['应用代理链', '代理链入口', '代理链出口'];
  return roles.findIndex(
    (role) => label === role || new RegExp(`^${role}[\\s:：·/（(\\-]`).test(label),
  );
}

export function partitionProxyGroups(names: string[]) {
  const regular: string[] = [];
  const roles: string[][] = [[], [], []];
  for (const name of names) {
    const role = chainRole(name);
    (role < 0 ? regular : roles[role]).push(name);
  }
  return { regular, chains: roles.flat(), complete: roles.every((groups) => groups.length > 0) };
}
