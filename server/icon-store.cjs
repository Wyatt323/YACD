const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const configFile = process.env.YACD_CONFIG_FILE;
const profileKey = process.env.YACD_PROFILE_KEY?.trim();
const dataFile = process.env.YACD_ICON_DATA_FILE || '/data/group-icons.json';
const port = Number(process.env.YACD_ICON_PORT || 3001);
const host = process.env.YACD_ICON_HOST || '127.0.0.1';

function legacyProfile() {
  if (profileKey) {
    if (profileKey.length > 256) throw new Error('YACD_PROFILE_KEY is too long');
    return {
      id: crypto.createHash('sha256').update(`profile:${profileKey}`).digest('hex'),
      name: profileKey,
    };
  }
  if (!configFile) return null;
  const resolved = fs.realpathSync(configFile);
  if (!fs.statSync(resolved).isFile()) throw new Error('Config path is not a file');
  return {
    id: crypto.createHash('sha256').update(resolved).digest('hex'),
    name: path.basename(resolved),
  };
}

function ensureTemplates(data) {
  if (Array.isArray(data.templates) && data.templates.length > 0) return false;
  const legacy = legacyProfile();
  const savedIds = Object.keys(data.profiles);
  data.templates = savedIds.map((id, index) => ({
    id,
    name: id === legacy?.id ? legacy.name : `旧模板 ${index + 1}`,
  }));
  if (legacy && !savedIds.includes(legacy.id)) data.templates.push(legacy);
  if (data.templates.length === 0) {
    data.templates.push(legacy || { id: crypto.randomUUID(), name: '默认模板' });
  }
  data.activeTemplateId = legacy?.id || data.templates[0].id;
  return true;
}

function activeTemplate(data) {
  return data.templates.find((item) => item.id === data.activeTemplateId) || data.templates[0];
}

function validTemplateName(name) {
  return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 80;
}

function templateList(data) {
  return { templates: data.templates, activeId: activeTemplate(data).id };
}

