/**
 * Push only install-automation.js (one file) via Remote API.
 * Run install-automation.js in game to unpack the full stack.
 *
 * First: node generate-bootstrap.js  (if Automation changed)
 * Then:  node push-install.js
 */
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = 12525;
const INSTALLER = path.resolve(__dirname, "install-automation.js");

if (!fs.existsSync(INSTALLER)) {
    console.error("Missing install-automation.js — run: node generate-bootstrap.js");
    process.exit(1);
}

const content = fs.readFileSync(INSTALLER, "utf8");
let waitingDots = 0;

const wss = new WebSocketServer({ port: PORT });

wss.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        console.error(`Port ${PORT} in use. Run deploy.ps1 or kill the old server.`);
    } else {
        console.error(err);
    }
    process.exit(1);
});

wss.on("connection", (ws) => {
    clearInterval(waitTimer);
    console.log("\nConnected — pushing install-automation.js ...");
    ws.send(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "pushFile",
        params: { filename: "/install-automation.js", content, server: "home" },
    }));
    console.log("Done. In game:");
    console.log("  run install-automation.js");
    console.log("  run Automation/brain.js");
    setTimeout(() => process.exit(0), 2000);
});

const waitTimer = setInterval(() => {
    waitingDots = (waitingDots + 1) % 4;
    process.stdout.write(`\rWaiting for BitBurner to connect${".".repeat(waitingDots)}   `);
}, 500);

console.log(`Installer: ${(content.length / 1024).toFixed(1)} KB → /install-automation.js`);
console.log("Options → Remote API → 127.0.0.1 : 12525 → Connect");