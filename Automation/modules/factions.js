/** @param {NS} ns */
// Accept all outstanding faction invitations.

import { rememberFaction, singularityReady } from "/Automation/lib/shared.js";

const SKIP = new Set([
    "Shadows of Anarchy",
]);

export async function main(ns) {
    ns.disableLog("ALL");
    if (!singularityReady(ns)) return;

    const invites = ns.singularity.checkFactionInvitations();
    for (const faction of invites) {
        if (SKIP.has(faction)) continue;
        if (ns.singularity.joinFaction(faction)) {
            rememberFaction(ns, faction);
            return;
        }
    }
}