function readData() {
  try {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    if (data?.version === 1 && data.profiles && typeof data.profiles === 'object') return data;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return { version: 1, profiles: {} };
}

function writeData(data) {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  const temporary = `${dataFile}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, dataFile);
}

function send(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  let text = '';
  for await (const chunk of request) {
    text += chunk;
    if (text.length > 2_000_000) throw new Error('Request is too large');
  }
  return JSON.parse(text);
}

function validIcon(url) {
  if (typeof url !== 'string' || url.length > 2048) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function validGroup(group) {
  return (
    typeof group === 'string' &&
    group.length > 0 &&
    group.length <= 256 &&
    !['__proto__', 'prototype', 'constructor'].includes(group)
  );
}

function validLibrary(library) {
  return (
    library &&
    typeof library.name === 'string' &&
    library.name.length > 0 &&
    library.name.length <= 100 &&
    typeof library.source === 'string' &&
    validIcon(library.source) &&
    ['github', 'json'].includes(library.kind) &&
    Array.isArray(library.icons) &&
    library.icons.length > 0 &&
    library.icons.length <= 5000 &&
    library.icons.every(
      (icon) =>
        icon &&
        typeof icon.name === 'string' &&
        icon.name.length > 0 &&
        icon.name.length <= 160 &&
        typeof icon.category === 'string' &&
        icon.category.length <= 160 &&
        validIcon(icon.url),
    )
  );
}

const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (!['/_yacd/icons', '/_yacd/libraries', '/_yacd/templates'].includes(pathname)) {
    return send(response, 404, { error: 'Not found' });
  }

  try {
    if (pathname === '/_yacd/templates') {
      if (request.method === 'GET') {
        const data = readData();
        if (ensureTemplates(data)) writeData(data);
        return send(response, 200, templateList(data));
      }
      if (!['POST', 'PATCH', 'DELETE'].includes(request.method)) {
        return send(response, 405, { error: 'Method not allowed' });
      }
      if (!request.headers['content-type']?.startsWith('application/json')) {
        return send(response, 415, { error: 'JSON required' });
      }
      const body = await readBody(request);
      const data = readData();
      if (ensureTemplates(data)) writeData(data);
      if (request.method === 'POST') {
        if (!validTemplateName(body?.name) || data.templates.length >= 50) {
          return send(response, 400, { error: 'Invalid template name or limit reached' });
        }
        const name = body.name.trim();
        if (data.templates.some((item) => item.name === name)) {
          return send(response, 409, { error: 'Template name already exists' });
        }
        const entry = { id: crypto.randomUUID(), name };
        data.templates.push(entry);
        data.profiles[entry.id] = { icons: {} };
        data.activeTemplateId = entry.id;
      } else {
        const index = data.templates.findIndex((item) => item.id === body?.id);
        if (index < 0) return send(response, 404, { error: 'Template not found' });
        if (request.method === 'PATCH') {
          if (body.name !== undefined) {
            if (!validTemplateName(body.name)) {
              return send(response, 400, { error: 'Invalid template name' });
            }
            const name = body.name.trim();
            if (data.templates.some((item, i) => i !== index && item.name === name)) {
              return send(response, 409, { error: 'Template name already exists' });
            }
            data.templates[index].name = name;
          } else {
            data.activeTemplateId = body.id;
          }
        } else {
          if (data.templates.length === 1) {
            return send(response, 400, { error: 'Cannot delete the last template' });
          }
          const [deleted] = data.templates.splice(index, 1);
          delete data.profiles[deleted.id];
          if (data.activeTemplateId === deleted.id) data.activeTemplateId = data.templates[0].id;
        }
      }
      writeData(data);
      return send(response, 200, templateList(data));
    }

    if (pathname === '/_yacd/libraries') {
      if (request.method === 'GET') {
        return send(response, 200, { libraries: readData().libraries || [] });
      }
      if (!['POST', 'DELETE'].includes(request.method)) {
        return send(response, 405, { error: 'Method not allowed' });
      }
      if (!request.headers['content-type']?.startsWith('application/json')) {
        return send(response, 415, { error: 'JSON required' });
      }
      const body = await readBody(request);
      const data = readData();
      const libraries = data.libraries || [];
      if (request.method === 'POST') {
        if (!validLibrary(body)) return send(response, 400, { error: 'Invalid library' });
        const existing = libraries.findIndex((item) => item.source === body.source);
        if (existing < 0 && libraries.length >= 20) {
          return send(response, 400, { error: 'Library limit reached' });
        }
        const entry = {
          id: existing >= 0 ? libraries[existing].id : crypto.randomUUID(),
          name: body.name,
          source: body.source,
          kind: body.kind,
          icons: body.icons,
        };
        if (existing >= 0) libraries[existing] = entry;
        else libraries.push(entry);
      } else {
        if (typeof body?.id !== 'string')
          return send(response, 400, { error: 'Invalid library ID' });
        const index = libraries.findIndex((item) => item.id === body.id);
        if (index >= 0) libraries.splice(index, 1);
      }
      data.libraries = libraries;
      writeData(data);
      return send(response, 200, { libraries });
    }

    let data = readData();
    if (ensureTemplates(data)) writeData(data);
    let current = activeTemplate(data);
    if (request.method === 'GET') {
      const saved = data.profiles[current.id];
      return send(response, 200, {
        profile: current,
        icons: saved?.icons || {},
        initialized: Boolean(saved),
      });
    }

    if (request.method !== 'PATCH' && request.method !== 'POST') {
      return send(response, 405, { error: 'Method not allowed' });
    }
    if (!request.headers['content-type']?.startsWith('application/json')) {
      return send(response, 415, { error: 'JSON required' });
    }
    const body = await readBody(request);
    data = readData();
    if (ensureTemplates(data)) writeData(data);
    current = activeTemplate(data);
    if (body?.templateId && body.templateId !== current.id) {
      return send(response, 409, { error: 'Active template changed; refresh and retry' });
    }
    const icons = data.profiles[current.id]?.icons || {};
    if (request.method === 'PATCH') {
      if (!body || !validGroup(body.group) || (body.url !== null && !validIcon(body.url))) {
        return send(response, 400, { error: 'Invalid group or icon URL' });
      }
      if (body.url === null) delete icons[body.group];
      else icons[body.group] = body.url;
    } else {
      if (!body || !body.icons || typeof body.icons !== 'object' || Array.isArray(body.icons)) {
        return send(response, 400, { error: 'Invalid icon map' });
      }
      for (const [group, url] of Object.entries(body.icons)) {
        if (!validGroup(group) || !validIcon(url)) {
          return send(response, 400, { error: 'Invalid icon map' });
        }
      }
      // Migrate old browser settings only into an empty server profile.
      if (!data.profiles[current.id]) Object.assign(icons, body.icons);
    }
    data.profiles[current.id] = { icons };
    writeData(data);
    return send(response, 200, { profile: current, icons, initialized: true });
  } catch (error) {
    console.error('Icon storage error:', error);
    return send(response, 503, { error: 'Icon storage unavailable' });
  }
});

server.listen(port, host, () => {
  console.log(`Yacd icon storage listening on ${host}:${port}`);
});
