import { app, BrowserWindow, dialog, Menu, nativeImage, Notification, shell, Tray } from 'electron';
import path from 'node:path';
import { Store } from '../src/store.mjs';
import { Runner } from '../src/runner.mjs';
import { createServer } from '../src/server.mjs';
import { config as baseConfig } from '../src/config.mjs';
import { detectCliAdapters } from '../src/detect.mjs';
import { Scheduler } from '../src/scheduler.mjs';

let server;
let runner;
let scheduler;
let mainWindow;
let tray;
let quitting = false;

function createTray() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="9" fill="#6958d9"/><text x="16" y="21" text-anchor="middle" font-family="Arial" font-size="13" font-weight="700" fill="white">LO</text></svg>`;
  const icon = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Local Agent Office');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '오피스 열기', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: '종료', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

async function boot() {
  const smoke = process.argv.includes('--smoke') || process.env.AGENT_OFFICE_SMOKE === '1';
  const config = {
    ...baseConfig,
    dataFile: path.join(app.getPath('userData'), 'state.json'),
    logDir: path.join(app.getPath('userData'), 'logs'),
  };
  const store = new Store(config.dataFile);
  await store.init();
  await store.applyDetectedAdapters(detectCliAdapters());
  runner = new Runner(store, () => {});
  scheduler = new Scheduler(store, runner);
  const integrations = {
    pickFolder: async () => {
      const options = { properties: ['openDirectory', 'createDirectory'] };
      const result = mainWindow
        ? await dialog.showOpenDialog(mainWindow, options)
        : await dialog.showOpenDialog(options);
      return { path: result.canceled ? '' : result.filePaths[0] || '', canceled: result.canceled };
    },
    revealFile: async (file) => shell.showItemInFolder(file),
    getDesktopSettings: async () => ({ supported: true, autostart: app.getLoginItemSettings().openAtLogin }),
    setAutoStart: async (on) => {
      const executable = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
      app.setLoginItemSettings({ openAtLogin: on, path: executable, args: app.isPackaged ? [] : [baseConfig.root] });
      return { supported: true, autostart: app.getLoginItemSettings().openAtLogin };
    },
  };
  const created = createServer({ store, runner, scheduler, integrations, config });
  server = created.server;
  const streamEmit = runner.emit;
  runner.emit = (event, data) => {
    streamEmit(event, data);
    if (event === 'card' && data?.status === 'review' && Notification.isSupported()) {
      new Notification({ title: '작업 검토 준비', body: data.title || '에이전트 작업이 끝났습니다.' }).show();
    }
  };
  scheduler.emit = created.emit;
  scheduler.start();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, config.host, resolve);
  });
  const port = server.address().port;
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 880,
    minHeight: 620,
    title: 'Local Agent Office',
    backgroundColor: '#f3f1ec',
    autoHideMenuBar: true,
    show: !smoke,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  await mainWindow.loadURL(`http://${config.host}:${port}`);
  mainWindow.on('close', (event) => {
    if (!quitting && !smoke) { event.preventDefault(); mainWindow.hide(); }
  });
  if (!smoke) createTray();
  if (smoke) {
    const health = await (await fetch(`http://${config.host}:${port}/api/health`)).json();
    console.log(`SMOKE_OK ${JSON.stringify(health)}`);
    app.quit();
  }
}

app.whenReady().then(boot).catch((error) => {
  console.error(error);
  app.quit();
});

app.on('before-quit', () => {
  quitting = true;
  scheduler?.stop();
  runner?.shutdown().catch(() => {});
  server?.close();
});
