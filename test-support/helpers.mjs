import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function initGitRepo(dir) {
  await execFileAsync('git', ['init', '-b', 'main', dir], { windowsHide: true });
  await execFileAsync('git', ['-C', dir, 'config', 'user.email', 'tests@workpets.local'], { windowsHide: true });
  await execFileAsync('git', ['-C', dir, 'config', 'user.name', 'Workpets Tests'], { windowsHide: true });
  await fs.promises.writeFile(path.join(dir, '.gitignore'), '.workpets\n', 'utf8');
  await execFileAsync('git', ['-C', dir, 'add', '.gitignore'], { windowsHide: true });
  await execFileAsync('git', ['-C', dir, 'commit', '-m', 'Initial test repository'], { windowsHide: true });
  return dir;
}
