import { spawn } from 'node:child_process';
import { config } from './config.mjs';
import { Store } from './store.mjs';
import { Runner } from './runner.mjs';
import { createServer } from './server.mjs';
import { detectCliAdapters } from './detect.mjs';
import { Scheduler } from './scheduler.mjs';

const store = new Store(config.dataFile);
await store.init();
await store.applyDetectedAdapters(detectCliAdapters());
const runner = new Runner(store, () => {});
const scheduler = new Scheduler(store, runner);
const { server, emit } = createServer({ store, runner, scheduler, config });
scheduler.emit = emit;
scheduler.start();

server.listen(config.port, config.host, () => {
  const url = `http://${config.host}:${config.port}`;
  console.log(`Local Agent Office: ${url}`);
  console.log('종료하려면 Ctrl+C를 누르세요.');
  if (process.argv.includes('--open')) {
    const command = process.platform === 'win32' ? ['explorer.exe', [url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    spawn(command[0], command[1], { detached: true, stdio: 'ignore' }).unref();
  }
});

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  scheduler.stop();
  await runner.shutdown();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
