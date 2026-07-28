/** @param {NS} ns */
// ═══════════════════════════════════════════════════════════════════════════════
// IPvGO Territory Bot — edge-base strategy with analysis-validated moves
// ═══════════════════════════════════════════════════════════════════════════════
// Usage:
//   run proto-go.js                    auto-ladder opponents/sizes
//   run proto-go.js Illuminati 13        lock opponent + board size
//   run proto-go.js "????????????" 13    secret opponent
// ═══════════════════════════════════════════════════════════════════════════════

const STAGE = {
    BASE: 1,
    COLUMNS: 2,
    EXPAND: 3,
    CLEANUP: 4,
    FILL: 5,
    DONE: 6,
};

const LADDER = [
    ["Netburners", 5], ["Netburners", 7],
    ["Slum Snakes", 5], ["Slum Snakes", 7],
    ["The Black Hand", 5], ["The Black Hand", 7],
    ["Tetrads", 5], ["Tetrads", 7],
    ["Daedalus", 5], ["Daedalus", 7],
    ["Illuminati", 5], ["Illuminati", 7],
    ["Illuminati", 9], ["Illuminati", 13],
    ["????????????", 13],
];

export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    const locked = ns.args.length >= 1;
    const lockOpp = locked ? String(ns.args[0]) : null;
    const lockSize = locked ? Number(ns.args[1]) || 5 : null;

    let ladderIdx = locked ? Math.max(0, LADDER.findIndex(([o, s]) => o === lockOpp && s === lockSize)) : 0;
    let wins = 0, losses = 0;
    const recent = [];
    let games = 0;

    while (games < 10000) {
        const [opponent, size] = locked ? [lockOpp, lockSize] : LADDER[ladderIdx];
        games++;

        const initial = ns.go.resetBoardState(opponent, size);
        if (!initial) {
            ns.print(`ERROR: resetBoardState failed for ${opponent} ${size}x${size}`);
            await ns.sleep(2000);
            continue;
        }

        const state = newGameState(initial);
        let turns = 0;

        gameLoop: while (true) {
            const gs = ns.go.getGameState();
            if (gs.currentPlayer === "None") break;

            if (++turns > 5000) {
                ns.print(`ERROR: turn cap — restarting ${opponent}`);
                break;
            }

            refreshBoard(ns, state);
            const moved = await executeTurn(ns, state);
            if (moved === "over") break gameLoop;
            if (state.restartGame) {
                await ns.sleep(500);
                break gameLoop;
            }

            if (!moved) {
                const pass = await ns.go.passTurn();
                if (pass.type === "gameOver") break;
            }
        }

        const final = ns.go.getGameState();
        const won = !state.restartGame && final.whiteScore > final.blackScore;
        if (won) wins++; else if (!state.restartGame) losses++;
        recent.push(won);
        if (recent.length > 10) recent.shift();

        if (!locked) {
            const wr = recent.length ? recent.filter(Boolean).length / recent.length : 0;
            if (recent.length >= 6 && wr >= 0.55 && ladderIdx < LADDER.length - 1) ladderIdx++;
            else if (recent.length >= 4 && wr <= 0.25 && ladderIdx > 0) ladderIdx--;
        }

        printStatus(ns, opponent, size, state, final, wins, losses, ladderIdx, locked);
        await ns.sleep(locked ? 200 : 50);
    }

    ns.alert("Game cap reached (10000).");
}

// ═══════════════════════════════════════════════════════════════════════════════
// TURN DRIVER — exactly one stage handler per turn
// ═══════════════════════════════════════════════════════════════════════════════

async function executeTurn(ns, state) {
    switch (state.stage) {
        case STAGE.BASE:    return stageBase(ns, state);
        case STAGE.COLUMNS: return stageColumns(ns, state);
        case STAGE.EXPAND:  return stageExpand(ns, state);
        case STAGE.CLEANUP: return stageCleanup(ns, state);
        case STAGE.FILL:    return stageFill(ns, state);
        case STAGE.DONE:    return false;
        default:
            resetAttempt(state);
            return false;
    }
}

