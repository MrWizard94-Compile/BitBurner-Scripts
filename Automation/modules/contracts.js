/** @param {NS} ns */
// Find and solve coding contracts on rooted servers.

import { crawl } from "/Automation/lib/shared.js";
import { solveContract } from "/Automation/lib/contractSolver.js";

export async function main(ns) {
    ns.disableLog("ALL");

    const hosts = ["home", ...crawl(ns)];
    for (const host of hosts) {
        if (!ns.hasRootAccess(host)) continue;
        const files = ns.ls(host, ".cct");
        for (const file of files) {
            const tries = ns.codingcontract.getNumTriesRemaining(file, host);
            if (tries <= 0) continue;

            const type = ns.codingcontract.getContractType(file, host);
            const data = ns.codingcontract.getData(file, host);
            const answer = solveContract(type, data);
            if (answer == null) continue;

            const reward = ns.codingcontract.attempt(answer, file, host);
            if (reward) return;
        }
    }
}