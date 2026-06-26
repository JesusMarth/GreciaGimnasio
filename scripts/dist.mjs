// scripts/dist.mjs — empaqueta un ZIP de respaldo para distribución OFFLINE.
//
// Lo normal es actualizar el PC del gimnasio con `Actualizar.bat` (tira de
// GitHub). Este ZIP es el plan B: para llevar la app en un USB cuando no haya
// internet en el local.
//
// Qué hace:
//   1. `npm run build`  -> verifica que la web compila (si falla, no se publica).
//   2. `git archive`    -> mete en el ZIP SOLO lo versionado en git, así que
//      quedan fuera data/ (socios reales), node_modules/ y dist/ por estar en
//      .gitignore, y entra la BD de prueba (data-mock/gymgrecia.db) que sí se
//      versiona. El ZIP es idéntico al commit/tag publicado.
//
// Salida: ../GreciaGimnasio.zip (junto a la carpeta del proyecto).

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const run = (cmd) => execSync(cmd, { cwd: repoRoot, stdio: "inherit" });

const pkg = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
const version = pkg.version;
const zipPath = resolve(repoRoot, "..", "GreciaGimnasio.zip");

console.log(`\n📦 Empaquetando GymGrecia v${version}\n`);

// Aviso si hay cambios sin commitear: el ZIP sale de HEAD, no del working tree.
const sucio = execSync("git status --porcelain", {
  cwd: repoRoot,
  encoding: "utf8",
}).trim();
if (sucio) {
  console.warn(
    "⚠️  Hay cambios sin commitear. El ZIP se genera desde el último commit\n" +
      "    (HEAD), así que NO incluirá esos cambios. Haz commit primero si los\n" +
      "    quieres dentro.\n",
  );
}

console.log("→ Compilando la web (npm run build)…");
run("npm run build");

console.log("\n→ Generando el ZIP (git archive)…");
run(`git archive --format=zip -o "${zipPath}" --prefix=GreciaGimnasio/ HEAD`);

console.log(`\n✅ Listo: ${zipPath}`);
console.log("   (solo ficheros versionados; sin data/ real, sin node_modules)\n");