function newGameState(board) {
    const state = {
        stage: STAGE.BASE,
        substage: 0,
        candidate: null,
        baseDirection: 0,
        baseStart: 0,
        baseEnd: 0,
        baseIndex: 0,
        basePoints: [],
        eyes: [],
        eyePoints: [],
        primaryStack: [],
        nextStraightPoint: null,
        restartGame: false,
        board: board,
        grid: new Map(),
        validMoves: [],
        minI: 0, maxI: 0, minJ: 0, maxJ: 0,
    };
    parseGrid(board, state);
    return state;
}

function refreshBoard(ns, state) {
    state.board = ns.go.getBoardState();
    parseGrid(state.board, state);
    state.validMoves = ns.go.analysis.getValidMoves(state.board);
}

function resetAttempt(state) {
    state.candidate = null;
    state.baseIndex = 0;
    state.primaryStack = [];
    state.nextStraightPoint = null;
    state.stage = STAGE.BASE;
    state.substage = 0;
}

function abandonGame(state) {
    state.restartGame = true;
    state.stage = STAGE.DONE;
}

async function tryMove(ns, state, x, y) {
    if (!isValidMove(state, x, y)) return false;
    try {
        const r = await ns.go.makeMove(x, y);
        if (r.type === "gameOver") return "over";
        return true;
    } catch {
        return false;
    }
}

function isValidMove(state, x, y) {
    return state.validMoves[x]?.[y] === true;
}

function isEmpty(state, x, y) {
    return state.grid.get(key(x, y)) === ".";
}

