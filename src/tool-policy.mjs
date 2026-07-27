export function recommendCapabilityPolicy(items = [], clientId = '', role = {}) {
  const hints = (role.toolHints || role.tags || []).map((item) => String(item).toLowerCase());
  return items.filter((item) => {
    if (!item?.enabled) return false;
    if (item.type === 'rules' || item.scope === 'project') return true;
    const name = String(item.name || '').toLowerCase();
    return hints.some((hint) => name.includes(hint));
  }).map((item) => ({
    clientId,
    type: String(item.type || ''),
    name: String(item.name || ''),
    scope: String(item.scope || ''),
  })).filter((item) => item.clientId && item.type && item.name);
}
