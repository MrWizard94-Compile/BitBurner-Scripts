/** @param {NS} ns */

const FACTION_FILE = "/Automation/state/factions.json";

/** @returns {boolean} */
export function singularityReady(ns) {
    try {
        ns.singularity.getOwnedSourceFiles();
        return true;
    } catch {
        return false;
    }
}

/** @returns {number} 0 if unavailable */
export function sfLevel(ns, n) {
    try {
        for (const sf of ns.singularity.getOwnedSourceFiles()) {
            if (sf.n === n) return sf.lvl;
        }
    } catch {
        /* unavailable */
    }
    return 0;
}

/** @returns {boolean} */
export function hasSf(ns, n, min = 1) {
    return sfLevel(ns, n) >= min;
}

/** SF4 singularity API RAM multiplier (16 / 4 / 1). */
export function singularityRamMult(ns) {
    const lvl = sfLevel(ns, 4);
    if (lvl >= 3) return 1;
    if (lvl >= 2) return 4;
    return 16;
}

export function budget(ns, reservePct = 0.15, minReserve = 1e6) {
    const money = ns.getServerMoneyAvailable("home");
    return money - Math.max(minReserve, money * reservePct);
}

export function crawl(ns) {
    const seen = new Set(["home"]);
    const queue = ["home"];
    const out = [];
    while (queue.length > 0) {
        const host = queue.shift();
        for (const n of ns.scan(host)) {
            if (!seen.has(n)) {
                seen.add(n);
                queue.push(n);
                out.push(n);
            }
        }
    }
    return out;
}

export function isHacknetServer(host) {
    return host.startsWith("hacknet-server-");
}

export function loadFactions(ns) {
    if (!ns.fileExists(FACTION_FILE, "home")) return [];
    try {
        const raw = ns.read(FACTION_FILE);
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function rememberFaction(ns, name) {
    const set = new Set(loadFactions(ns));
    set.add(name);
    ns.write(FACTION_FILE, JSON.stringify([...set]), "w");
}

export function findPath(ns, from, to) {
    if (from === to) return [from];
    const seen = new Set([from]);
    const queue = [[from, [from]]];
    while (queue.length > 0) {
        const [node, path] = queue.shift();
        for (const n of ns.scan(node)) {
            if (seen.has(n)) continue;
            seen.add(n);
            const next = [...path, n];
            if (n === to) return next;
            queue.push([n, next]);
        }
    }
    return null;
}

/** Walk the network from the current server to `target`. */
export function connectTo(ns, target) {
    if (!singularityReady(ns)) return false;
    const start = ns.singularity.getCurrentServer();
    if (start === target) return true;

    const path = findPath(ns, start, target);
    if (!path) return false;

    for (let i = 1; i < path.length; i++) {
        if (!ns.singularity.connect(path[i])) return false;
    }
    return ns.singularity.getCurrentServer() === target;
}

export function goHome(ns) {
    return connectTo(ns, "home");
}

export const ALL_FACTIONS = [
    "CyberSec", "Netburners", "Tian Di Hui", "Sector-12", "Chongqing", "New Tokyo",
    "Volhaven", "Aevum", "Slum Snakes", "Tetrads", "Silhouette", "Speakers for the Dead",
    "The Dark Army", "The Syndicate", "NiteSec", "The Black Hand", "BitRunners",
    "ECorp", "MegaCorp", "Bachman & Associates", "Blade Industries", "NWO",
    "Clarke Incorporated", "OmniTek Incorporated", "Four Sigma", "KuaiGong International",
    "Fulcrum Secret Technologies", "The Covenant", "Illuminati", "Daedalus",
    "Bladeburners", "Church of the Machine God",
];

export function memberFactions(ns) {
    const remembered = new Set(loadFactions(ns));
    if (!singularityReady(ns)) return [...remembered];

    for (const faction of ALL_FACTIONS) {
        try {
            const rep = ns.singularity.getFactionRep(faction);
            const favor = ns.singularity.getFactionFavor(faction);
            if (rep > 0 || favor > 0) remembered.add(faction);
        } catch {
            /* not a member */
        }
    }
    return [...remembered];
}