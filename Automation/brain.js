/** @param {NS} ns */
// ═══════════════════════════════════════════════════════════════════════════════
// Automation Brain — lightweight orchestrator for the full automation stack
// ═══════════════════════════════════════════════════════════════════════════════
// Entry:  run Automation/brain.js
//
// Architecture:
//   brain.js       — schedules modules, owns network map, picks exec hosts
//   modules/*.js   — feature logic (hack, factions, infra, …) — added over time
//   workers/*.js   — tiny scripts deployed to rooted servers for RAM sharing
//
// API notes (BitBurner 3.0.1):
//   ns.cloud.*          purchased servers (formerly purchaseServer)
//   hacknet-server-*    scan-visible; not hackable world servers
//   ns.nuke()           returns boolean (does not throw on failure)
//   ns.exec/scriptRunning  launch & dedupe modules on best available host
// ═══════════════════════════════════════════════════════════════════════════════

import { sfLevel, singularityReady } from "/Automation/lib/shared.js";

const ROOT = "/Automation";

const KIND = {
    HOME: "home",
    CLOUD: "cloud",
    HACKNET: "hacknet",
    WORLD: "world",
};

/** @type {{ script: string, every: number, phase: number, label: string, daemon?: boolean }[]} */
const MODULES = [
    { script: `${ROOT}/modules/hack.js`,       every: 3,   phase: 0, label: "Hack",       daemon: true },
    { script: `${ROOT}/modules/work.js`,       every: 5,   phase: 1, label: "Work",       daemon: true },
    { script: `${ROOT}/modules/sleeves.js`,    every: 30,  phase: 2, label: "Sleeves" },
    { script: `${ROOT}/modules/home.js`,       every: 45,  phase: 3, label: "Home" },
    { script: `${ROOT}/modules/programs.js`,   every: 45,  phase: 4, label: "Programs" },
    { script: `${ROOT}/modules/infra.js`,      every: 40,  phase: 5, label: "Infra" },
    { script: `${ROOT}/modules/factions.js`,   every: 50,  phase: 6, label: "Factions" },
    { script: `${ROOT}/modules/hacknet.js`,    every: 55,  phase: 7, label: "Hacknet" },
    { script: `${ROOT}/modules/backdoor.js`,  every: 65,  phase: 8, label: "Backdoor" },
    { script: `${ROOT}/modules/study.js`,      every: 70,  phase: 9, label: "Study" },
    { script: `${ROOT}/modules/create.js`,    every: 75,  phase: 10, label: "Create" },
    { script: `${ROOT}/modules/augments.js`,   every: 80,  phase: 11, label: "Augments" },
    { script: `${ROOT}/modules/grafting.js`,   every: 85,  phase: 12, label: "Grafting" },
    { script: `${ROOT}/modules/contracts.js`, every: 90, phase: 13, label: "Contracts" },
    { script: `${ROOT}/modules/install.js`,   every: 120, phase: 14, label: "Install" },
];

const WORKERS = [
    `${ROOT}/workers/hack.js`,
    `${ROOT}/workers/grow.js`,
    `${ROOT}/workers/weaken.js`,
];

const CRACKERS = [
    ["BruteSSH.exe", "brutessh"],
    ["FTPCrack.exe", "ftpcrack"],
    ["relaySMTP.exe", "relaysmtp"],
    ["HTTPWorm.exe", "httpworm"],
    ["SQLInject.exe", "sqlinject"],
];

