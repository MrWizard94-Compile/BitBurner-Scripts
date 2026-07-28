/** @param {NS} ns */
// Install backdoors on faction / endgame servers when rooted and reachable.

import { connectTo, goHome, singularityReady } from "/Automation/lib/shared.js";

/** Priority-ordered servers worth backdooring. */
const TARGETS = [
    { host: "CSEC", minHack: 1 },
    { host: "avmniteohdf-8hd", minHack: 1 },
    { host: "run4theh111z", minHack: 1 },
    { host: "The-Cave", minHack: 1 },
    { host: "I.I.I.I", minHack: 1 },
    { host: "w0r1d_d43m0n", minHack: 3000 },
];

export async function main(ns) {
    ns.disableLog("ALL");
    if (!singularityReady(ns)) return;

    const hack = ns.getHackingLevel();
    if (!goHome(ns)) return;

    for (const { host, minHack } of TARGETS) {
        if (hack < minHack) continue;
        if (!ns.serverExists(host)) continue;
        if (!ns.hasRootAccess(host)) continue;

        const srv = ns.getServer(host);
        if (srv.backdoorInstalled) continue;
        if (ns.getServerRequiredHackingLevel(host) > hack) continue;

        if (!connectTo(ns, host)) continue;

        await ns.singularity.installBackdoor();
        goHome(ns);
        return;
    }
}