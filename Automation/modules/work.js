/** @param {NS} ns */
// Maintain faction reputation work toward augment purchases.

import { memberFactions, singularityReady } from "/Automation/lib/shared.js";

const LOOP_MS = 30000;

export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();

    while (true) {
        if (singularityReady(ns)) maintainWork(ns);
        await ns.sleep(LOOP_MS);
    }
}

function maintainWork(ns) {
    const current = ns.singularity.getCurrentWork();
    if (current && current.type === "FACTION") {
        const factions = memberFactions(ns);
        if (factions.includes(current.factionName)) return;
    }

    const target = pickFaction(ns);
    if (!target) return;

    const types = ns.singularity.getFactionWorkTypes(target.faction);
    const workType = pickWorkType(types);
    if (!workType) return;

    ns.singularity.workForFaction(target.faction, workType, false);
}

function pickFaction(ns) {
    const owned = new Set(ns.singularity.getOwnedAugmentations());
    const purchased = new Set(ns.singularity.getOwnedAugmentations(true));
    let best = null;

    for (const faction of memberFactions(ns)) {
        const augs = ns.singularity.getAugmentationsFromFaction(faction);
        for (const aug of augs) {
            if (aug === "NeuroFlux Governor") continue;
            if (owned.has(aug) || purchased.has(aug)) continue;
            if (!prereqsMet(ns, aug, owned, purchased)) continue;

            const rep = ns.singularity.getFactionRep(faction);
            const need = ns.singularity.getAugmentationRepReq(aug);
            if (rep >= need) continue;

            const deficit = need - rep;
            const stats = ns.singularity.getAugmentationStats(aug);
            const value = augValue(stats);
            const score = value / Math.max(1, deficit);
            if (!best || score > best.score) {
                best = { faction, aug, score, deficit };
            }
        }
    }

    return best;
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

function pickWorkType(types) {
    if (!types || types.length === 0) return null;
    if (types.includes("hacking")) return "hacking";
    if (types.includes("field")) return "field";
    if (types.includes("security")) return "security";
    return types[0];
}