export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    const CFG = {
        loopMs: 1000,
        scanEvery: 12,
        statusEvery: 5,
        minWorkerRam: 2,
        minExecRam: 1.6,
    };

    const S = {
        tick: 0,
        hosts: [],
        byKind: { [KIND.HOME]: [], [KIND.CLOUD]: [], [KIND.HACKNET]: [], [KIND.WORLD]: [] },
        rooted: [],
        cloud: new Set(),
        workersDeployed: 0,
        modulesQueued: 0,
        missingModules: new Set(),
    };

    ns.print("Brain online — full automation stack.");

    while (true) {
        S.tick++;

        if (S.tick === 1 || S.tick % CFG.scanEvery === 1) {
            refreshNetwork(ns, S, CFG);
        }

        scheduleModules(ns, S);
        await ns.sleep(CFG.loopMs);

        if (S.tick % CFG.statusEvery === 0) showStatus(ns, S);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NETWORK
// ═══════════════════════════════════════════════════════════════════════════════

function refreshNetwork(ns, S, CFG) {
    S.cloud = new Set(ns.cloud.getServerNames());
    S.hosts = crawl(ns);
    resetBuckets(S);

    const crackers = availableCrackers(ns);
    let deployed = 0;

    for (const host of S.hosts) {
        const kind = classifyHost(host, S.cloud);
        S.byKind[kind].push(host);

        if (kind === KIND.WORLD) {
            tryRoot(ns, host, crackers);
        } else if (kind === KIND.HACKNET) {
            // Player-owned; always rooted — skip port crack / nuke APIs
            S.rooted.push(host);
        }

        if (ns.hasRootAccess(host)) {
            if (!S.rooted.includes(host)) S.rooted.push(host);
            if (isWorkerHost(kind) && ns.getServerMaxRam(host) >= CFG.minWorkerRam) {
                if (deployWorkers(ns, host) > 0) deployed++;
            }
        }
    }

    S.workersDeployed = deployed;
}

function crawl(ns) {
    const seen = new Set(["home"]);
    const queue = ["home"];
    const out = [];
    while (queue.length > 0) {
        const host = queue.shift();
        for (const n of ns.scan(host)) {
            if (!seen.has(n)) {
                seen.add(n);
                queue.push(n);
                out.push(n);
            }
        }
    }
    return out;
}

function classifyHost(host, cloudSet) {
    if (host === "home") return KIND.HOME;
    if (host.startsWith("hacknet-server-")) return KIND.HACKNET;
    if (cloudSet.has(host)) return KIND.CLOUD;
    return KIND.WORLD;
}

function isWorkerHost(kind) {
    return kind === KIND.HOME || kind === KIND.CLOUD || kind === KIND.HACKNET;
}

function isHackable(ns, host) {
    if (host === "home" || host.startsWith("hacknet-server-")) return false;
    try {
        return ns.getServerMaxMoney(host) > 0;
    } catch {
        return false;
    }
}

function availableCrackers(ns) {
    return CRACKERS.filter(([exe]) => ns.fileExists(exe, "home"));
}

function tryRoot(ns, host, crackers) {
    if (ns.hasRootAccess(host)) return;

    if (ns.getServerRequiredHackingLevel(host) > ns.getHackingLevel()) return;
    if (ns.getServerNumPortsRequired(host) > crackers.length) return;

    for (const [, api] of crackers) ns[api](host);
    ns.nuke(host);
}

function deployWorkers(ns, host) {
    const existing = WORKERS.filter((w) => ns.fileExists(w, "home"));
    if (existing.length === 0) return 0;

    for (const w of existing) {
        if (!ns.fileExists(w, host)) ns.scp(w, host, "home");
    }
    return existing.length;
}

function resetBuckets(S) {
    S.byKind[KIND.HOME] = ["home"];
    S.byKind[KIND.CLOUD] = [];
    S.byKind[KIND.HACKNET] = [];
    S.byKind[KIND.WORLD] = [];
    S.rooted = ["home"];
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE SCHEDULER
// ═══════════════════════════════════════════════════════════════════════════════

function scheduleModules(ns, S) {
    let queued = 0;

    for (const mod of MODULES) {
        if (S.tick % mod.every !== mod.phase) continue;
        if (!ns.fileExists(mod.script, "home")) {
            S.missingModules.add(mod.label);
            continue;
        }
        S.missingModules.delete(mod.label);

        if (ensureRunning(ns, S, mod.script)) queued++;
    }

    S.modulesQueued = queued;
}

/**
 * Launch `script` on the best host with free RAM if not already running anywhere.
 * @returns {boolean} true if newly launched
 */
function ensureRunning(ns, S, script) {
    for (const host of execCandidates(S)) {
        if (ns.scriptRunning(script, host)) return false;
    }

    const ram = ns.getScriptRam(script, "home");
    for (const host of execCandidates(S)) {
        const free = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
        if (free < ram) continue;
        const pid = ns.exec(script, host, { threads: 1, preventDuplicates: true });
        if (pid > 0) return true;
    }
    return false;
}

/** Hosts preferred for module execution: home → cloud → hacknet → rooted world */
function execCandidates(S) {
    return ["home", ...S.byKind[KIND.CLOUD], ...S.byKind[KIND.HACKNET]];
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS
// ═══════════════════════════════════════════════════════════════════════════════

function showStatus(ns, S) {
    const homeMoney = ns.getServerMoneyAvailable("home");
    const homeRam = ns.getServerMaxRam("home");
    const homeUsed = ns.getServerUsedRam("home");
    const hackable = S.byKind[KIND.WORLD].filter((h) => isHackable(ns, h)).length;

    ns.clearLog();
    ns.print("┌────────────────────────────────────────────────┐");
    ns.print(`│  🧠 AUTOMATION BRAIN  ${new Date().toLocaleTimeString().padStart(22)}│`);
    ns.print("├────────────────────────────────────────────────┤");
    ns.print(`│ 💰 $${ns.format.number(homeMoney).padEnd(18)} 🧠 Hack ${ns.getHackingLevel()}`);
    if (singularityReady(ns)) {
        const sf4 = sfLevel(ns, 4);
        const sf10 = sfLevel(ns, 10);
        ns.print(`│ 📁 SF4-${sf4} SF10-${sf10} (sing. RAM ×${sf4 >= 3 ? 1 : sf4 >= 2 ? 4 : 16})`.padEnd(41) + "│");
    }
    ns.print(`│ 🏠 RAM ${ns.format.ram(homeUsed)}/${ns.format.ram(homeRam)}`.padEnd(41) + "│");
    ns.print(`│ 🌐 ${S.hosts.length} hosts  🔓 ${S.rooted.length} rooted`.padEnd(41) + "│");
    ns.print(`│ ☁️  ${S.byKind[KIND.CLOUD].length} cloud  ⛓️  ${S.byKind[KIND.HACKNET].length} hacknet`.padEnd(41) + "│");
    ns.print(`│ 🎯 ${hackable} hackable world servers`.padEnd(41) + "│");
    ns.print(`│ 📦 Workers staged on ${S.workersDeployed} hosts`.padEnd(41) + "│");
    ns.print(`│ ▶️  Modules started this tick: ${S.modulesQueued}`.padEnd(41) + "│");

    const live = MODULES.filter((m) => ns.fileExists(m.script, "home")).map((m) => m.label);
    const pending = [...S.missingModules];
    if (live.length) ns.print(`│ ✅ ${live.join(", ")}`.padEnd(41) + "│");
    if (pending.length) ns.print(`│ ⏳ Pending: ${pending.join(", ")}`.padEnd(41) + "│");

    ns.print("├────────────────────────────────────────────────┤");
    ns.print(`│ Tick ${S.tick}`.padEnd(41) + "│");
    ns.print("└────────────────────────────────────────────────┘");
}