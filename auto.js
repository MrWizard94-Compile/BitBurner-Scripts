/** @param {NS} ns */
// ═══════════════════════════════════════════════════════════════════════════════
// BitBurner Daemon v4.0 — HWGW Shotgun Batcher
// ═══════════════════════════════════════════════════════════════════════════════
// Prepped targets: HWGW batches with precise timing via additionalMsec
// Unprepped targets: grow/weaken to prep
// Workers: grow.js uses {stock: true} → boosts stock forecasts automatically
// Formulas: used when available, fallback to basic APIs
// ═══════════════════════════════════════════════════════════════════════════════

export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    const CFG = {
        maxTargets:       15,
        hackPct:          0.25,
        secThresh:        5,
        moneyThresh:      0.75,
        workerH:          "/workers/hack.js",
        workerG:          "/workers/grow.js",
        workerW:          "/workers/weaken.js",
        spacing:          25,        // ms between batch steps (H→W1→G→W2)
        maxBatchesPerTgt: 500,       // safety cap per target
        maxTotalBatches:  5000,      // safety cap overall

        loopMs:           2000,
        scanEvery:        15,
        modSmallEvery:    30,
        modWorkEvery:     30,
        modInfraEvery:    30,
        modContractEvery: 90,
        statusEvery:      5,
    };

    const S = {
        allServers:   [],
        rooted:       [],
        targets:      [],
        tick:         0,
        hasFormulas:  false,
        batchesLast:  0,
    };

    while (true) {
        S.tick++;

        if (S.tick === 1 || S.tick % CFG.scanEvery === 1) {
            scanAndRoot(ns, S);
            S.hasFormulas = ns.fileExists("Formulas.exe", "home");
        }

        if (S.tick % CFG.modSmallEvery === 2)  tryExec(ns, "/mod/programs.js");
        if (S.tick % CFG.modSmallEvery === 3)  tryExec(ns, "/mod/factions.js");
        if (S.tick % CFG.modSmallEvery === 4)  tryExec(ns, "/mod/home.js");
        if (S.tick % CFG.modSmallEvery === 5)  tryExec(ns, "/mod/backdoor.js");
        if (S.tick % CFG.modWorkEvery === 7)   tryExec(ns, "/mod/work.js");
        if (S.tick % CFG.modInfraEvery === 8)  tryExec(ns, "/mod/infra.js");
        if (S.tick % CFG.modContractEvery === 12) tryExec(ns, "/mod/contracts.js");

        deployHacking(ns, S, CFG);

        if (S.tick % CFG.statusEvery === 0) showStatus(ns, S, CFG);

        await ns.sleep(CFG.loopMs);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE EXEC
// ═══════════════════════════════════════════════════════════════════════════════

function tryExec(ns, script, ...args) {
    if (!ns.fileExists(script, "home")) return;
    for (const p of ns.ps("home")) { if (p.filename === script) return; }
    const free = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
    if (free >= ns.getScriptRam(script, "home")) ns.exec(script, "home", 1, ...args);
}

// ═══════════════════════════════════════════════════════════════════════════════
// NETWORK
// ═══════════════════════════════════════════════════════════════════════════════

/** BitNode 9 hacknet servers appear in ns.scan() but are not hackable world servers. */
function isHacknetServer(host) {
    return host.startsWith("hacknet-server-");
}

function deployWorkers(ns, host) {
    for (const w of ["/workers/hack.js", "/workers/grow.js", "/workers/weaken.js"]) {
        if (ns.fileExists(w, "home") && !ns.fileExists(w, host)) ns.scp(w, host, "home");
    }
}

function scanAndRoot(ns, S) {
    const seen = new Set(["home"]);
    const queue = ["home"];
    const result = [];
    while (queue.length > 0) {
        const host = queue.shift();
        for (const n of ns.scan(host)) {
            if (!seen.has(n)) { seen.add(n); queue.push(n); result.push(n); }
        }
    }
    S.allServers = result;
    S.rooted = [];

    const crackers = [
        ["BruteSSH.exe", ns.brutessh], ["FTPCrack.exe", ns.ftpcrack],
        ["relaySMTP.exe", ns.relaysmtp], ["HTTPWorm.exe", ns.httpworm],
        ["SQLInject.exe", ns.sqlinject],
    ];
    const avail = crackers.filter(([exe]) => ns.fileExists(exe, "home"));

    for (const host of S.allServers) {
        if (isHacknetServer(host)) {
            S.rooted.push(host);
            deployWorkers(ns, host);
            continue;
        }

        if (!ns.hasRootAccess(host)) {
            if (ns.getServerRequiredHackingLevel(host) > ns.getHackingLevel()) continue;
            if (ns.getServerNumPortsRequired(host) > avail.length) continue;
            for (const [, fn] of avail) fn(host);
            ns.nuke(host);
        }
        if (ns.hasRootAccess(host)) {
            S.rooted.push(host);
            deployWorkers(ns, host);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TARGET SCORING
// ═══════════════════════════════════════════════════════════════════════════════

function scoreTarget(ns, host, hasFormulas) {
    if (isHacknetServer(host)) return 0;
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
        } catch { /* fallback */ }
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
    const targets = [], cloud = [];
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
        else if (host.startsWith("pserv-") || host.startsWith("daemon") || isHacknetServer(host)) cloud.push(entry);
        else targets.push(entry);
    }
    const pool = [...targets, ...cloud];
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

            // Binary search for grow threads
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
// DEPLOY HACKING — HWGW shotgun batcher for prepped, simple for unprepped
// ═══════════════════════════════════════════════════════════════════════════════

function deployHacking(ns, S, cfg) {
    const scored = S.rooted
        .filter(h => !isHacknetServer(h) &&
                     ns.getServerMaxMoney(h) > 0 &&
                     ns.getServerRequiredHackingLevel(h) <= ns.getHackingLevel())
        .map(h => ({ host: h, score: scoreTarget(ns, h, S.hasFormulas) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, cfg.maxTargets);

    S.targets = scored;
    const pool = getWorkerPool(ns, S);

    const prepped = [], unprepped = [];
    for (const t of scored) {
        const money = ns.getServerMoneyAvailable(t.host);
        const max   = ns.getServerMaxMoney(t.host);
        const sec   = ns.getServerSecurityLevel(t.host);
        const minS  = ns.getServerMinSecurityLevel(t.host);
        if (money >= max * cfg.moneyThresh && sec <= minS + cfg.secThresh) prepped.push(t);
        else unprepped.push(t);
    }

    // ── Prep unprepped targets (simple weaken/grow) ────────────────────────
    for (const t of unprepped) {
        const sec  = ns.getServerSecurityLevel(t.host);
        const minS = ns.getServerMinSecurityLevel(t.host);
        const money = ns.getServerMoneyAvailable(t.host);
        const max   = ns.getServerMaxMoney(t.host);

        if (sec > minS + cfg.secThresh) {
            spawnAcross(ns, cfg.workerW, t.host, Math.ceil((sec - minS) / 0.05), pool, 0);
        } else if (money < max * cfg.moneyThresh) {
            const ratio = max / Math.max(1, money);
            const gT = Math.ceil(ns.growthAnalyze(t.host, ratio));
            const wT = Math.ceil(gT * 0.004 / 0.05);
            spawnAcross(ns, cfg.workerG, t.host, gT, pool, 0);
            spawnAcross(ns, cfg.workerW, t.host, wT, pool, 0);
        }
    }

    // ── HWGW shotgun batcher for prepped targets ───────────────────────────
    let totalBatches = 0;
    const sp = cfg.spacing;
    const minBatchRam = 1.75 * 4; // Minimum for 1 thread of each type

    for (const t of prepped) {
        if (totalBatches >= cfg.maxTotalBatches) break;

        const batch = calcBatch(ns, t.host, cfg.hackPct, S.hasFormulas);
        if (!batch) continue;

        const { hThreads, w1Threads, gThreads, w2Threads, hackTime, growTime, weakenTime } = batch;

        // How many staggered batches fit in the weaken window?
        const maxByTime = Math.floor(weakenTime / (4 * sp));
        const batchCap = Math.min(maxByTime, cfg.maxBatchesPerTgt, cfg.maxTotalBatches - totalBatches);

        for (let n = 0; n < batchCap; n++) {
            // Check if pool has enough RAM
            const poolFree = pool.reduce((s, w) => s + w.free, 0);
            if (poolFree < minBatchRam) break;

            // Calculate delays for batch N
            const offset = n * 4 * sp;
            const hDelay  = Math.max(0, weakenTime - hackTime - sp + offset);
            const w1Delay = offset;
            const gDelay  = Math.max(0, weakenTime - growTime + sp + offset);
            const w2Delay = 2 * sp + offset;

            // Launch HWGW
            const h  = spawnAcross(ns, cfg.workerH, t.host, hThreads, pool, hDelay);
            const w1 = spawnAcross(ns, cfg.workerW, t.host, w1Threads, pool, w1Delay);
            const g  = spawnAcross(ns, cfg.workerG, t.host, gThreads, pool, gDelay);
            const w2 = spawnAcross(ns, cfg.workerW, t.host, w2Threads, pool, w2Delay);

            if (h === 0 && w1 === 0 && g === 0 && w2 === 0) break; // Can't deploy more

            totalBatches++;
        }
    }

    S.batchesLast = totalBatches;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS
// ═══════════════════════════════════════════════════════════════════════════════

function showStatus(ns, S, cfg) {
    ns.clearLog();
    const player  = ns.getPlayer();
    const money   = ns.getServerMoneyAvailable("home");
    const homeMax = ns.getServerMaxRam("home");
    const pool    = getWorkerPool(ns, S);
    const freeRam = pool.reduce((s, w) => s + w.free, 0);
    const totalRam = pool.reduce((s, w) => s + ns.getServerMaxRam(w.host), 0);

    const crackers = ["BruteSSH.exe","FTPCrack.exe","relaySMTP.exe","HTTPWorm.exe","SQLInject.exe"];
    const ports = crackers.filter(c => ns.fileExists(c, "home")).length;
    const fStr = S.hasFormulas ? "✅" : "❌";

    ns.print(`┌────────────────────────────────────────────────┐`);
    ns.print(`│  🤖 DAEMON v4.0 HWGW  ${new Date().toLocaleTimeString().padStart(24)}│`);
    ns.print(`├────────────────────────────────────────────────┤`);
    ns.print(`│ 💰 $${ns.format.number(money).padEnd(16)} 🧠 Hack: ${player.skills.hacking}`);
    ns.print(`│ 🏠 ${ns.format.ram(homeMax).padEnd(12)} 🔓 Ports: ${ports}/5`);
    ns.print(`│ 📐 Formulas: ${fStr}  📊 Stock coord: ✅`);
    ns.print(`│ 🖥️  ${S.rooted.length}/${S.allServers.length} servers`);
    ns.print(`│ 💾 ${ns.format.ram(freeRam)} free / ${ns.format.ram(totalRam)} (${pool.length} hosts)`);
    ns.print(`│ 🎯 Batches launched: ${S.batchesLast}`);
    ns.print(`├────────────────────────────────────────────────┤`);

    const show = Math.min(S.targets.length, 8);
    for (let i = 0; i < show; i++) {
        const t = S.targets[i];
        const m = ns.getServerMoneyAvailable(t.host);
        const mx = ns.getServerMaxMoney(t.host);
        const pct = mx > 0 ? (m / mx * 100).toFixed(0) : "0";
        const sec = ns.getServerSecurityLevel(t.host);
        const min = ns.getServerMinSecurityLevel(t.host);
        ns.print(`│ ⚡ ${t.host.padEnd(20)} ${pct.padStart(3)}%  sec ${sec.toFixed(1)}/${min.toFixed(1)}`);
    }
    if (S.targets.length > show) ns.print(`│    ... +${S.targets.length - show} more`);

    ns.print(`├────────────────────────────────────────────────┤`);
    ns.print(`│ Tick ${S.tick}`);
    ns.print(`└────────────────────────────────────────────────┘`);
}
