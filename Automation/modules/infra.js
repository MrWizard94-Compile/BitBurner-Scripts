/** @param {NS} ns */
// Purchase and upgrade cloud servers for worker RAM.

import { budget } from "/Automation/lib/shared.js";

const PREFIX = "pserv-";

export async function main(ns) {
    ns.disableLog("ALL");

    const spend = budget(ns, 0.15, 2e6);
    if (spend <= 0) return;

    const names = ns.cloud.getServerNames();
    const limit = ns.cloud.getServerLimit();
    const ramCap = Math.min(ns.cloud.getRamLimit(), 1 << 20);

    if (names.length < limit) {
        const ram = bestAffordableRam(ns, spend, ramCap);
        if (ram > 0) {
            const host = ns.cloud.purchaseServer(PREFIX, ram);
            if (host) return;
        }
    }

    let target = null;
    let targetRam = 0;
    for (const host of names) {
        const current = ns.getServerMaxRam(host);
        const next = nextPowerOfTwo(current);
        if (next > ramCap || next <= current) continue;
        const cost = ns.cloud.getServerUpgradeCost(host, next);
        if (!Number.isFinite(cost) || cost <= 0 || cost > spend) continue;
        if (!target || current < ns.getServerMaxRam(target)) {
            target = host;
            targetRam = next;
        }
    }

    if (target) ns.cloud.upgradeServer(target, targetRam);
}

function bestAffordableRam(ns, budget, ramCap) {
    let best = 0;
    for (let ram = 2; ram <= ramCap; ram *= 2) {
        const cost = ns.cloud.getServerCost(ram);
        if (!Number.isFinite(cost) || cost <= 0 || cost > budget) break;
        best = ram;
    }
    return best;
}

function nextPowerOfTwo(n) {
    if (n < 2) return 2;
    let p = 2;
    while (p <= n) p *= 2;
    return p;
}