/** @param {NS} ns */
// Purchase and upgrade hacknet nodes (or hacknet servers in BN9).

import { budget } from "/Automation/lib/shared.js";

const HASH_SELL = "Sell for Money";

export async function main(ns) {
    ns.disableLog("ALL");

    const spend = budget(ns, 0.1, 1e6);
    if (spend <= 0) return;

    const numNodes = ns.hacknet.numNodes();
    const maxNodes = ns.hacknet.maxNumNodes();
    const isServer = numNodes > 0 && ns.hacknet.getNodeStats(0).hashCapacity !== undefined;

    if (isServer) spendHashes(ns);

    if (numNodes < maxNodes) {
        const cost = ns.hacknet.getPurchaseNodeCost();
        if (cost > 0 && cost <= spend && ns.hacknet.purchaseNode() >= 0) return;
    }

    const upgrade = pickUpgrade(ns, spend, isServer);
    if (upgrade) upgrade.fn(upgrade.index, upgrade.n);
}

function spendHashes(ns) {
    try {
        const upgrades = ns.hacknet.getHashUpgrades();
        if (!upgrades.includes(HASH_SELL)) return;

        const cost = ns.hacknet.hashCost(HASH_SELL, 1);
        if (!Number.isFinite(cost) || cost <= 0) return;
        if (ns.hacknet.numHashes() < cost) return;

        ns.hacknet.spendHashes(HASH_SELL, "", 1);
    } catch {
        /* hash API unavailable */
    }
}

function pickUpgrade(ns, budget, isServer) {
    const actions = [
        { name: "level", cost: (i, n) => ns.hacknet.getLevelUpgradeCost(i, n), fn: ns.hacknet.upgradeLevel.bind(ns.hacknet) },
        { name: "ram", cost: (i, n) => ns.hacknet.getRamUpgradeCost(i, n), fn: ns.hacknet.upgradeRam.bind(ns.hacknet) },
        { name: "core", cost: (i, n) => ns.hacknet.getCoreUpgradeCost(i, n), fn: ns.hacknet.upgradeCore.bind(ns.hacknet) },
    ];

    if (isServer) {
        actions.push({
            name: "cache",
            cost: (i, n) => ns.hacknet.getCacheUpgradeCost(i, n),
            fn: ns.hacknet.upgradeCache.bind(ns.hacknet),
        });
    }

    let best = null;
    const numNodes = ns.hacknet.numNodes();

    for (let i = 0; i < numNodes; i++) {
        const stats = ns.hacknet.getNodeStats(i);
        for (const action of actions) {
            const cost = action.cost(i, 1);
            if (!Number.isFinite(cost) || cost <= 0 || cost > budget) continue;
            const score = stats.production / cost;
            if (!best || score > best.score) {
                best = { index: i, n: 1, fn: action.fn, score, cost };
            }
        }
    }

    return best;
}