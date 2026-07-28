/** @param {NS} ns */
// ═══════════════════════════════════════════════════════════════════════════════
// Hack Module — HWGW shotgun batcher + target prep
// ═══════════════════════════════════════════════════════════════════════════════
// Long-running daemon launched by brain.js. Uses /Automation/workers/* on the
// shared worker pool (home, cloud, hacknet, rooted world servers).
// ═══════════════════════════════════════════════════════════════════════════════

const ROOT = "/Automation";

const CFG = {
    maxTargets: 15,
    hackPct: 0.25,
    secThresh: 5,
    moneyThresh: 0.75,
    workerH: `${ROOT}/workers/hack.js`,
    workerG: `${ROOT}/workers/grow.js`,
    workerW: `${ROOT}/workers/weaken.js`,
    spacing: 25,
    maxBatchesPerTgt: 500,
    maxTotalBatches: 5000,
    loopMs: 2000,
    scanEvery: 15,
    statusEvery: 6,
};

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

    const S = {
        hosts: [],
        rooted: [],
        cloud: new Set(),
        targets: [],
        tick: 0,
        hasFormulas: false,
        batchesLast: 0,
    };

    while (true) {
        S.tick++;

        if (S.tick === 1 || S.tick % CFG.scanEvery === 1) {
            refreshNetwork(ns, S);
            S.hasFormulas = ns.fileExists("Formulas.exe", "home");
        }

        deployHacking(ns, S);

        if (S.tick % CFG.statusEvery === 0) showStatus(ns, S);

        await ns.sleep(CFG.loopMs);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NETWORK
// ═══════════════════════════════════════════════════════════════════════════════

function isHacknetServer(host) {
    return host.startsWith("hacknet-server-");
}

function refreshNetwork(ns, S) {
    S.cloud = new Set(ns.cloud.getServerNames());
    S.hosts = crawl(ns);
    S.rooted = ["home"];

    const crackers = CRACKERS.filter(([exe]) => ns.fileExists(exe, "home"));

    for (const host of S.hosts) {
        if (isHacknetServer(host)) {
            S.rooted.push(host);
            continue;
        }

        if (!ns.hasRootAccess(host)) {
            if (ns.getServerRequiredHackingLevel(host) > ns.getHackingLevel()) continue;
            if (ns.getServerNumPortsRequired(host) > crackers.length) continue;
            for (const [, api] of crackers) ns[api](host);
            ns.nuke(host);
        }

        if (ns.hasRootAccess(host)) S.rooted.push(host);
    }
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

// ═══════════════════════════════════════════════════════════════════════════════
// TARGET SCORING
// ═══════════════════════════════════════════════════════════════════════════════

function scoreTarget(ns, host, hasFormulas) {
    if (host === "home" || isHacknetServer(host)) return 0;
    const maxMoney = ns.getServerMaxMoney(host);
    if (maxMoney === 0) return 0;
    if (ns.getServerRequiredHackingLevel(host) > ns.getHackingLevel()) return 0;

    if (hasFormulas) {
        try {
            const srv = ns.getServer(host);
            const player = ns.getPlayer();
            srv.hackDifficulty = srv.minDifficulty;
            srv.moneyAvailable = srv.moneyMax;
            const chance = ns.formulas.hacking.hackChance(srv, player);
            const pct = ns.formulas.hacking.hackPercent(srv, player);
            const time = ns.formulas.hacking.hackTime(srv, player) / 1000;
            if (chance <= 0 || pct <= 0 || time <= 0) return 0;
            return (chance * pct * maxMoney) / time;
        } catch {
            /* fallback */
        }
    }

    const minSec = ns.getServerMinSecurityLevel(host);
    const growth = ns.getServerGrowth(host);
    const diff = Math.max(0.1, ns.getServerRequiredHackingLevel(host) / ns.getHackingLevel());
    return (maxMoney / 1e6) * (growth / 100) / Math.max(1, minSec) / diff;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKER POOL
// ═══════════════════════════════════════════════════════════════════════════════

function getWorkerPool(ns, S) {
    const world = [], cloud = [];
    let homeEntry = null;
    const seen = new Set();

    for (const host of ["home", ...S.rooted]) {
        if (seen.has(host)) continue;
        seen.add(host);

        const max = ns.getServerMaxRam(host);
        if (max < 2) continue;
        const free = max - ns.getServerUsedRam(host);
        if (free < 1.75) continue;

        const entry = { host, free };
        if (host === "home") homeEntry = entry;
        else if (S.cloud.has(host) || isHacknetServer(host)) cloud.push(entry);
        else world.push(entry);
    }

    const pool = [...world, ...cloud];
    if (homeEntry) pool.push(homeEntry);
    return pool;
}

function spawnAcross(ns, script, target, threads, pool, delay) {
    const ramPer = ns.getScriptRam(script, "home");
    if (ramPer <= 0 || threads <= 0) return 0;

    let remaining = threads;
    for (const w of pool) {
        if (remaining <= 0) break;
        const canRun = Math.floor(w.free / ramPer);
        if (canRun <= 0) continue;
        const t = Math.min(canRun, remaining);
        if (ns.exec(script, w.host, t, target, delay || 0) > 0) {
            w.free -= t * ramPer;
            remaining -= t;
        }
    }
    return threads - remaining;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HWGW BATCH CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════════

function calcBatch(ns, host, hackPct, hasFormulas) {
    let hackTime, growTime, weakenTime, hThreads, gThreads;

    if (hasFormulas) {
        try {
            const srv = ns.getServer(host);
            const player = ns.getPlayer();
            const cores = ns.getServer("home").cpuCores;
            srv.hackDifficulty = srv.minDifficulty;
            srv.moneyAvailable = srv.moneyMax;

            hackTime = ns.formulas.hacking.hackTime(srv, player);
            growTime = ns.formulas.hacking.growTime(srv, player);
            weakenTime = ns.formulas.hacking.weakenTime(srv, player);

            const hackPerThread = ns.formulas.hacking.hackPercent(srv, player);
            if (hackPerThread <= 0) return null;
            hThreads = Math.max(1, Math.floor(hackPct / hackPerThread));
            const stolen = Math.min(0.99, hackPerThread * hThreads);
            const growRatio = 1 / (1 - stolen);

            srv.moneyAvailable = srv.moneyMax * (1 - stolen);
            gThreads = 1;
            while (gThreads < 5000) {
                const mult = ns.formulas.hacking.growPercent(srv, gThreads, player, cores);
                if (mult >= growRatio) break;
                gThreads = Math.ceil(gThreads * 1.2) + 1;
            }
        } catch {
            return calcBatchFallback(ns, host, hackPct);
        }
    } else {
        hackTime = ns.getHackTime(host);
        growTime = ns.getGrowTime(host);
        weakenTime = ns.getWeakenTime(host);
        const result = calcBatchFallback(ns, host, hackPct);
        if (!result) return null;
        return { ...result, hackTime, growTime, weakenTime };
    }

    const w1Threads = Math.max(1, Math.ceil(hThreads * 0.002 / 0.05));
    const w2Threads = Math.max(1, Math.ceil(gThreads * 0.004 / 0.05));

    return { hThreads, w1Threads, gThreads, w2Threads, hackTime, growTime, weakenTime };
}

function calcBatchFallback(ns, host, hackPct) {
    const hackAmt = ns.hackAnalyze(host);
    if (hackAmt <= 0) return null;
    const hThreads = Math.max(1, Math.floor(hackPct / hackAmt));
    const stolen = Math.min(0.99, hackAmt * hThreads);
    const growRatio = 1 / (1 - stolen);
    const gThreads = Math.ceil(ns.growthAnalyze(host, growRatio));
    const w1Threads = Math.max(1, Math.ceil(hThreads * 0.002 / 0.05));
    const w2Threads = Math.max(1, Math.ceil(gThreads * 0.004 / 0.05));

    return {
        hThreads, w1Threads, gThreads, w2Threads,
        hackTime: ns.getHackTime(host),
        growTime: ns.getGrowTime(host),
        weakenTime: ns.getWeakenTime(host),
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEPLOY
// ═══════════════════════════════════════════════════════════════════════════════

function deployHacking(ns, S) {
    const scored = S.rooted
        .filter((h) => !isHacknetServer(h) &&
            ns.getServerMaxMoney(h) > 0 &&
            ns.getServerRequiredHackingLevel(h) <= ns.getHackingLevel())
        .map((h) => ({ host: h, score: scoreTarget(ns, h, S.hasFormulas) }))
        .filter((t) => t.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, CFG.maxTargets);

    S.targets = scored;
    const pool = getWorkerPool(ns, S);

    const prepped = [], unprepped = [];
    for (const t of scored) {
        const money = ns.getServerMoneyAvailable(t.host);
        const max = ns.getServerMaxMoney(t.host);
        const sec = ns.getServerSecurityLevel(t.host);
        const minS = ns.getServerMinSecurityLevel(t.host);
        if (money >= max * CFG.moneyThresh && sec <= minS + CFG.secThresh) prepped.push(t);
        else unprepped.push(t);
    }

    for (const t of unprepped) {
        const sec = ns.getServerSecurityLevel(t.host);
        const minS = ns.getServerMinSecurityLevel(t.host);
        const money = ns.getServerMoneyAvailable(t.host);
        const max = ns.getServerMaxMoney(t.host);

        if (sec > minS + CFG.secThresh) {
            spawnAcross(ns, CFG.workerW, t.host, Math.ceil((sec - minS) / 0.05), pool, 0);
        } else if (money < max * CFG.moneyThresh) {
            const ratio = max / Math.max(1, money);
            const gT = Math.ceil(ns.growthAnalyze(t.host, ratio));
            const wT = Math.ceil(gT * 0.004 / 0.05);
            spawnAcross(ns, CFG.workerG, t.host, gT, pool, 0);
            spawnAcross(ns, CFG.workerW, t.host, wT, pool, 0);
        }
    }

    let totalBatches = 0;
    const sp = CFG.spacing;
    const minBatchRam = 1.75 * 4;

    for (const t of prepped) {
        if (totalBatches >= CFG.maxTotalBatches) break;

        const batch = calcBatch(ns, t.host, CFG.hackPct, S.hasFormulas);
        if (!batch) continue;

        const { hThreads, w1Threads, gThreads, w2Threads, hackTime, growTime, weakenTime } = batch;
        const maxByTime = Math.floor(weakenTime / (4 * sp));
        const batchCap = Math.min(maxByTime, CFG.maxBatchesPerTgt, CFG.maxTotalBatches - totalBatches);

        for (let n = 0; n < batchCap; n++) {
            const poolFree = pool.reduce((s, w) => s + w.free, 0);
            if (poolFree < minBatchRam) break;

            const offset = n * 4 * sp;
            const hDelay = Math.max(0, weakenTime - hackTime - sp + offset);
            const w1Delay = offset;
            const gDelay = Math.max(0, weakenTime - growTime + sp + offset);
            const w2Delay = 2 * sp + offset;

            const h = spawnAcross(ns, CFG.workerH, t.host, hThreads, pool, hDelay);
            const w1 = spawnAcross(ns, CFG.workerW, t.host, w1Threads, pool, w1Delay);
            const g = spawnAcross(ns, CFG.workerG, t.host, gThreads, pool, gDelay);
            const w2 = spawnAcross(ns, CFG.workerW, t.host, w2Threads, pool, w2Delay);

            if (h === 0 && w1 === 0 && g === 0 && w2 === 0) break;
            totalBatches++;
        }
    }

    S.batchesLast = totalBatches;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS
// ═══════════════════════════════════════════════════════════════════════════════

function showStatus(ns, S) {
    const player = ns.getPlayer();
    const money = ns.getServerMoneyAvailable("home");
    const pool = getWorkerPool(ns, S);
    const freeRam = pool.reduce((s, w) => s + w.free, 0);
    const totalRam = pool.reduce((s, w) => s + ns.getServerMaxRam(w.host), 0);

    ns.clearLog();
    ns.print("┌────────────────────────────────────────────────┐");
    ns.print(`│  ⚡ HACK MODULE  ${new Date().toLocaleTimeString().padStart(26)}│`);
    ns.print("├────────────────────────────────────────────────┤");
    ns.print(`│ 💰 $${ns.format.number(money).padEnd(16)} 🧠 Hack: ${player.skills.hacking}`);
    ns.print(`│ 📐 Formulas: ${S.hasFormulas ? "yes" : "no"}  🎯 Targets: ${S.targets.length}`);
    ns.print(`│ 💾 ${ns.format.ram(freeRam)} free / ${ns.format.ram(totalRam)} (${pool.length} hosts)`);
    ns.print(`│ 🚀 Batches launched: ${S.batchesLast}`);

    const show = Math.min(S.targets.length, 6);
    for (let i = 0; i < show; i++) {
        const t = S.targets[i];
        const m = ns.getServerMoneyAvailable(t.host);
        const mx = ns.getServerMaxMoney(t.host);
        const pct = mx > 0 ? (m / mx * 100).toFixed(0) : "0";
        const sec = ns.getServerSecurityLevel(t.host);
        const min = ns.getServerMinSecurityLevel(t.host);
        ns.print(`│ ${t.host.padEnd(20)} ${pct.padStart(3)}%  sec ${sec.toFixed(1)}/${min.toFixed(1)}`);
    }
    if (S.targets.length > show) ns.print(`│ ... +${S.targets.length - show} more`);
    ns.print("└────────────────────────────────────────────────┘");
}