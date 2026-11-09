#!/usr/bin/env node
/**
 * Privacy and secret scan for the public showcase repository. No dependencies.
 *
 *   node scripts/privacy-scan.mjs                 scan the working tree
 *   node scripts/privacy-scan.mjs --git-history   scan every patch and commit header in `git log --all`
 *   node scripts/privacy-scan.mjs --markdown      print the result as a Markdown table
 *
 * Exit code 0 = no findings outside the allowlist, 1 = findings, 2 = scanner error.
 *
 * Exceptions live in scripts/privacy-allowlist.json. Each entry names the rule, a path prefix, an
 * optional regular expression the matched text must satisfy, and a reason. An entry without a
 * reason is rejected. Allowlisted matches are still counted and printed, so nothing is hidden.
 *
 * Binary files (images, fonts, archives) are listed but not content-scanned: screenshots need a
 * visual review, which this script cannot do.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const HISTORY = args.has('--git-history');
const MARKDOWN = args.has('--markdown');

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', '.vercel', '.turbo']);
const BINARY_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.woff', '.woff2', '.ttf', '.otf', '.mp4', '.webm', '.mov']);
const SELF = new Set(['scripts/privacy-scan.mjs', 'scripts/privacy-allowlist.json']);

/** Shannon entropy in bits per character. */
function entropy(s) {
  const counts = new Map();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of counts.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

const PLACEHOLDER = /^(?:x+|\*+|\.\.\.|<[^>]*>|\$\{[^}]*\}|changeme|placeholder|example|your[-_a-z]*|redacted|\[redacted\]|none|null|undefined|empty|todo)$/i;

const RULES = [
  { id: 'private_key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { id: 'meta_token', re: /\bEAA[A-Za-z0-9]{20,}/g },
  { id: 'anthropic_key', re: /\bsk-ant-[A-Za-z0-9_-]{10,}/g },
  { id: 'generic_sk_key', re: /\bsk-(?!ant-)[A-Za-z0-9]{20,}/g },
  { id: 'aws_key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { id: 'github_token', re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g },
  {
    id: 'assigned_secret',
    re: /\b([A-Za-z0-9_]*(?:SECRET|TOKEN|API_KEY|APIKEY|PASSWORD|PASSWD|PRIVATE_KEY|ACCESS_KEY)[A-Za-z0-9_]*)\s*[:=]\s*['"`]?([^\s'"`,;)]{12,})/gi,
    accept: (m) => {
      const value = m[2];
      if (PLACEHOLDER.test(value)) return false;
      if (/^process\.env|^env\.|^config\.|^opts\.|^deps\.|^this\./.test(value)) return false;
      return entropy(value) >= 3.5;
    }
  },
  { id: 'db_url_with_credentials', re: /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:@/'"]+:[^\s@/'"]+@[^\s'"]+/gi },
  { id: 'email', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { id: 'phone_si_international', re: /(?:\+|00)386[\s/-]?\(?0?\d{1,2}\)?[\s/-]?\d{3}[\s/-]?\d{2,4}(?:[\s/-]?\d{2})?/g },
  { id: 'phone_si_local', re: /(?<![\d.:/-])0\d{1,2}[ /-]\d{3}[ -]\d{3,4}(?![\d.:/-])/g },
  { id: 'long_numeric_id', re: /(?<![\w.-])\d{13,}(?![\w.-])/g },
  { id: 'user_path', re: /[A-Za-z]:\\Users\\|\/[cC]\/Users\/|\/home\/[a-z][\w-]*\/|OneDrive|12media/g },
  { id: 'internal_host', re: /\bneoserv\b|\b(?!www\.)[a-z0-9-]+\.pravniknadlani\.si\b/gi },
  { id: 'private_handle', re: /\bMaj\b|enadva/g }
];

function loadAllowlist() {
  const file = path.join(ROOT, 'scripts', 'privacy-allowlist.json');
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const list = JSON.parse(raw);
  if (!Array.isArray(list)) throw new Error('privacy-allowlist.json must be an array');
  return list.map((e, i) => {
    if (!e.rule || typeof e.path !== 'string' || !e.reason || String(e.reason).trim().length < 15) {
      throw new Error(`allowlist entry ${i} needs rule, path and a reason of at least 15 characters`);
    }
    return { ...e, matchRe: e.match ? new RegExp(e.match) : null, used: 0 };
  });
}

function allowed(allowlist, rule, file, text) {
  for (const e of allowlist) {
    if (e.rule !== rule && e.rule !== '*') continue;
    if (!file.startsWith(e.path)) continue;
    if (e.matchRe && !e.matchRe.test(text)) continue;
    e.used += 1;
    return e;
  }
  return null;
}

function scanText(file, content, findings, allowlist, lineOffsetLabel) {
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(line)) !== null) {
        if (rule.accept && !rule.accept(m)) continue;
        const text = m[0];
        const entry = allowed(allowlist, rule.id, file, text);
        findings.push({ rule: rule.id, file, line: lineOffsetLabel ? lineOffsetLabel(idx) : idx + 1, text: text.slice(0, 80), allowlisted: entry ? entry.reason : null });
      }
    }
  });
}

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
}

