/** @param {NS} ns */
// Upgrade home RAM and CPU cores when affordable (requires singularity API).

import { budget, singularityReady } from "/Automation/lib/shared.js";

export async function main(ns) {
    ns.disableLog("ALL");
    if (!singularityReady(ns)) return;

    const spend = budget(ns, 0.2, 1e6);
    if (spend <= 0) return;

    const ramCost = ns.singularity.getUpgradeHomeRamCost();
    if (ramCost > 0 && ramCost <= spend) {
        if (ns.singularity.upgradeHomeRam()) return;
    }

    const coreCost = ns.singularity.getUpgradeHomeCoresCost();
    if (coreCost > 0 && coreCost <= spend) {
        ns.singularity.upgradeHomeCores();
    }
}