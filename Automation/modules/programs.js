/** @param {NS} ns */
// Purchase darkweb programs in priority order (port crackers first).

import { budget, singularityReady } from "/Automation/lib/shared.js";

const PROGRAM_ORDER = [
    "BruteSSH.exe",
    "FTPCrack.exe",
    "relaySMTP.exe",
    "HTTPWorm.exe",
    "SQLInject.exe",
    "AutoLink.exe",
    "ServerProfiler.exe",
    "DeepscanV1.exe",
    "DeepscanV2.exe",
    "DeepscanV3.exe",
    "NPC.exe",
    "InvAug.exe",
    "DataInc.exe",
    "BitFlume.exe",
];

export async function main(ns) {
    ns.disableLog("ALL");
    if (!singularityReady(ns)) return;

    if (!ns.hasTorRouter()) {
        const money = ns.getServerMoneyAvailable("home");
        if (money > 1e6) ns.singularity.purchaseTor();
        return;
    }

    const spend = budget(ns, 0.15, 5e5);
    if (spend <= 0) return;

    for (const program of PROGRAM_ORDER) {
        if (ns.fileExists(program, "home")) continue;

        const cost = ns.singularity.getDarkwebProgramCost(program);
        if (!Number.isFinite(cost) || cost <= 0 || cost > spend) continue;

        if (ns.singularity.purchaseProgram(program)) return;
    }
}