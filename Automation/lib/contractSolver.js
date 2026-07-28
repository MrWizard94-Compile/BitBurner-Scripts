/** Solve a coding contract. Returns answer string/array or null if unsupported. */
export function solveContract(type, data) {
    try {
        switch (type) {
            case "Find Largest Prime Factor": return solveLargestPrimeFactor(data);
            case "Subarray with Maximum Sum": return solveMaxSubarray(data);
            case "Total Ways to Sum": return solveTotalWaysToSum(data);
            case "Total Ways to Sum II": return solveTotalWaysToSumII(data[0], data[1]);
            case "Spiralize Matrix": return solveSpiralize(data);
            case "Array Jumping Game": return solveJumpGame(data);
            case "Array Jumping Game II": return solveJumpGameII(data);
            case "Merge Overlapping Intervals": return solveMergeIntervals(data);
            case "Generate IP Addresses": return solveGenerateIP(data);
            case "Algorithmic Stock Trader I": return solveStockI(data);
            case "Algorithmic Stock Trader II": return solveStockII(data);
            case "Algorithmic Stock Trader III": return solveStockIII(data);
            case "Algorithmic Stock Trader IV": return solveStockIV(data[0], data[1]);
            case "Minimum Path Sum in a Triangle": return solveMinPathTriangle(data);
            case "Unique Paths in a Grid I": return solveUniquePathsI(data[0], data[1]);
            case "Unique Paths in a Grid II": return solveUniquePathsII(data);
            case "Shortest Path in a Grid": return solveShortestPathGrid(data[0], data[1], data[2]);
            case "Sanitize Parentheses in Expression": return solveSanitizeParens(data);
            case "Find All Valid Math Expressions": return solveValidMathExprs(data[0], data[1]);
            case "HammingCodes: Integer to Encoded Binary": return solveHammingEncode(data);
            case "HammingCodes: Encoded Binary to Integer": return solveHammingDecode(data);
            case "Proper 2-Coloring of a Graph": return solve2Color(data);
            case "Compression I: RLE Compression": return solveRLECompress(data);
            case "Compression II: LZ Decompression": return solveLZDecompress(data);
            case "Compression III: LZ Compression": return solveLZCompress(data);
            case "Encryption I: Caesar Cipher": return solveCaesar(data);
            case "Encryption II: Vigenère Cipher": return solveVigenere(data);
            case "Square Root": return solveSqrt(data);
            case "Total Number of Primes": return solvePrimeCount(data);
            case "Largest Rectangle in a Matrix": return solveLargestRectangle(data);
            default: return null;
        }
    } catch {
        return null;
    }
}

function solveLargestPrimeFactor(n) {
    n = Number(n);
    let i = 2;
    while (i * i <= n) {
        while (n % i === 0) n /= i;
        i++;
    }
    return String(n);
}

function solveMaxSubarray(nums) {
    let max = nums[0], cur = nums[0];
    for (let i = 1; i < nums.length; i++) {
        cur = Math.max(nums[i], cur + nums[i]);
        max = Math.max(max, cur);
    }
    return String(max);
}

function solveTotalWaysToSum(n) {
    const dp = Array(n + 1).fill(0);
    dp[0] = 1;
    for (let i = 1; i < n; i++) {
        for (let j = i; j <= n; j++) dp[j] += dp[j - i];
    }
    return String(dp[n]);
}

function solveTotalWaysToSumII(n, s) {
    const dp = Array(n + 1).fill(0);
    dp[0] = 1;
    for (const num of s) {
        for (let j = num; j <= n; j++) dp[j] += dp[j - num];
    }
    return String(dp[n]);
}

function solveSpiralize(matrix) {
    const n = matrix.length;
    const out = Array.from({ length: n }, () => Array(n).fill(0));
    let top = 0, bottom = n - 1, left = 0, right = n - 1, val = 1;
    while (val <= n * n) {
        for (let c = left; c <= right; c++) out[top][c] = val++;
        top++;
        for (let r = top; r <= bottom; r++) out[r][right] = val++;
        right--;
        for (let c = right; c >= left; c--) out[bottom][c] = val++;
        bottom--;
        for (let r = bottom; r >= top; r--) out[r][left] = val++;
        left++;
    }
    return JSON.stringify(out);
}

