/**
 * Generates install-automation.js — a single in-game script that writes
 * the full Automation tree via ns.write (no Remote API needed).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "Automation");
const OUT = path.resolve(__dirname, "install-automation.js");

function collectJsFiles(dir, base = dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...collectJsFiles(full, base));
        else if (entry.name.endsWith(".js")) {
            const rel = path.relative(base, full).replace(/\\/g, "/");
            out.push({ disk: full, game: `/Automation/${rel}` });
        }
    }
    return out.sort((a, b) => a.game.localeCompare(b.game));
}

const files = collectJsFiles(ROOT);
const lines = [
    "/** @param {NS} ns */",
    "// One-shot installer — writes the Automation stack to home, then delete this script.",
    "export async function main(ns) {",
    '    ns.tprint("Installing Automation stack...");',
    "",
];

for (const file of files) {
    const content = fs.readFileSync(file.disk, "utf8");
    lines.push(`    ns.write(${JSON.stringify(file.game)}, ${JSON.stringify(content)}, "w");`);
    lines.push(`    ns.tprint("  ${file.game}");`);
}

lines.push("");
lines.push(`    ns.tprint("Done — ${files.length} files. Run: run Automation/brain.js");`);
lines.push("}");

fs.writeFileSync(OUT, lines.join("\n"), "utf8");
console.log(`Wrote ${OUT}`);
console.log(`  ${files.length} files, ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB`);
console.log("");
console.log("In BitBurner:");
console.log("  1. Create install-automation.js on home (paste from this file)");
console.log("  2. run install-automation.js");
console.log("  3. run Automation/brain.js");