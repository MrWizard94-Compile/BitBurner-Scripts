/** @param {NS} ns */
// Create programs locally when hacking level allows and they are missing.

import { singularityReady } from "/Automation/lib/shared.js";

const CREATE_ORDER = [
    "BruteSSH.exe",
    "FTPCrack.exe",
    "relaySMTP.exe",
    "HTTPWorm.exe",
    "SQLInject.exe",
    "Formulas.exe",
    "AutoLink.exe",
    "ServerProfiler.exe",
    "DeepscanV1.exe",
    "DeepscanV2.exe",
    "DeepscanV3.exe",
];

export async function main(ns) {
    ns.disableLog("ALL");
    if (!singularityReady(ns)) return;

    const work = ns.singularity.getCurrentWork();
    if (work && work.type === "CREATE_PROGRAM") return;

    const hack = ns.getHackingLevel();
    for (const program of CREATE_ORDER) {
        if (ns.fileExists(program, "home")) continue;
        const need = ns.singularity.getHackingLevelRequirementOfProgram(program);
        if (need > hack) continue;
        if (ns.singularity.createProgram(program, false)) return;
    }
}