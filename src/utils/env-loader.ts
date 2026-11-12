/**
 * Minimal .env loader — no deps.
 *
 * Reads ./.env from cwd and populates process.env WITHOUT overwriting
 * values already set by the shell. This preserves the precedence:
 *   shell env  >  .env  >  defaults
 *
 * Supported syntax:
 *   KEY=value
 *   KEY="value with spaces"
 *   KEY='value'
 *   # comment lines
 *   blank lines
 *
 * Not supported (keep it simple): multi-line values, variable expansion.
 */
import { readFileSync, existsSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';

const LINE_RE = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i;

export function loadEnvFile(path: string = resolve(process.cwd(), '.env')): Record<string, string> {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, 'utf-8');
  const out: Record<string, string> = {};

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const m = line.match(LINE_RE);
    if (!m) continue;
    const key = m[1];
    let val = m[2];

    // Strip inline comments (only when value isn't quoted)
    if (!/^["']/.test(val)) {
      const hashIdx = val.indexOf(' #');
      if (hashIdx >= 0) val = val.slice(0, hashIdx).trim();
    }

    // Unquote
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }

    out[key] = val;
    // Shell env takes precedence — don't clobber
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }

  return out;
}

/**
 * Merge KV pairs into .env (preserves existing lines, updates matching keys, appends new).
 */
export function writeEnvFile(updates: Record<string, string>, path: string = resolve(process.cwd(), '.env')): void {
  const existing = existsSync(path) ? readFileSync(path, 'utf-8') : '';
  const lines = existing.split(/\r?\n/);
  const seen = new Set<string>();

  const patched = lines.map(line => {
    const m = line.match(LINE_RE);
    if (!m) return line;
    const key = m[1];
    if (key in updates) {
      seen.add(key);
      return `${key}=${quoteIfNeeded(updates[key])}`;
    }
    return line;
  });

  // Drop trailing blank lines for clean append
  while (patched.length > 0 && patched[patched.length - 1].trim() === '') patched.pop();

  const toAppend: string[] = [];
  for (const [k, v] of Object.entries(updates)) {
    if (!seen.has(k)) toAppend.push(`${k}=${quoteIfNeeded(v)}`);
  }

  // Only add the header once — skip if the file already has it
  const hasHeader = patched.some(l => l.trim() === '# Added by `ao init`');
  const appendBlock = toAppend.length
    ? (hasHeader ? ['', ...toAppend] : ['', '# Added by `ao init`', ...toAppend])
    : [];
  const final = [...patched, ...appendBlock, ''].join('\n');
  writeFileSync(path, final, 'utf-8');
  // Lock down — .env often contains API keys. Windows ignores chmod, so swallow errors.
  try { chmodSync(path, 0o600); } catch { /* non-POSIX fs */ }
}

function quoteIfNeeded(v: string): string {
  if (/[\s#"']/.test(v)) return `"${v.replace(/"/g, '\\"')}"`;
  return v;
}

/**
 * Ensure .env is in .gitignore (only if .gitignore exists).
 */
export function ensureEnvGitignored(cwd: string = process.cwd()): boolean {
  const gitignorePath = resolve(cwd, '.gitignore');
  if (!existsSync(gitignorePath)) return false;
  const content = readFileSync(gitignorePath, 'utf-8');
  const hasEnv = content.split(/\r?\n/).some(l => l.trim() === '.env');
  if (hasEnv) return false;
  const appended = content + (content.endsWith('\n') ? '' : '\n') + '\n# momogsm local config\n.env\n';
  writeFileSync(gitignorePath, appended, 'utf-8');
  return true;
}
