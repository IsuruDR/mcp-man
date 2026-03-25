const VALID_TYPES = new Set(['stdio', 'http', 'sse']);

export function validateState(state) {
  const errors = [];
  if (!state?.servers) {
    errors.push('Missing "servers" object');
    return errors;
  }

  if (state.servers.user) {
    for (const [name, entry] of Object.entries(state.servers.user)) {
      errors.push(...validateServerEntry(name, entry, 'user'));
    }
  }

  if (state.servers.projects) {
    for (const [projectPath, servers] of Object.entries(state.servers.projects)) {
      if (!projectPath.startsWith('/')) {
        errors.push(`Project path "${projectPath}" must be absolute`);
        continue;
      }
      for (const [name, entry] of Object.entries(servers)) {
        errors.push(...validateServerEntry(name, entry, `project:${projectPath}`));
      }
    }
  }

  return errors;
}

function validateServerEntry(name, entry, scope) {
  const errors = [];
  const prefix = `Server "${name}" (${scope})`;

  if (!entry.config) {
    errors.push(`${prefix}: missing "config" object`);
    return errors;
  }

  const { type } = entry.config;

  if (!VALID_TYPES.has(type)) {
    errors.push(`${prefix}: invalid type "${type}" (must be stdio, http, or sse)`);
    return errors;
  }

  if (type === 'stdio' && !entry.config.command) {
    errors.push(`${prefix}: stdio server requires "command"`);
  }

  if (type === 'http' || type === 'sse') {
    if (!entry.config.url) {
      errors.push(`${prefix}: ${type} server requires "url"`);
    } else {
      try { new URL(entry.config.url); } catch {
        errors.push(`${prefix}: "${entry.config.url}" is not a valid URL`);
      }
    }
  }

  return errors;
}
