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

async function start(configFile, dataFile) {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(__dirname, 'icon-store.cjs')], {
    env: {
      ...process.env,
      YACD_CONFIG_FILE: configFile,
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

test('icons persist by configuration path and an empty profile does not reimport old browser icons', async () => {
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
    state = await change(instance.url, 'POST', { icons: { Global: 'https://example.com/old.png' } });
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
    assert.equal(state.initialized, false);
    assert.deepEqual(state.icons, {});
    state = await change(instance.url, 'PATCH', { group: 'Global', url: 'https://example.com/b.png' });
    assert.equal(state.icons.Global, 'https://example.com/b.png');
    libraryState = await (await fetch(instance.url.replace('/icons', '/libraries'))).json();
    assert.equal(libraryState.libraries[0].id, libraryId);
    libraryState = await change(instance.url.replace('/icons', '/libraries'), 'DELETE', { id: libraryId });
    assert.deepEqual(libraryState.libraries, []);
    instance.child.kill();

    instance = await start(firstConfig, dataFile);
    state = await (await fetch(instance.url)).json();
    assert.equal(state.initialized, true);
    assert.deepEqual(state.icons, {});
  } finally {
    instance?.child.kill();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