function solveJumpGame(arr) {
    let reach = 0;
    for (let i = 0; i < arr.length; i++) {
        if (i > reach) return "0";
        reach = Math.max(reach, i + arr[i]);
    }
    return "1";
}

function solveJumpGameII(arr) {
    let jumps = 0, cur = 0, far = 0;
    for (let i = 0; i < arr.length - 1; i++) {
        far = Math.max(far, i + arr[i]);
        if (i === cur) {
            jumps++;
            cur = far;
        }
    }
    return String(jumps);
}

function solveMergeIntervals(intervals) {
    if (!intervals.length) return "[]";
    intervals.sort((a, b) => a[0] - b[0]);
    const out = [intervals[0]];
    for (let i = 1; i < intervals.length; i++) {
        const last = out[out.length - 1];
        if (intervals[i][0] <= last[1]) last[1] = Math.max(last[1], intervals[i][1]);
        else out.push(intervals[i]);
    }
    return JSON.stringify(out);
}

function solveGenerateIP(s) {
    const res = [];
    function valid(seg) {
        if (!seg.length || seg.length > 3) return false;
        if (seg.length > 1 && seg[0] === "0") return false;
        return Number(seg) <= 255;
    }
    function dfs(start, parts) {
        if (parts.length === 4) {
            if (start === s.length) res.push(parts.join("."));
            return;
        }
        for (let len = 1; len <= 3 && start + len <= s.length; len++) {
            const seg = s.slice(start, start + len);
            if (!valid(seg)) continue;
            dfs(start + len, [...parts, seg]);
        }
    }
    dfs(0, []);
    return JSON.stringify(res);
}

function solveStockI(prices) {
    let min = prices[0], best = 0;
    for (const p of prices) {
        min = Math.min(min, p);
        best = Math.max(best, p - min);
    }
    return String(best);
}

function solveStockII(prices) {
    let profit = 0;
    for (let i = 1; i < prices.length; i++) {
        if (prices[i] > prices[i - 1]) profit += prices[i] - prices[i - 1];
    }
    return String(profit);
}

function solveStockIII(prices) {
    let buy1 = -prices[0], sell1 = 0, buy2 = -prices[0], sell2 = 0;
    for (let i = 1; i < prices.length; i++) {
        buy1 = Math.max(buy1, -prices[i]);
        sell1 = Math.max(sell1, buy1 + prices[i]);
        buy2 = Math.max(buy2, sell1 - prices[i]);
        sell2 = Math.max(sell2, buy2 + prices[i]);
    }
    return String(sell2);
}

function solveStockIV(k, prices) {
    if (!prices.length) return "0";
    if (k >= prices.length / 2) return solveStockII(prices);
    const dp = Array(k + 1).fill(0).map(() => Array(prices.length).fill(0));
    for (let t = 1; t <= k; t++) {
        let maxDiff = -prices[0];
        for (let d = 1; d < prices.length; d++) {
            dp[t][d] = Math.max(dp[t][d - 1], prices[d] + maxDiff);
            maxDiff = Math.max(maxDiff, dp[t - 1][d] - prices[d]);
        }
    }
    return String(dp[k][prices.length - 1]);
}

function solveMinPathTriangle(triangle) {
    const dp = [...triangle[triangle.length - 1]];
    for (let r = triangle.length - 2; r >= 0; r--) {
        for (let c = 0; c < triangle[r].length; c++) {
            dp[c] = triangle[r][c] + Math.min(dp[c], dp[c + 1]);
        }
    }
    return String(dp[0]);
}

function solveUniquePathsI(rows, cols) {
    const dp = Array(cols).fill(1);
    for (let r = 1; r < rows; r++) {
        for (let c = 1; c < cols; c++) dp[c] += dp[c - 1];
    }
    return String(dp[cols - 1]);
}

function solveUniquePathsII(grid) {
    const rows = grid.length, cols = grid[0].length;
    const dp = Array(cols).fill(0);
    dp[0] = grid[0][0] === 0 ? 1 : 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (grid[r][c] === 1) dp[c] = 0;
            else if (c > 0) dp[c] += dp[c - 1];
        }
    }
    return String(dp[cols - 1]);
}

