/** @param {NS} ns */
// Manage sleeves: buy, memory, shock recovery, university study (SF10+).

import { budget, hasSf } from "/Automation/lib/shared.js";

export async function main(ns) {
    ns.disableLog("ALL");
    if (!hasSf(ns, 10, 1)) return;

    const money = budget(ns, 0.2, 2e6);

    if (ns.sleeve.getNumSleeves() < 8) {
        const cost = ns.sleeve.getSleeveCost();
        if (money > 0 && cost > 0 && cost <= money && ns.sleeve.purchaseSleeve()) return;
    }

    const count = ns.sleeve.getNumSleeves();
    for (let i = 0; i < count; i++) {
        const sleeve = ns.sleeve.getSleeve(i);
        const task = ns.sleeve.getTask(i);

        if (sleeve.shock > 0) {
            if (task?.type !== "RECOVERY") ns.sleeve.setToShockRecovery(i);
            continue;
        }

        if (sleeve.sync < 100 && task?.type !== "SYNCHRO") {
            ns.sleeve.setToSynchronize(i);
            continue;
        }

        if (task?.type === "CLASS") continue;

        ns.sleeve.setToUniversityCourse(i, "Rothman University", "Algorithms");
    }

    if (money <= 0) return;
    for (let i = 0; i < count; i++) {
        const cost = ns.sleeve.getMemoryUpgradeCost(i, 1);
        if (cost > 0 && cost <= money && ns.sleeve.upgradeMemory(i, 1)) return;
    }
}