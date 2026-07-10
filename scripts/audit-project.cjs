const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const issues = [];

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

const sourceFiles = [...walk(path.join(root, "src")), ...walk(path.join(root, "public"))]
  .filter((file) => /\.(ts|tsx|js|jsx|html|css)$/.test(file));

for (const file of sourceFiles) {
  const content = read(file);
  const rel = path.relative(root, file);
  if (/sb_secret_|SUPABASE_SERVICE_ROLE_KEY\s*=|EFI_CLIENT_SECRET\s*=/.test(content)) {
    issues.push(`${rel}: segredo de servidor encontrado em arquivo público`);
  }
}

const allSource = sourceFiles.map(read).join("\n");
const channelCount = (allSource.match(/\.channel\s*\(/g) || []).length;
if (channelCount > 1) issues.push(`Realtime: encontrados ${channelCount} canais no front-end; permitido no máximo 1`);

for (const file of sourceFiles) {
  const content = read(file);
  const rel = path.relative(root, file);
  const intervalRegex = /setInterval\s*\(([\s\S]{0,1200}?)\)\s*,\s*\d+/g;
  for (const match of content.matchAll(intervalRegex)) {
    if (/fetch\s*\(|supabase\.|functions\.invoke|\.from\s*\(/.test(match[1])) {
      issues.push(`${rel}: consulta de rede dentro de setInterval (polling proibido)`);
    }
  }
}

const notificationGate = read(path.join(root, "src/components/NotificationGate.tsx"));
if (/setInterval\s*\(\s*checkPermission/.test(notificationGate)) {
  issues.push("NotificationGate: verificação de permissão por timer detectada");
}

const installGate = read(path.join(root, "src/components/InstallGate.tsx"));
if (/forceClearAllCaches/.test(installGate)) {
  issues.push("InstallGate: limpeza destrutiva de cache detectada");
}

const auth = read(path.join(root, "src/contexts/AuthContext.tsx"));
if (!/getUserAccessDeniedMessage/.test(auth)) issues.push("AuthContext: regra central de usuário desativado ausente");

const bats = walk(root).filter((f) => /\.bat$/i.test(f));
for (const file of bats) {
  const data = fs.readFileSync(file);
  if (data.length >= 3 && data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) {
    issues.push(`${path.relative(root, file)}: arquivo BAT com BOM UTF-8`);
  }
}

if (issues.length) {
  console.error("\n[audit-project] FALHOU:\n");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`[audit-project] OK: ${sourceFiles.length} arquivos verificados; ${channelCount} canal Realtime no front-end.`);
