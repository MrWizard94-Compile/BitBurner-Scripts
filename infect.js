/** @param {NS} ns **/
export async function main(ns) {
  const payload = "AIO.js";
  const growScript = "workers/grow.js";
  const weakenScript = "workers/weaken.js";
  const visited = new Set();

  const ramCosts = {
    [payload]: ns.getScriptRam(payload, "home"),
    [growScript]: ns.getScriptRam(growScript, "home"),
    [weakenScript]: ns.getScriptRam(weakenScript, "home")
  };

  async function getPath(target) {
    let serverList = { "home": "" };
    let queue = ["home"];
    while (queue.length > 0) {
      let current = queue.shift();
      for (let next of ns.scan(current)) {
        if (!(next in serverList)) {
          serverList[next] = current;
          queue.push(next);
        }
      }
    }
    let path = [];
    let curr = target;
    while (curr !== "") {
      path.push(curr);
      curr = serverList[curr];
    }
    return path.reverse();
  }

  async function infect(target) {
    visited.add(target);

    if (target === "home" || target.startsWith("pserv-")) {
      for (const next of ns.scan(target)) {
        if (!visited.has(next)) await infect(next);
      }
      return;
    }

    // 1. Crack & Nuke
    let portsOpen = 0;
    const tools = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe"];
    for (const tool of tools) {
      if (ns.fileExists(tool, "home")) {
        if (tool === "BruteSSH.exe") ns.brutessh(target);
        if (tool === "FTPCrack.exe") ns.ftpcrack(target);
        if (tool === "relaySMTP.exe") ns.relaysmtp(target);
        if (tool === "HTTPWorm.exe") ns.httpworm(target);
        if (tool === "SQLInject.exe") ns.sqlinject(target);
        portsOpen++;
      }
    }

    if (!ns.hasRootAccess(target) && ns.getServerNumPortsRequired(target) <= portsOpen) {
      ns.nuke(target);
    }

    // 2. Backdoor Logic (MUST CONNECT FIRST)
    if (ns.hasRootAccess(target) && !ns.getServer(target).backdoorInstalled) {
      if (ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(target)) {
        try {
          let path = await getPath(target);
          for (let node of path) ns.singularity.connect(node);
          await ns.singularity.installBackdoor();
          ns.tprint(`✅ Backdoor installed: ${target}`);
          ns.singularity.connect("home"); // Return home immediately
        } catch (e) { /* SF4 missing */ }
      }
    }

    // 3. Deployment
    if (ns.hasRootAccess(target)) {
      const maxRam = ns.getServerMaxRam(target);
      if (maxRam > 0) {
        const myHacking = ns.getHackingLevel();
        const reqHacking = ns.getServerRequiredHackingLevel(target);
        let activeScript = (myHacking >= reqHacking) ? payload : (ns.getServerSecurityLevel(target) > ns.getServerMinSecurityLevel(target) + 5 ? weakenScript : growScript);
        const scriptRam = ramCosts[activeScript] || 1.75;
        const threads = Math.floor(maxRam / scriptRam);
        if (threads > 0 && !ns.isRunning(activeScript, target, target)) {
          await ns.scp([payload, growScript, weakenScript], target, "home");
          ns.killall(target);
          ns.exec(activeScript, target, threads, target);
        }
      }
    }

    for (const next of ns.scan(target)) {
      if (!visited.has(next)) await infect(next);
    }
  }

  while (true) {
    visited.clear();
    await infect("home");
    await ns.sleep(6000);
  }
}
