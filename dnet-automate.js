/** @param {NS} ns */

// ==========================================
// Darknet Explorer v1.1
// Bitburner 3.0.1
// ==========================================

const PASSWORD_FILE = "darkweb/darknet-passwords.txt";

export async function main(ns) {
  ns.disableLog("ALL");

  // Open tail for the current script
  ns.ui.openTail();

  while (true) {
    const passwords = loadPasswords(ns);

    // Loot local machine
    await maintainLocalServer(ns);

    const neighbors = ns.dnet.probe() || [];

    for (const host of neighbors) {
      try {
        await handleServer(ns, host, passwords);
      } catch (err) {
        ns.print(`ERROR ${host}: ${String(err)}`);
      }
    }

    // Proactively tail the "darkweb" server if a session exists
    try {
      const darkwebDetails = ns.dnet.getServerDetails("darkweb");
      if (darkwebDetails && darkwebDetails.hasSession) {
        // Automatically targets the visual layout window for darkweb logs
        ns.ui.openTail("darkweb");
      }
    } catch { }

    await ns.sleep(3000);
  }
}

async function handleServer(ns, host, passwords) {
  const details = ns.dnet.getServerDetails(host);

  if (!details.isOnline) return;

  // Reconnect using known password
  if (!details.hasSession && passwords.has(host)) {
    try {
      ns.dnet.connectToSession(
        host,
        passwords.get(host)
      );
    } catch { }
  }

  const refreshed = ns.dnet.getServerDetails(host);

  if (!refreshed.hasSession) {
    const solved = await solveServer(
      ns,
      host,
      refreshed,
      passwords
    );

    if (!solved) return;
  }

  spread(ns, host);
}

async function solveServer(ns, host, details, passwords) {
  const candidates = generateCandidates(details);

  for (const pw of candidates) {
    const result = await ns.dnet.authenticate(host, pw);

    if (result.success) {
      passwords.set(host, pw);
      savePasswords(ns, passwords);

      // CHANGED: Redirected layout output from terminal (tprint) to script logs (print)
      ns.print(`SUCCESS ${host} -> "${pw}"`);

      return true;
    }

    try {
      const hb = await ns.dnet.heartbleed(host, { peek: true });

      if (hb?.logs?.length) {
        ns.print(`[${host}] ` + JSON.stringify(hb.logs));
      }
    } catch { }
  }

  return false;
}

function spread(ns, host) {
  const script = ns.getScriptName();

  try {
    ns.scp(script, host);
    ns.exec(
      script,
      host,
      {
        threads: 1,
        preventDuplicates: true
      }
    );
  } catch { }
}

async function maintainLocalServer(ns) {
  const host = ns.getHostname();

  // Free blocked RAM
  try {
    while (ns.dnet.getBlockedRam(host) > 0) {
      await ns.dnet.memoryReallocation(host);
      await ns.sleep(100);
    }
  } catch { }

  // Open caches
  try {
    const caches = ns.ls(host, ".cache");

    for (const file of caches) {
      try {
        ns.dnet.openCache(file);
      } catch { }
    }
  } catch { }

  // Phishing
  try {
    await ns.dnet.phishingAttack();
  } catch { }

  // STORM_SEED.EXE
  try {
    await ns.dnet.unleashStormSeed();
  } catch { }
}

function generateCandidates(details) {
  const model = details.modelId || "";
  const hint = details.passwordHint || "";
  const data = details.data || "";

  switch (model) {
    case "ZeroLogon":
      return [""];

    case "CloudBlare(tm)":
      return [String(data).replace(/\D/g, "")];

    case "PHP 5.4":
      return uniquePermutations(String(data));

    case "BellaCuore":
      return [String(romanToInt(String(data)))];

    case "FreshInstall_1.0":
      return ["0000", "12345", "admin", "password", ""];

    case "OctantVoxel": {
      const parts = String(data).split(",");
      if (parts.length === 2) {
        const base = parseInt(parts[0], 10);
        const numStr = parts[1].trim();
        const decimalVal = parseInt(numStr, base);
        if (!isNaN(decimalVal)) {
          const len = details.passwordLength || 3;
          return [String(decimalVal).padStart(len, "0")];
        }
      }
      return genericPasswords(hint, data);
    }

    case "AccountsManager_4.2": {
      const out = [];
      const len = details.passwordLength || 2;
      for (let i = 0; i <= 100; i++) {
        out.push(String(i).padStart(len, "0"));
      }
      return out;
    }

    case "OpenWebAccessPoint": {
      const keywords = ["cafe", "wifi", "social", "media", "browse", "free", "guest"];
      const out = [];

      for (const word of keywords) {
        out.push(word);
        out.push(word.toUpperCase());
        let leet = word
          .replace(/e/gi, "3")
          .replace(/a/gi, "4")
          .replace(/i/gi, "1")
          .replace(/o/gi, "0")
          .replace(/s/gi, "5")
          .replace(/t/gi, "7");

        if (details.passwordFormat === "numeric") {
          leet = leet.replace(/\D/g, "");
        }
        if (leet) out.push(leet);
      }

      if (details.passwordLength === 4 && details.passwordFormat === "numeric") {
        out.push("2233", "4321", "1234", "0000");
      }

      return [...new Set(out)];
    }

    default:
      return genericPasswords(hint, data);
  }
}

function genericPasswords(hint, data) {
  const nums = String(hint).match(/\d+/g) || [];

  return [
    ...nums,
    data,
    "password",
    "admin",
    "root",
    "guest",
    "letmein",
    "1234",
    "0000"
  ].filter(Boolean);
}

function uniquePermutations(str) {
  const out = new Set();

  function walk(prefix, remaining) {
    if (!remaining.length) {
      out.add(prefix);
      return;
    }

    for (let i = 0; i < remaining.length; i++) {
      walk(
        prefix + remaining[i],
        remaining.slice(0, i) + remaining.slice(i + 1)
      );
    }
  }

  walk("", str);
  return [...out];
}

function romanToInt(str) {
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;

  for (let i = 0; i < str.length; i++) {
    const cur = map[str[i]];
    const next = map[str[i + 1]] || 0;

    if (cur < next) total -= cur;
    else total += cur;
  }

  return total;
}

function loadPasswords(ns) {
  const map = new Map();

  if (!ns.fileExists(PASSWORD_FILE)) return map;

  const lines = ns.read(PASSWORD_FILE).split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;

    const [host, ...pw] = line.split(":");
    map.set(host, pw.join(":"));
  }

  return map;
}

function savePasswords(ns, map) {
  let txt = "";

  for (const [host, pw] of map) {
    txt += `${host}:${pw}\n`;
  }

  ns.write(PASSWORD_FILE, txt, "w");
}

export function autocomplete() {
  return [""];
}
