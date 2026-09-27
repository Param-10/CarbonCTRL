/**
 * Resolve the Python interpreter used to run the ML scripts in /ml.
 *
 * Preference order:
 *   1. process.env.PYTHON_BIN (explicit override)
 *   2. A local virtualenv at <repo>/.venv-ml (created by setup scripts)
 *   3. `python3` on PATH
 *
 * The ML scripts import `models.*` from the ml/ directory and rely on heavy
 * deps (tensorflow 2.x etc.) that are not safe to install globally, so they
 * are provisioned in .venv-ml.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.join(__dirname, '..', '..');

export function resolvePythonBin() {
  if (process.env.PYTHON_BIN) {
    return process.env.PYTHON_BIN;
  }
  const venvPython = path.join(repoRoot, '.venv-ml', 'bin', 'python');
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }
  return 'python3';
}