function scanTree(allowlist) {
  const files = [];
  walk(ROOT, files);
  const findings = [];
  const binaries = [];
  for (const full of files) {
    const rel = path.relative(ROOT, full).split(path.sep).join('/');
    if (SELF.has(rel)) continue;
    if (BINARY_EXT.has(path.extname(rel).toLowerCase())) {
      binaries.push(rel);
      continue;
    }
    const buf = readFileSync(full);
    if (buf.includes(0)) {
      binaries.push(rel);
      continue;
    }
    scanText(rel, buf.toString('utf8'), findings, allowlist);
  }
  return { findings, binaries, scanned: files.length - binaries.length };
}

function scanHistory(allowlist) {
  const git = (a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  const findings = [];
  // Commit metadata: author and committer identities are public once pushed.
  const headers = git(['log', '--all', '--format=%H%x09%an <%ae>%x09%cn <%ce>%x09%s']);
  for (const line of headers.split('\n').filter(Boolean)) {
    const [hash, author, committer, subject] = line.split('\t');
    scanText(`commit:${hash.slice(0, 7)}`, `${author}\n${committer}\n${subject ?? ''}`, findings, allowlist, (i) => ['author', 'committer', 'subject'][i]);
  }
  // Added lines of every patch.
  const log = git(['log', '--all', '-p', '--no-color', '--no-ext-diff', '--format=commit %H']);
  let commit = '';
  let file = '';
  for (const line of log.split('\n')) {
    if (line.startsWith('commit ')) {
      commit = line.slice(7, 14);
      continue;
    }
    if (line.startsWith('+++ ')) {
      file = line.replace(/^\+\+\+ (b\/)?/, '');
      continue;
    }
    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    if (SELF.has(file) || BINARY_EXT.has(path.extname(file).toLowerCase())) continue;
    scanText(file, line.slice(1), findings, allowlist, () => `@${commit}`);
  }
  return { findings, binaries: [], scanned: null };
}

try {
  const allowlist = loadAllowlist();
  const { findings, binaries, scanned } = HISTORY ? scanHistory(allowlist) : scanTree(allowlist);
  const open = findings.filter((f) => !f.allowlisted);
  const ok = findings.filter((f) => f.allowlisted);
  const mode = HISTORY ? 'git history (all refs)' : 'working tree';
  if (MARKDOWN) {
    console.log(`**Mode:** ${mode}. Open findings: ${open.length}. Allowlisted: ${ok.length}.${scanned !== null ? ` Text files scanned: ${scanned}; binary files not content-scanned: ${binaries.length}.` : ''}\n`);
    if (open.length) {
      console.log('| Rule | File | Line | Match |\n|---|---|---|---|');
      for (const f of open) console.log(`| ${f.rule} | \`${f.file}\` | ${f.line} | \`${f.text.replace(/\|/g, '\\|')}\` |`);
    }
  } else {
    console.log(`privacy-scan: ${mode}`);
    if (scanned !== null) console.log(`  text files scanned: ${scanned}, binary files not content-scanned: ${binaries.length}`);
    for (const f of open) console.log(`  FINDING ${f.rule.padEnd(24)} ${f.file}:${f.line}  ${f.text}`);
    const byReason = new Map();
    for (const f of ok) byReason.set(f.allowlisted, (byReason.get(f.allowlisted) ?? 0) + 1);
    for (const [reason, n] of byReason) console.log(`  allowlisted x${n}: ${reason}`);
    for (const e of allowlist) if (e.used === 0) console.log(`  note: allowlist entry for ${e.rule} @ ${e.path} matched nothing (remove it?)`);
    console.log(open.length ? `  ${open.length} open finding(s)` : '  no open findings');
  }
  process.exit(open.length ? 1 : 0);
} catch (err) {
  console.error(`privacy-scan failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
}
