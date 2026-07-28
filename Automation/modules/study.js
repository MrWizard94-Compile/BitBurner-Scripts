/** @param {NS} ns */
// Study at university when idle and hacking level is below target.

import { singularityReady } from "/Automation/lib/shared.js";

const TARGET_HACK = 150;

export async function main(ns) {
    ns.disableLog("ALL");
    if (!singularityReady(ns)) return;
    if (ns.getHackingLevel() >= TARGET_HACK) return;

    const work = ns.singularity.getCurrentWork();
    if (work) return;

    ns.singularity.universityCourse("Rothman University", "Algorithms", false);
}