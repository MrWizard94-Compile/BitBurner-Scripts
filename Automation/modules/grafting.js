/** @param {NS} ns */
// Graft augmentations (SF10+) without a full reset.

import { budget, hasSf, singularityReady } from "/Automation/lib/shared.js";

export async function main(ns) {
    ns.disableLog("ALL");
    if (!singularityReady(ns)) return;
    if (!hasSf(ns, 10, 1)) return;

    const work = ns.singularity.getCurrentWork();
    if (work && work.type === "GRAFTING") return;

    const money = budget(ns, 0.3, 1e8);
    if (money <= 0) return;

    const owned = new Set(ns.singularity.getOwnedAugmentations());
    let best = null;

    for (const aug of ns.grafting.getGraftableAugmentations()) {
        if (owned.has(aug)) continue;
        if (!prereqsMet(ns, aug, owned)) continue;

        const price = ns.grafting.getAugmentationGraftPrice(aug);
        if (!Number.isFinite(price) || price <= 0 || price > money) continue;

        const stats = ns.singularity.getAugmentationStats(aug);
        const score = augValue(stats) / price;
        if (!best || score > best.score) best = { aug, score };
    }

    if (!best) return;

    if (ns.singularity.getCurrentServer() !== "New Tokyo") {
        ns.singularity.travelToCity("New Tokyo");
    }

    ns.grafting.graftAugmentation(best.aug, false);
}

function prereqsMet(ns, aug, owned) {
    for (const req of ns.singularity.getAugmentationPrereq(aug)) {
        if (!owned.has(req)) return false;
    }
    return true;
}

function augValue(stats) {
    return (stats.hacking ?? 1) *
        (stats.hacking_exp ?? 1) *
        (stats.hacking_chance ?? 1) *
        (stats.hacking_speed ?? 1) *
        (stats.hacking_money ?? 1);
}