function solveShortestPathGrid(grid, start, end) {
    const rows = grid.length, cols = grid[0].length;
    const dirs = [[0, 1, "R"], [0, -1, "L"], [1, 0, "D"], [-1, 0, "U"]];
    const queue = [[start[0], start[1], ""]];
    const seen = new Set([`${start[0]},${start[1]}`]);
    while (queue.length) {
        const [r, c, path] = queue.shift();
        if (r === end[0] && c === end[1]) return path;
        for (const [dr, dc, ch] of dirs) {
            const nr = r + dr, nc = c + dc;
            const key = `${nr},${nc}`;
            if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
            if (grid[nr][nc] === 1 || seen.has(key)) continue;
            seen.add(key);
            queue.push([nr, nc, path + ch]);
        }
    }
    return "";
}

function solveSanitizeParens(s) {
    const res = new Set();
    function valid(str) {
        let bal = 0;
        for (const ch of str) {
            if (ch === "(") bal++;
            else if (ch === ")") {
                bal--;
                if (bal < 0) return false;
            }
        }
        return bal === 0;
    }
    function dfs(str, idx, remL, remR, cur) {
        if (idx === str.length) {
            if (remL === 0 && remR === 0 && valid(cur)) res.add(cur);
            return;
        }
        const ch = str[idx];
        if (ch === "(" && remL > 0) dfs(str, idx + 1, remL - 1, remR, cur);
        else if (ch === ")" && remR > 0) dfs(str, idx + 1, remL, remR - 1, cur);
        if (ch !== "(" && ch !== ")") dfs(str, idx + 1, remL, remR, cur + ch);
        else dfs(str, idx + 1, remL, remR, cur + ch);
    }
    let l = 0, r = 0;
    for (const ch of s) {
        if (ch === "(") l++;
        else if (ch === ")") l > 0 ? l-- : r++;
    }
    dfs(s, 0, l, r, "");
    return JSON.stringify([...res]);
}

function solveValidMathExprs(num, target) {
    const res = [];
    function dfs(idx, path, val, prev) {
        if (idx === num.length) {
            if (val === target) res.push(path);
            return;
        }
        for (let j = idx; j < num.length; j++) {
            if (j > idx && num[idx] === "0") break;
            const cur = Number(num.slice(idx, j + 1));
            if (idx === 0) dfs(j + 1, String(cur), cur, cur);
            else {
                dfs(j + 1, `${path}+${cur}`, val + cur, cur);
                dfs(j + 1, `${path}-${cur}`, val - cur, -cur);
                dfs(j + 1, `${path}*${cur}`, val - prev + prev * cur, prev * cur);
            }
        }
    }
    dfs(0, "", 0, 0);
    return JSON.stringify(res);
}

function solveHammingEncode(value) {
    const bits = value.toString(2);
    const m = bits.length;
    let r = 0;
    while (2 ** r < m + r + 1) r++;
    const total = m + r;
    const out = Array(total + 1).fill(0);
    let j = 1;
    for (let i = 1; i <= total; i++) {
        if ((i & (i - 1)) !== 0) out[i] = Number(bits[j - 1] || 0), j++;
    }
    for (let i = 0; i <= r; i++) {
        const p = 2 ** i;
        let parity = 0;
        for (let k = 1; k <= total; k++) {
            if (k & p) parity ^= out[k];
        }
        out[p] = parity;
    }
    return out.slice(1).join("");
}

function solveHammingDecode(encoded) {
    const bits = encoded.split("").map(Number);
    const total = bits.length;
    let r = 0;
    while (2 ** r < total + 1) r++;
    const copy = [0, ...bits];
    let err = 0;
    for (let i = 0; i <= r; i++) {
        const p = 2 ** i;
        let parity = 0;
        for (let k = 1; k <= total; k++) {
            if (k & p) parity ^= copy[k];
        }
        if (parity) err += p;
    }
    if (err) copy[err] ^= 1;
    let val = 0;
    for (let i = 1; i <= total; i++) {
        if ((i & (i - 1)) !== 0) val = (val << 1) | copy[i];
    }
    return String(val);
}

