const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

async function freePort() {
  const listener = net.createServer();
  await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

async function start(configFile, dataFile, profileKey = '') {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(__dirname, 'icon-store.cjs')], {
    env: {
      ...process.env,
      YACD_CONFIG_FILE: configFile,
      YACD_PROFILE_KEY: profileKey,
      YACD_ICON_DATA_FILE: dataFile,
      YACD_ICON_PORT: String(port),
    },
    stdio: 'ignore',
  });
  const url = `http://127.0.0.1:${port}/_yacd/icons`;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      await fetch(url);
      return { child, url };
    } catch {
      if (child.exitCode !== null) throw new Error('Icon server exited early');
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  child.kill();
  throw new Error('Icon server did not start');
}

async function change(url, method, body) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, 200);
  return response.json();
}

test('a migrated configuration keeps its icons after the configuration path changes', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'yacd-icons-'));
  const firstConfig = path.join(directory, 'first.yaml');
  const secondConfig = path.join(directory, 'second.yaml');
  const dataFile = path.join(directory, 'data', 'icons.json');
  fs.writeFileSync(firstConfig, 'proxies: []\n');
  fs.writeFileSync(secondConfig, 'proxies: []\n');

  let instance;
  try {
    instance = await start(firstConfig, dataFile);
    let state = await (await fetch(instance.url)).json();
    assert.equal(state.initialized, false);
    state = await change(instance.url, 'POST', { icons: { Global: 'https://example.com/a.png' } });
    assert.equal(state.icons.Global, 'https://example.com/a.png');
    state = await change(instance.url, 'PATCH', { group: 'Global', url: null });
    assert.deepEqual(state.icons, {});
    state = await change(instance.url, 'POST', {
      icons: { Global: 'https://example.com/old.png' },
    });
    assert.deepEqual(state.icons, {});
    const librariesURL = instance.url.replace('/icons', '/libraries');
    const library = {
      name: 'Example icons',
      source: 'https://example.com/icons.json',
      kind: 'json',
      icons: [{ name: 'Example', category: 'Test', url: 'https://example.com/icon.png' }],
    };
    let libraryState = await change(librariesURL, 'POST', library);
    assert.equal(libraryState.libraries.length, 1);
    const libraryId = libraryState.libraries[0].id;
    instance.child.kill();

    instance = await start(secondConfig, dataFile);
    state = await (await fetch(instance.url)).json();
    assert.equal(state.initialized, true);
    assert.deepEqual(state.icons, {});
    state = await change(instance.url, 'PATCH', {
      group: 'Global',
      url: 'https://example.com/b.png',
    });
    assert.equal(state.icons.Global, 'https://example.com/b.png');
    libraryState = await (await fetch(instance.url.replace('/icons', '/libraries'))).json();
    assert.equal(libraryState.libraries[0].id, libraryId);
    libraryState = await change(instance.url.replace('/icons', '/libraries'), 'DELETE', {
      id: libraryId,
    });
    assert.deepEqual(libraryState.libraries, []);
    instance.child.kill();

    instance = await start(firstConfig, dataFile);
    state = await (await fetch(instance.url)).json();
    assert.equal(state.initialized, true);
    assert.equal(state.icons.Global, 'https://example.com/b.png');
  } finally {
    instance?.child.kill();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('a legacy manual profile key migrates to a selectable template', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'yacd-profile-'));
  const dataFile = path.join(directory, 'data', 'icons.json');
  let instance;
  try {
    instance = await start('', dataFile, 'openwrt-main');
    let state = await (await fetch(instance.url)).json();
    assert.equal(state.profile.name, 'openwrt-main');
    state = await change(instance.url, 'PATCH', {
      group: 'Google',
      url: 'https://example.com/google.png',
    });
    assert.equal(state.icons.Google, 'https://example.com/google.png');
    instance.child.kill();

    instance = await start('', dataFile, 'openwrt-other');
    state = await (await fetch(instance.url)).json();
    assert.equal(state.icons.Google, 'https://example.com/google.png');
    const templatesURL = instance.url.replace('/icons', '/templates');
    const templates = await (await fetch(templatesURL)).json();
    assert.equal(templates.templates[0].name, 'openwrt-main');
    instance.child.kill();

    instance = await start('', dataFile, 'openwrt-main');
    state = await (await fetch(instance.url)).json();
    assert.equal(state.icons.Google, 'https://example.com/google.png');
  } finally {
    instance?.child.kill();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('templates can be created, selected, renamed, and deleted without a config file', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'yacd-templates-'));
  const dataFile = path.join(directory, 'data', 'icons.json');
  let instance;
  try {
    instance = await start('', dataFile);
    const templatesURL = instance.url.replace('/icons', '/templates');
    let templates = await (await fetch(templatesURL)).json();
    assert.equal(templates.templates.length, 1);
    const originalId = templates.activeId;
    await change(instance.url, 'PATCH', { group: 'Google', url: 'https://example.com/a.png' });

    templates = await change(templatesURL, 'POST', { name: '另一份配置' });
    const secondId = templates.activeId;
    assert.notEqual(secondId, originalId);
    let state = await (await fetch(instance.url)).json();
    assert.deepEqual(state.icons, {});
    assert.equal(state.initialized, true);
    await change(instance.url, 'PATCH', { group: 'Google', url: 'https://example.com/b.png' });

    templates = await change(templatesURL, 'PATCH', { id: secondId, name: '重命名模板' });
    assert.equal(templates.templates.find((item) => item.id === secondId).name, '重命名模板');
    templates = await change(templatesURL, 'PATCH', { id: originalId });
    assert.equal(templates.activeId, originalId);
    const staleWrite = await fetch(instance.url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group: 'Wrong', url: 'https://example.com/wrong.png', templateId: secondId }),
    });
    assert.equal(staleWrite.status, 409);
    state = await (await fetch(instance.url)).json();
    assert.equal(state.icons.Google, 'https://example.com/a.png');

    templates = await change(templatesURL, 'DELETE', { id: secondId });
    assert.equal(templates.templates.length, 1);
    const lastDelete = await fetch(templatesURL, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: originalId }),
    });
    assert.equal(lastDelete.status, 400);
    instance.child.kill();

    instance = await start('', dataFile);
    templates = await (await fetch(instance.url.replace('/icons', '/templates'))).json();
    assert.equal(templates.activeId, originalId);
    state = await (await fetch(instance.url)).json();
    assert.equal(state.icons.Google, 'https://example.com/a.png');
  } finally {
    instance?.child.kill();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('migration preserves every icon set in an older data file', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'yacd-old-profiles-'));
  const dataFile = path.join(directory, 'data', 'icons.json');
  fs.mkdirSync(path.dirname(dataFile));
  fs.writeFileSync(dataFile, JSON.stringify({ version: 1, profiles: {
    first: { icons: { A: 'https://example.com/a.png' } },
    second: { icons: { B: 'https://example.com/b.png' } },
  } }));
  let instance;
  try {
    instance = await start('', dataFile);
    const templatesURL = instance.url.replace('/icons', '/templates');
    const templates = await (await fetch(templatesURL)).json();
    assert.equal(templates.templates.length, 2);
    assert.equal((await (await fetch(instance.url)).json()).icons.A, 'https://example.com/a.png');
    await change(templatesURL, 'PATCH', { id: 'second' });
    assert.equal((await (await fetch(instance.url)).json()).icons.B, 'https://example.com/b.png');
  } finally {
    instance?.child.kill();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
