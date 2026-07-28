/** @param {NS} ns */
// Install purchased augmentations and restart the brain after reset.

import { singularityReady } from "/Automation/lib/shared.js";

const BRAIN = "/Automation/brain.js";
const MIN_BATCH = 5;

export async function main(ns) {
    ns.disableLog("ALL");
    if (!singularityReady(ns)) return;

    const queued = ns.singularity.getOwnedAugmentations(true);
    if (queued.length === 0) return;

    const hasNfg = queued.includes("NeuroFlux Governor");
    if (!hasNfg && queued.length < MIN_BATCH) return;

    ns.singularity.installAugmentations(BRAIN);
}