function solve2Color(graph) {
    const color = {};
    for (const node of Object.keys(graph)) {
        if (color[node] !== undefined) continue;
        const queue = [node];
        color[node] = 0;
        while (queue.length) {
            const n = queue.shift();
            for (const nb of graph[n]) {
                if (color[nb] === undefined) {
                    color[nb] = color[n] === 0 ? 1 : 0;
                    queue.push(nb);
                } else if (color[nb] === color[n]) {
                    return "[]";
                }
            }
        }
    }
    return JSON.stringify(color);
}

function solveRLECompress(s) {
    let out = "", i = 0;
    while (i < s.length) {
        let j = i + 1;
        while (j < s.length && s[j] === s[i]) j++;
        const count = j - i;
        out += count > 1 ? `${count}${s[i]}` : s[i];
        i = j;
    }
    return out;
}

function solveLZDecompress(s) {
    let out = "", i = 0;
    while (i < s.length) {
        if (/[0-9]/.test(s[i])) {
            let num = "";
            while (i < s.length && /[0-9]/.test(s[i])) num += s[i++];
            const count = Number(num);
            const ch = s[i++];
            out += ch.repeat(count);
        } else {
            out += s[i++];
        }
    }
    return out;
}

function solveLZCompress(s) {
    let out = "", i = 0;
    while (i < s.length) {
        let bestLen = 0, bestOff = 0;
        for (let len = 1; len <= Math.min(20, s.length - i); len++) {
            const sub = s.slice(i, i + len);
            const idx = s.lastIndexOf(sub, i - 1);
            if (idx !== -1 && i - idx <= 20) {
                bestLen = len;
                bestOff = i - idx;
            }
        }
        if (bestLen > 2) {
            out += `${bestOff}.${bestLen}`;
            i += bestLen;
        } else {
            out += s[i++];
        }
    }
    return out;
}

function solveCaesar([text, shift]) {
    return text.replace(/[a-z]/gi, (ch) => {
        const base = ch <= "Z" ? 65 : 97;
        return String.fromCharCode(((ch.charCodeAt(0) - base + shift) % 26) + base);
    });
}

function solveVigenere([text, key]) {
    let out = "", ki = 0;
    for (const ch of text) {
        if (!/[a-z]/i.test(ch)) { out += ch; continue; }
        const base = ch <= "Z" ? 65 : 97;
        const k = key[ki++ % key.length];
        const kb = k <= "Z" ? 65 : 97;
        const shift = k.charCodeAt(0) - kb;
        out += String.fromCharCode(((ch.charCodeAt(0) - base + shift) % 26) + base);
    }
    return out;
}

function solveSqrt(n) {
    if (n === 0) return "0";
    let x = n;
    while (true) {
        const nx = (x + n / x) / 2;
        if (Math.abs(nx - x) < 1e-12) break;
        x = nx;
    }
    return String(Math.round(x));
}

function solvePrimeCount(n) {
    if (n < 2) return "0";
    const sieve = Array(n).fill(true);
    sieve[0] = sieve[1] = false;
    for (let i = 2; i * i < n; i++) {
        if (!sieve[i]) continue;
        for (let j = i * i; j < n; j += i) sieve[j] = false;
    }
    return String(sieve.filter(Boolean).length);
}

function solveLargestRectangle(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const heights = Array(cols).fill(0);
    let max = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            heights[c] = matrix[r][c] === "0" ? heights[c] + 1 : 0;
        }
        max = Math.max(max, largestRectInHistogram(heights));
    }
    return String(max);
}

function largestRectInHistogram(h) {
    const stack = [];
    let max = 0;
    for (let i = 0; i <= h.length; i++) {
        const cur = i === h.length ? 0 : h[i];
        while (stack.length && cur < h[stack[stack.length - 1]]) {
            const hi = h[stack.pop()];
            const w = stack.length ? i - stack[stack.length - 1] - 1 : i;
            max = Math.max(max, hi * w);
        }
        stack.push(i);
    }
    return max;
}