/**
 * Push the entire Automation/ tree to BitBurner home via Remote API.
 *
 * 1. Run:  node push-automation.js
 * 2. In game: Options → Remote API → hostname 127.0.0.1, port 12525 → Connect
 * 3. In game: run Automation/brain.js
 */
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = Number(process.env.PORT) || 12525;
const SERVER = "home";
const ROOT = path.resolve(__dirname, "..", "Automation");

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
if (files.length === 0) {
    console.error(`No .js files found under ${ROOT}`);
    process.exit(1);
}

let id = 0;
let waitingDots = 0;

const wss = new WebSocketServer({ port: PORT });

wss.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        console.error(`\nPort ${PORT} is already in use.`);
        console.error("Kill the old server, then retry:");
        console.error(`  Get-NetTCPConnection -LocalPort ${PORT} | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`);
    } else {
        console.error(err);
    }
    process.exit(1);
});

wss.on("connection", (ws) => {
    clearInterval(waitTimer);
    console.log(`\nBitBurner connected — pushing ${files.length} files to ${SERVER}...`);

    ws.on("message", (raw) => {
        try {
            const msg = JSON.parse(raw);
            if (msg.error) console.error("  << error:", msg.error);
            else if (msg.result) console.log(`  << ${msg.result}`);
        } catch {
            /* ignore */
        }
    });

    let pushed = 0;
    for (const file of files) {
        const content = fs.readFileSync(file.disk, "utf8");
        ws.send(JSON.stringify({
            jsonrpc: "2.0",
            id: ++id,
            method: "pushFile",
            params: { filename: file.game, content, server: SERVER },
        }));
        console.log(`  >> ${file.game}`);
        pushed++;
    }

    console.log(`\nDone — ${pushed} files sent.`);
    console.log("In BitBurner terminal:  run Automation/brain.js");
    setTimeout(() => process.exit(0), 2000);
});

const waitTimer = setInterval(() => {
    waitingDots = (waitingDots + 1) % 4;
    process.stdout.write(`\rWaiting for BitBurner to connect${".".repeat(waitingDots)}   `);
}, 500);

process.on("SIGINT", () => {
    clearInterval(waitTimer);
    console.log("\nStopped.");
    process.exit(0);
});

console.log("Automation deploy server");
console.log(`  Source: ${ROOT}`);
console.log(`  Files:  ${files.length}`);
console.log(`  Port:   ${PORT}`);
console.log("");
console.log("In BitBurner: Options → Remote API → 127.0.0.1 : 12525 → Connect");
console.log("(Leave this window open until files are pushed. Ctrl+C to cancel.)");
console.log("");