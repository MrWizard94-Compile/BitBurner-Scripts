/** @param {NS} ns */
// Purchase the best affordable augmentation from joined factions.

import { budget, memberFactions, singularityReady } from "/Automation/lib/shared.js";

export async function main(ns) {
    ns.disableLog("ALL");
    if (!singularityReady(ns)) return;

    const money = budget(ns, 0.25, 5e6);
    if (money <= 0) return;

    const owned = new Set(ns.singularity.getOwnedAugmentations());
    const purchased = new Set(ns.singularity.getOwnedAugmentations(true));
    let best = null;

    for (const faction of memberFactions(ns)) {
        for (const aug of ns.singularity.getAugmentationsFromFaction(faction)) {
            if (aug === "NeuroFlux Governor") continue;
            if (owned.has(aug) || purchased.has(aug)) continue;
            if (!prereqsMet(ns, aug, owned, purchased)) continue;

            const rep = ns.singularity.getFactionRep(faction);
            if (rep < ns.singularity.getAugmentationRepReq(aug)) continue;

            const price = ns.singularity.getAugmentationPrice(aug);
            if (price > money) continue;

            const stats = ns.singularity.getAugmentationStats(aug);
            const score = augValue(stats) / price;
            if (!best || score > best.score) {
                best = { faction, aug, score };
            }
        }
    }

    if (best) ns.singularity.purchaseAugmentation(best.faction, best.aug);
}

function prereqsMet(ns, aug, owned, purchased) {
    for (const req of ns.singularity.getAugmentationPrereq(aug)) {
        if (!owned.has(req) && !purchased.has(req)) return false;
    }
    return true;
}

function augValue(stats) {
    return (stats.hacking ?? 1) *
        (stats.hacking_exp ?? 1) *
        (stats.hacking_chance ?? 1) *
        (stats.hacking_speed ?? 1) *
        (stats.hacking_money ?? 1) *
        (stats.faction_rep ?? 1) *
        (stats.faction_work ?? 1);
}