function isPlayable(state, x, y) {
    const c = state.grid.get(key(x, y));
    return c === "." || c === "O" || c === "X";
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 1 — EDGE BASE SHAFT
// ═══════════════════════════════════════════════════════════════════════════════

async function stageBase(ns, state) {
    if (!state.candidate) {
        const candidates = findBaseCandidates(state);
        if (candidates.length === 0) {
            if (state.eyes.length === 0) {
                abandonGame(state);
            } else {
                state.stage = STAGE.CLEANUP;
            }
            return false;
        }
        state.candidate = candidates[0];
        state.baseIndex = 0;
        state.primaryStack = [];
    }

    const cand = state.candidate;
    state.baseDirection = cand.direction;
    state.baseStart = cand.start;

    if (cand.start + state.baseIndex > cand.end) {
        state.baseEnd = cand.end;
        createBasePoints(state, cand.start, cand.end, cand.direction);
        state.stage = STAGE.COLUMNS;
        state.substage = 0;
        return false;
    }

    const pt = baseShaftPoint(state, cand, state.baseIndex);
    if (!isEmpty(state, pt.x, pt.y)) {
        if (state.baseIndex >= 5) {
            state.baseEnd = state.baseStart + state.baseIndex - 1;
            createBasePoints(state, cand.start, state.baseEnd, cand.direction);
            state.stage = STAGE.COLUMNS;
            state.substage = 0;
            return false;
        }
        resetAttempt(state);
        return false;
    }

    queueExpansionSeeds(state, pt, cand);

    const moved = await tryMove(ns, state, pt.x, pt.y);
    if (moved === "over") return "over";
    if (moved) {
        state.baseIndex++;
        return true;
    }

    if (state.baseIndex >= 5) {
        state.baseEnd = state.baseStart + state.baseIndex - 1;
        createBasePoints(state, cand.start, state.baseEnd, cand.direction);
        state.stage = STAGE.COLUMNS;
        state.substage = 0;
    } else {
        resetAttempt(state);
    }
    return false;
}

function baseShaftPoint(state, cand, index) {
    const i = cand.start + index;
    if (cand.direction === 0) return { x: i, y: state.minJ + 1 };
    if (cand.direction === 1) return { x: state.minI + 1, y: i };
    if (cand.direction === 2) return { x: i, y: state.maxJ - 1 };
    return { x: state.maxI - 1, y: i };
}

function queueExpansionSeeds(state, pt, cand) {
    const priDir = (cand.direction + 2) % 4;

    if (state.baseIndex === 0 || cand.start + state.baseIndex === cand.end) {
        const edgeDir = (cand.direction === 0 || cand.direction === 2)
            ? (state.baseIndex === 0 ? 1 : 3)
            : (state.baseIndex === 0 ? 0 : 2);
        state.primaryStack.push({
            x: pt.x, y: pt.y, direction: edgeDir,
            baseMult: 1,
        });
    }

    state.primaryStack.push({
        x: pt.x, y: pt.y, direction: priDir,
        baseMult: baseMult(pt.x, pt.y, priDir, cand.direction, state),
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 2 — CORNER COLUMNS + EYE SPLIT
// ═══════════════════════════════════════════════════════════════════════════════

async function stageColumns(ns, state) {
    if (state.substage === 0) {
        const chk = columnCheckPoint(state, state.baseStart - 1);
        const dir = (state.baseDirection === 0 || state.baseDirection === 2) ? 1 : 0;
        if (isPlayable(state, chk.x, chk.y)) {
            const col = takeColumnPoint(state, true);
            if (col) {
                state.primaryStack.push({
                    x: col.x, y: col.y, direction: dir,
                    baseMult: baseMult(col.x, col.y, dir, state.baseDirection, state),
                });
                state.substage = 1;
                const moved = await tryMove(ns, state, col.x, col.y);
                if (moved === "over") return "over";
                if (moved) return true;
            }
            resetAttempt(state);
            return false;
        }
        state.substage = 1;
    }

    if (state.substage === 1) {
        const chk = columnCheckPoint(state, state.baseEnd + 1);
        const dir = (state.baseDirection === 0 || state.baseDirection === 2) ? 3 : 2;
        if (isPlayable(state, chk.x, chk.y)) {
            const col = takeColumnPoint(state, false);
            if (col) {
                state.primaryStack.push({
                    x: col.x, y: col.y, direction: dir,
                    baseMult: baseMult(col.x, col.y, dir, state.baseDirection, state),
                });
                state.substage = 2;
                const moved = await tryMove(ns, state, col.x, col.y);
                if (moved === "over") return "over";
                if (moved) return true;
            }
            resetAttempt(state);
            return false;
        }
        state.substage = 2;
    }

    if (state.substage === 2) {
        let open = 0;
        for (const p of state.basePoints) if (isEmpty(state, p.x, p.y)) open++;

        if (open < 3) {
            resetAttempt(state);
            return false;
        }

        let idx = 0;
        let seen = 0;
        for (const p of state.basePoints) {
            if (isEmpty(state, p.x, p.y)) {
                seen++;
                if (seen === 2) {
                    state.eyes.push({
                        firstEye: state.basePoints.slice(0, idx),
                        secondEye: state.basePoints.slice(idx + 1),
                    });
                    state.stage = STAGE.EXPAND;
                    state.candidate = null;
                    const moved = await tryMove(ns, state, p.x, p.y);
                    if (moved === "over") return "over";
                    return moved;
                }
            }
            idx++;
        }
    }

    return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 3 — DIRECTED EXPANSION
// ═══════════════════════════════════════════════════════════════════════════════

async function stageExpand(ns, state) {
    if (state.nextStraightPoint) {
        const sp = state.nextStraightPoint;
        const next = step(sp, sp.direction);
        if (isValidMove(state, next.x, next.y)) {
            pushBranches(state, next, sp.direction);
            const moved = await tryMove(ns, state, next.x, next.y);
            if (moved === "over") return "over";
            if (moved) return true;
        }
        state.nextStraightPoint = null;
    }

    if (state.primaryStack.length > 0) {
        for (const p of state.primaryStack) {
            p.counter = countOpenRun(state, p);
            p.crowdMult = crowdPenalty(state, p);
            p.rate = p.baseMult * p.counter * p.crowdMult;
        }
        state.primaryStack.sort((a, b) => a.rate - b.rate);

        while (state.primaryStack.length > 0) {
            const p = state.primaryStack.pop();
            const next = step(p, p.direction);
            if (!isValidMove(state, next.x, next.y)) continue;

            pushBranches(state, next, p.direction);
            const moved = await tryMove(ns, state, next.x, next.y);
            if (moved === "over") return "over";
            if (moved) return true;
        }
    }

    resetAttempt(state);
    return false;
}

function pushBranches(state, next, direction) {
    state.nextStraightPoint = { x: next.x, y: next.y, direction };

    const right = (direction + 1) % 4;
    const left = (direction + 3) % 4;
    state.primaryStack.push(
        { x: next.x, y: next.y, direction: right, baseMult: baseMult(next.x, next.y, right, state.baseDirection, state) },
        { x: next.x, y: next.y, direction: left, baseMult: baseMult(next.x, next.y, left, state.baseDirection, state) },
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 4 — EYE CLEANUP
// ═══════════════════════════════════════════════════════════════════════════════

async function stageCleanup(ns, state) {
    for (const eye of state.eyes) {
        const first = eye.firstEye;
        const second = eye.secondEye;

        while (first.length > 1 || second.length > 1) {
            if (first.length > 1) {
                for (let i = 0; i < first.length; i++) {
                    const p = first[i];
                    if (isEmpty(state, p.x, p.y) && isValidMove(state, p.x, p.y)) {
                        first.splice(i, 1);
                        const moved = await tryMove(ns, state, p.x, p.y);
                        if (moved === "over") return "over";
                        if (moved) return true;
                    }
                }
            }
            if (second.length > 1) {
                for (let i = 0; i < second.length; i++) {
                    const p = second[i];
                    if (isEmpty(state, p.x, p.y) && isValidMove(state, p.x, p.y)) {
                        second.splice(i, 1);
                        const moved = await tryMove(ns, state, p.x, p.y);
                        if (moved === "over") return "over";
                        if (moved) return true;
                    }
                }
            }
        }

        if (first.length === 1 && second.length === 1) {
            state.eyePoints.push({ firstEyePoint: first[0], secondEyePoint: second[0] });
        } else {
            ns.print("WARN: malformed eye — restarting attempt");
            resetAttempt(state);
            return false;
        }
    }

    state.stage = STAGE.FILL;
    return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 5 — TERRITORY FILL (skip eye liberties)
// ═══════════════════════════════════════════════════════════════════════════════

async function stageFill(ns, state) {
    const protectedPts = new Set();
    for (const ep of state.eyePoints) {
        protectedPts.add(key(ep.firstEyePoint.x, ep.firstEyePoint.y));
        protectedPts.add(key(ep.secondEyePoint.x, ep.secondEyePoint.y));
    }

    let best = null;
    let bestScore = -1;

    for (let x = state.minI; x <= state.maxI; x++) {
        for (let y = state.minJ; y <= state.maxJ; y++) {
            if (protectedPts.has(key(x, y))) continue;
            if (!isValidMove(state, x, y)) continue;

            const run = countOpenRunFrom(state, x, y);
            const edge = edgeBonus(state, x, y);
            const score = run + edge;
            if (score > bestScore) {
                bestScore = score;
                best = { x, y };
            }
        }
    }

    if (best) {
        const moved = await tryMove(ns, state, best.x, best.y);
        if (moved === "over") return "over";
        if (moved) return true;
    }

    state.stage = STAGE.DONE;
    return false;
}

function edgeBonus(state, x, y) {
    let b = 0;
    if (x === state.minI || x === state.maxI) b += 0.5;
    if (y === state.minJ || y === state.maxJ) b += 0.5;
    return b;
}

function countOpenRunFrom(state, x, y) {
    let n = 0;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const c = state.grid.get(key(x + dx, y + dy));
        if (c === ".") n++;
    }
    return n;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRID / CANDIDATE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function parseGrid(board, state) {
    const grid = new Map();
    let maxI = -1, maxJ = -1, minI = 99, minJ = 99;

    for (let x = 0; x < board.length; x++) {
        const col = board[x];
        for (let y = 0; y < col.length; y++) {
            const ch = col[y];
            grid.set(key(x, y), ch);
            if (ch === ".") {
                if (x < minI) minI = x;
                if (x > maxI) maxI = x;
                if (y < minJ) minJ = y;
                if (y > maxJ) maxJ = y;
            }
        }
    }

    state.grid = grid;
    state.minI = minI;
    state.maxI = maxI;
    state.minJ = minJ;
    state.maxJ = maxJ;
}

function findBaseCandidates(state) {
    const out = [];
    for (let dir = 0; dir < 4; dir++) {
        const minC = (dir === 0 || dir === 2) ? state.minI : state.minJ;
        const maxC = (dir === 0 || dir === 2) ? state.maxI : state.maxJ;
        let streak = false;
        let start = 0;

        for (let i = minC; i <= maxC; i++) {
            const [c0, c1] = edgePair(state, dir, i);
            if (streak) {
                if (c0 !== "." || c1 !== ".") {
                    const len = i - start;
                    if (len >= 4) out.push(makeCandidate(dir, start, i - 1));
                    streak = false;
                }
            } else if (c0 === "." && c1 === ".") {
                streak = true;
                start = i;
            }
        }
        if (streak) {
            const len = maxC - start + 1;
            if (len >= 4) out.push(makeCandidate(dir, start, maxC));
        }
    }
    out.sort((a, b) => b.length - a.length);
    return out;
}

function edgePair(state, dir, i) {
    if (dir === 0) return [state.grid.get(key(i, state.minJ)), state.grid.get(key(i, state.minJ + 1))];
    if (dir === 1) return [state.grid.get(key(state.minI, i)), state.grid.get(key(state.minI + 1, i))];
    if (dir === 2) return [state.grid.get(key(i, state.maxJ)), state.grid.get(key(i, state.maxJ - 1))];
    return [state.grid.get(key(state.maxI, i)), state.grid.get(key(state.maxI - 1, i))];
}

function makeCandidate(dir, start, end) {
    return { direction: dir, start, end, length: end - start + 1 };
}

function createBasePoints(state, start, end, dir) {
    const pts = [];
    for (let i = start; i <= end; i++) {
        if (dir === 0) pts.push({ x: i, y: state.minJ });
        else if (dir === 1) pts.push({ x: state.minI, y: i });
        else if (dir === 2) pts.push({ x: i, y: state.maxJ });
        else pts.push({ x: state.maxI, y: i });
    }
    state.basePoints = pts;
}

function columnCheckPoint(state, baseVal) {
    if (state.baseDirection === 0) return { x: baseVal, y: state.minJ };
    if (state.baseDirection === 1) return { x: state.minI, y: baseVal };
    if (state.baseDirection === 2) return { x: baseVal, y: state.maxJ };
    return { x: state.maxI, y: baseVal };
}

function takeColumnPoint(state, fromStart) {
    while (state.basePoints.length > 0) {
        const p = fromStart ? state.basePoints.shift() : state.basePoints.pop();
        if (isEmpty(state, p.x, p.y)) return p;
    }
    return null;
}

function step(pt, dir) {
    if (dir === 0) return { x: pt.x, y: pt.y - 1 };
    if (dir === 1) return { x: pt.x - 1, y: pt.y };
    if (dir === 2) return { x: pt.x, y: pt.y + 1 };
    return { x: pt.x + 1, y: pt.y };
}

function countOpenRun(state, pt) {
    let n = 0;
    let cur = step(pt, pt.direction);
    while (state.grid.has(key(cur.x, cur.y)) && isEmpty(state, cur.x, cur.y)) {
        n++;
        if (n >= 13) break;
        cur = step(cur, pt.direction);
    }
    return n;
}

function crowdPenalty(state, pt) {
    let mult = 1;
    const fwd = step(pt, pt.direction);
    const left = step(fwd, (pt.direction + 3) % 4);
    const right = step(fwd, (pt.direction + 1) % 4);
    if (state.grid.get(key(left.x, left.y)) === "X") mult *= 0.5;
    if (state.grid.get(key(right.x, right.y)) === "X") mult *= 0.5;
    return mult;
}

function baseMult(x, y, dir, baseDir, state) {
    const vert = dir === 0 || dir === 2;
    const horiz = dir === 1 || dir === 3;

    if (vert) {
        if (baseDir === 0 || baseDir === 2) {
            if (x === state.minI || x === state.maxI) return 1;
            if (x === state.minI + 1 || x === state.maxI - 1) return 1.5;
            return 2;
        }
        if (baseDir === 1) {
            if (x <= state.minI + 2 || x === state.maxI) return 1;
            if (x === state.minI + 3 || x === state.maxI - 1) return 1.5;
            return 2;
        }
        if (x === state.minI || x >= state.maxI - 2) return 1;
        if (x === state.minI + 1 || x === state.maxI - 3) return 1.5;
        return 2;
    }

    if (horiz) {
        if (baseDir === 1 || baseDir === 3) {
            if (y === state.minJ || y === state.maxJ) return 1;
            if (y === state.minJ + 1 || y === state.maxJ - 1) return 1.5;
            return 2;
        }
        if (baseDir === 0) {
            if (y <= state.minJ + 2 || y === state.maxJ) return 1;
            if (y === state.minJ + 3 || y === state.maxJ - 1) return 1.5;
            return 2;
        }
        if (y === state.minJ || y >= state.maxJ - 2) return 1;
        if (y === state.minJ + 1 || y === state.maxJ - 3) return 1.5;
        return 2;
    }

    return 1;
}

function key(x, y) {
    return `${x}_${y}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS
// ═══════════════════════════════════════════════════════════════════════════════

function printStatus(ns, opponent, size, state, final, wins, losses, ladderIdx, locked) {
    const total = wins + losses;
    const wr = total ? ((wins / total) * 100).toFixed(0) : "0";
    const recent = total ? `${wins}W/${losses}L (${wr}%)` : "0W/0L";
    const result = state.restartGame ? "SKIP"
        : final.whiteScore > final.blackScore ? "WIN"
        : final.whiteScore < final.blackScore ? "LOSS" : "TIE";
    const mode = locked ? "LOCKED" : `Ladder ${ladderIdx + 1}/${LADDER.length}`;

    ns.clearLog();
    ns.print(`┌──────────────────────────────────────────────┐`);
    ns.print(`│  IPvGO Territory Bot  ${new Date().toLocaleTimeString().padStart(18)}│`);
    ns.print(`├──────────────────────────────────────────────┤`);
    ns.print(`│ ${opponent.padEnd(20)} ${String(size).padStart(2)}x${String(size).padEnd(14)}│`);
    ns.print(`│ ${mode.padEnd(38)} │`);
    ns.print(`│ Last: ${result}  ${final.whiteScore.toFixed(1)} vs ${final.blackScore.toFixed(1)}`.padEnd(39) + "│");
    ns.print(`│ Session: ${recent}`.padEnd(39) + "│");
    ns.print(`│ Stage: ${stageName(state.stage)}`.padEnd(39) + "│");
    ns.print(`└──────────────────────────────────────────────┘`);
}

function stageName(stage) {
    switch (stage) {
        case STAGE.BASE: return "Base shaft";
        case STAGE.COLUMNS: return "Columns / eyes";
        case STAGE.EXPAND: return "Expansion";
        case STAGE.CLEANUP: return "Eye cleanup";
        case STAGE.FILL: return "Territory fill";
        case STAGE.DONE: return "Passing out";
        default: return `Unknown (${stage})`;
    }
}