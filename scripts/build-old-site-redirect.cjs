const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const source = path.join(root, "redirect-site");
const output = path.join(root, "dist");

if (!fs.existsSync(source)) {
  console.error("[redirect-build] ERRO: pasta redirect-site nao encontrada.");
  process.exit(1);
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
fs.cpSync(source, output, { recursive: true });

const required = ["index.html", "_redirects", "_headers", "desativar-sw.js", "robots.txt"];
for (const file of required) {
  if (!fs.existsSync(path.join(output, file))) {
    console.error(`[redirect-build] ERRO: arquivo obrigatorio ausente: ${file}`);
    process.exit(1);
  }
}

console.log("[redirect-build] OK: dominio antigo redireciona para https://wmcplayer.pages.dev/aplicativo/");
