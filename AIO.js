/** @param {NS} ns **/
export async function main(ns) {
    const target = ns.args[0];

    if (!target) {
        ns.tprint("Error: Target missing. Usage: run script.js (name-of-target)");
        return;
    }

    while (true) {
        // Get the current security and money level
        let currentSec = ns.getServerSecurityLevel(target);
        let minSec = ns.getServerMinSecurityLevel(target);
        let currentMo = ns.getServerMoneyAvailable(target);
        let maxMo = ns.getServerMaxMoney(target);

        // Print to the script's log window (tail)
        ns.print(`Target: ${target}`);
        ns.print(`Security: ${currentSec.toFixed(2)} (Min: ${minSec})`);
        ns.print(`Money: ${currentMo.toFixed(2)} (Max: ${maxMo.toFixed(2)})`);

        // Perform the hack, grow, and weaken cycle
        if (currentSec > minSec) {
        await ns.weaken(target);
        }
        else if (currentMo < maxMo) {
        await ns.grow(target);
        }
        else {
        await ns.hack(target);
        }
    }
}