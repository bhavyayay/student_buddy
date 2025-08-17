// background.js — Student Buddy hint engine (difficulty-aware, category-based)

console.log('[StudentBuddy] background service worker up');

const H = (c, a, e) => ({ c, a, e }); // tiny helper

// ---- Category matchers (ordered) ----
const CATEGORY_MATCHERS = [
  { key: 'two-sum', rx: /(two\s*sum\b)/i },
  { key: 'add-two-numbers', rx: /(add\s*two\s*numbers|linked\s*list.*add)/i },
  { key: 'reverse-linked-list', rx: /(reverse.*linked\s*list)/i },
  { key: 'merge-two-sorted-lists', rx: /(merge.*two.*sorted.*list)/i },
  { key: 'binary-search', rx: /(binary\s*search|rotated\s*sorted|find\s*minimum\s*in\s*rotated)/i },
  { key: 'sliding-window', rx: /(longest.*substring|minimum.*window|sliding\s*window)/i },
  { key: 'three-sum', rx: /\b3sum|three\s*sum|sum\s*three\b/i },
  { key: 'trapping-rain-water', rx: /(trapping\s*rain\s*water|rainwater|container\s*with\s*most\s*water)/i },
  { key: 'prefix-sum', rx: /(subarray\s*sum|prefix\s*sum)/i },
  { key: 'stack-monotonic', rx: /(daily\s*temperatures|largest\s*rectangle|monotonic\s*stack)/i },
  { key: 'intervals', rx: /(merge\s*intervals|meeting.*rooms|insert\s*interval)/i },
  { key: 'heap', rx: /(kth\s*largest|top\s*k|priority\s*queue|heap)/i },
  { key: 'graph-bfs-dfs', rx: /(number\s*of\s*islands|flood\s*fill|bfs|dfs|connected\s*components)/i },
  { key: 'graph-toposort', rx: /(course\s*schedule|topological)/i },
  { key: 'graph-shortest', rx: /(dijkstra|network\s*delay|cheapest\s*flights|shortest\s*path)/i },
  { key: 'dp-classic', rx: /(coin\s*change|edit\s*distance|word\s*break|lis|longest\s*increasing)/i },
  { key: 'n-queens', rx: /(n-queens|n queens)/i },
  { key: 'regex-matching', rx: /(regular.*expression|regex.*matching|wildcard.*matching)/i },
  { key: 'lru-lfu', rx: /(lru|lfu)\s*cache/i },
  { key: 'hard-strings', rx: /(palindrome\s*partition|minimum\s*window|hard.*string)/i },
  { key: 'median-two-arrays', rx: /(median.*two.*sorted.*arrays)/i },
  { key: 'word-ladder', rx: /(word\s*ladder)/i },
];

// ---- Difficulty-aware hints per category ----
const HINTS = {
  fallback: {
    easy: H(
      'Rephrase the problem and list input/output types and constraints.',
      'Start with brute force, then try HashMap/Two Pointers/Sorting to cut complexity.',
      'Run through a tiny happy-path input and one edge case (empty/one element).'
    ),
    medium: H(
      'Break into subproblems; look for overlapping subproblems or monotonic structure.',
      'Try Sliding Window / Binary Search on answer / DP / Greedy; reason about O(n) / O(n log n).',
      "Trace a mid-sized example and show why the invariant or transition is correct."
    ),
    hard: H(
      'Let constraints drive the technique (n≈1e5 ⇒ O(n log n) or O(n)).',
      'Consider advanced tools: Monotonic Stack, Union–Find, Segment Tree, Bitmask DP, SCC, Min-Cut/Max-Flow.',
      "Create a counterexample for a naive idea; refine the invariant or state definition until it holds."
    )
  },

  'two-sum': {
    easy: H(
      'You need indices of two numbers summing to target.',
      'One-pass HashMap: for each x, check if (target−x) seen; else store x→index.',
      'Example: [2,7,11,15], 9 → see 2, store {2:0}; see 7, 9−7=2 in map → [0,1].'
    ),
    medium: H(
      'Generalize to k-sum or handle duplicates/ordering constraints.',
      'Sort + two pointers, or HashMap counting; guard against using same index twice.',
      'Example: two-sum in a BST: in-order + two pointers on the values.'
    ),
    hard: H(
      'Streaming / space-bounded variants: cannot keep full map.',
      'Use Bloom filter / pair-sums sketch / reservoir sampling depending on constraints.',
      'Example: disallow extra space → sort in-place then two pointers; analyze stability & cost.'
    )
  },

  'add-two-numbers': {
    easy: H(
      'Add two numbers stored in linked lists (least significant first).',
      'Traverse both lists with carry; build a new list node-by-node.',
      'Example: 243 + 564 → (3+4=7,c0),(4+6=10,c1),(2+5+1=8,c0) → 807.'
    ),
    medium: H(
      'Lists in forward order.',
      'Use stacks to reverse the addition order; pop & add with carry.',
      'Example: L1=7→2→4→3, L2=5→6→4 → push, add from top: 3427+465=3892.'
    ),
    hard: H(
      'In-place with O(1) extra space and forward order.',
      'Reverse both, add in place (or use recursion with length alignment).',
      'Example: align by length, recurse to tail, bubble carry back.'
    )
  },

  'reverse-linked-list': {
    easy: H(
      'Reverse a singly linked list.',
      'Iterative: prev=null, cur=head; loop: [cur.next=prev, prev=cur, cur=next].',
      'Example: 1→2→3 → 3→2→1.'
    ),
    medium: H(
      'Reverse sub-list [m,n].',
      'Walk to m−1, reverse n−m+1 nodes, reattach.',
      'Example: 1→2→3→4→5, m=2,n=4 → 1→4→3→2→5.'
    ),
    hard: H(
      'Reverse in k-groups.',
      'Count k nodes; reverse each chunk; connect with tail recursion/iterative splice.',
      'Example: k=3 on 1..6 → (3 2 1) (6 5 4).'
    )
  },

  'merge-two-sorted-lists': {
    easy: H(
      'Merge two sorted linked lists.',
      'Dummy head; take smaller head each step.',
      'Example: [1,3,5] + [2,4] → [1,2,3,4,5].'
    ),
    medium: H(
      'Merge k lists.',
      'Min-heap of heads (k), pop/push O(log k).',
      'Example: k=3 lists → repeatedly pop smallest head.'
    ),
    hard: H(
      'Time-limit tight / big k.',
      'Divide & conquer pairwise merge to reduce heap churn.',
      'Example: merge by halving ranges until one list remains.'
    )
  },

  'binary-search': {
    easy: H(
      'Search in sorted array.',
      'Classic l,r while (l<=r) mid; move side that cannot contain target.',
      'Example: [1,3,5,7], target=5 → mid=5 hit.'
    ),
    medium: H(
      'Rotated array / first bad / boundary problems.',
      'Binary search for predicate (monotonic boolean).',
      'Example: first bad version: move right when good(mid), else left.'
    ),
    hard: H(
      'Binary search on answer / parametric search.',
      'Define feasible(mid) in O(n) or O(n log n); shrink domain.',
      'Example: split array into m parts minimizing max-sum; feasible via greedy.'
    )
  },

  'sliding-window': {
    easy: H(
      'Contiguous subarray / substring with constraint.',
      'Expand right; when invalid, shrink left until valid; track best.',
      'Example: longest substring no-repeat: freq map + left pointer.'
    ),
    medium: H(
      'Variable vs fixed-length windows; multiple constraints.',
      'Maintain counts + “missing” metric to decide when to contract.',
      'Example: min window substring: expand until all met → then contract.'
    ),
    hard: H(
      'Multiple alphabets / weighted / k distinct / replacements.',
      'Use two pointers + counter-of-counters; sometimes two passes for symmetry.',
      'Example: longest substring with k replacements: keep maxFreq to allow windowSize-maxFreq ≤ k.'
    )
  },

  'three-sum': {
    easy: H(
      'Find unique triplets sum to 0.',
      'Sort, fix i, two pointers l/r; skip duplicates.',
      'Example: [-4,-1,-1,0,1,2] → fix -1, l/r to find 0.'
    ),
    medium: H(
      '3Sum Closest / 4Sum.',
      'Same two-pointer backbone; prune with bounds.',
      'Example: 4Sum target T with nested 2Sum on residual.'
    ),
    hard: H(
      'Big n; time tight.',
      'Meet-in-the-middle for 4Sum, hashing pair sums with dedup sets.',
      'Example: store pair sums in map of indices; ensure i<j<k<l.'
    )
  },

  'trapping-rain-water': {
    easy: H(
      'Water above bar = min(leftMax,rightMax)-height if positive.',
      'Two pointers tracking leftMax/rightMax; add water on lower side.',
      'Example: [0,1,0,2] → collect 1 at index 2.'
    ),
    medium: H(
      'Rain Water II (2D).',
      'Min-heap on border cells; expand inward with current waterline.',
      'Example: like Dijkstra on heights.'
    ),
    hard: H(
      'Large grid / memory.',
      'Process by layers or compress; careful with visited & pushing rule.',
      'Example: push neighbors only when raising waterline.'
    )
  },

  'prefix-sum': {
    easy: H(
      'Count subarrays meeting sum condition.',
      'Prefix sums + HashMap of counts; look for pre[i]-k.',
      'Example: subarray sum = k.'
    ),
    medium: H(
      'Binary arrays / divisible by k.',
      'Use mod classes in map; handle negatives by normalizing.',
      'Example: subarrays divisible by K.'
    ),
    hard: H(
      '2D prefix / many queries.',
      'Integral image (2D prefix); or offline with Fenwick/Segment tree.',
      'Example: sum in any rectangle in O(1) after O(nm) precompute.'
    )
  },

  'stack-monotonic': {
    easy: H(
      'Next greater element / daily temperatures.',
      'Maintain decreasing stack of indices; pop when current breaks it.',
      'Example: [73,74,75,71,69,72,76,73].'
    ),
    medium: H(
      'Largest rectangle in histogram.',
      'Monotonic stack of increasing heights; compute span on pop.',
      'Example: sentinel 0 at end to flush stack.'
    ),
    hard: H(
      'Min range queries with updates.',
      'Cartesian tree + RMQ / segment tree; or use stack to build tree.',
      'Example: online updates need segment tree with lazy.'
    )
  },

  'intervals': {
    easy: H(
      'Merge overlapping intervals.',
      'Sort by start; if next.start ≤ cur.end → merge; else push new.',
      'Example: [[1,3],[2,6],[8,10]] → [[1,6],[8,10]].'
    ),
    medium: H(
      'Insert interval / meeting rooms.',
      'Sweep line; maintain active count or merge-on-insert.',
      'Example: meeting rooms → count max overlap.'
    ),
    hard: H(
      'Min intervals to cover queries / remove min to eliminate overlap.',
      'Greedy with heap on end times; or offline queries with heap.',
      'Example: sort intervals by start; push those starting ≤ q; pop by smallest end.'
    )
  },

  'heap': {
    easy: H(
      'Kth largest / Top K.',
      'Use size-k min-heap; keep the k largest.',
      'Example: stream elements, push/pop accordingly.'
    ),
    medium: H(
      'Merge k sorted lists / arrays.',
      'Heap of heads; pop/push next; complexity O(N log k).',
      'Example: store (value, listIndex, node).'
    ),
    hard: H(
      'Schedule tasks / rearrange string / frequency constraints.',
      'Max-heap by freq + cooldown queue; or greedy slots.',
      'Example: “task scheduler” with idle counts computed by most frequent.'
    )
  },

  'graph-bfs-dfs': {
    easy: H(
      'Flood fill / islands.',
      'BFS/DFS, mark visited; 4- or 8-neighbors.',
      'Example: count components.'
    ),
    medium: H(
      'Clone graph / shortest unweighted path.',
      'BFS with hash map clone; or BFS layers for shortest hops.',
      'Example: clone neighbors on discovery.'
    ),
    hard: H(
      'Bridges/articulation / SCC.',
      'Tarjan / Kosaraju; lowlink discovery times.',
      'Example: find bridges where low[v] > disc[u].'
    )
  },

  'graph-toposort': {
    easy: H(
      'Course Schedule feasibility.',
      'Detect cycle by DFS (colors) or Kahn’s algorithm.',
      'Example: indegree → queue → pop until empty.'
    ),
    medium: H(
      'Return a valid ordering.',
      'Kahn’s: push indegree 0; pop/build order.',
      'Example: if result size < n → cycle.'
    ),
    hard: H(
      'Multiple valid orders with preferences.',
      'Toposort + tie-breaking (lexicographic) or constraints via DP on DAG.',
      'Example: choose smallest label when multiple zeros.'
    )
  },

  'graph-shortest': {
    easy: H(
      'Weighted positive edges.',
      'Dijkstra with min-heap.',
      'Example: relax neighbors if dist improves.'
    ),
    medium: H(
      'K stops constraint / multi-criteria.',
      'State = (node, stops); BFS-like layering with pruning.',
      'Example: Cheapest Flights Within K Stops.'
    ),
    hard: H(
      'Negative edges / cycles.',
      'Bellman-Ford / SPFA; detect cycle by V-1 relax then one more pass.',
      'Example: early exit when no updates.'
    )
  },

  'dp-classic': {
    easy: H(
      'Coin change (min coins) / simple DP.',
      '1D DP over amount; dp[x] = min(dp[x], dp[x-coin]+1).',
      'Example: amount=11, coins [1,2,5].'
    ),
    medium: H(
      'Edit distance / word break.',
      '2D DP transitions; for word break use dictionary set and cut DP.',
      'Example: Levenshtein transitions (insert/delete/replace).'
    ),
    hard: H(
      'Bitmask DP / knapsack variants.',
      'State compression (mask, i), transitions by toggling bits; prune by dominance.',
      'Example: TSP bitmask DP O(n^2 * 2^n).'
    )
  },

  'n-queens': {
    easy: H(
      'Place n queens no attack.',
      'Backtracking row by row; track cols/diag1/diag2 sets.',
      'Example: put queen, recurse, backtrack.'
    ),
    medium: H(
      'Return boards as strings.',
      'Use arrays; fill \'.\' except queen col.',
      'Example: build on unwind.'
    ),
    hard: H(
      'Optimize pruning.',
      'Use bitmasks for cols/diags; choose row with least candidates.',
      'Example: bit ops to compute available columns quickly.'
    )
  },

  'regex-matching': {
    easy: H(
      'Implement simple wildcard ? *.',
      'Two pointers with backtrack on last *.',
      'Example: ab*cd? matches abZZcdX.'
    ),
    medium: H(
      'Regular expression with . and *.',
      'DP on (i,j): dp[i][j] whether s[0..i) matches p[0..j).',
      'Example: handle p[j-1]=="*" by zero/one-more transitions.'
    ),
    hard: H(
      'Time/space heavy cases.',
      'Greedy for wildcard; for regex DP optimize by skipping impossible segments.',
      'Example: pre-compress pattern like a*b*c*.'
    )
  },

  'lru-lfu': {
    easy: H(
      'LRU cache operations.',
      'HashMap + Doubly Linked List; move node to head on get/put.',
      'Example: evict tail when at capacity.'
    ),
    medium: H(
      'LFU cache.',
      'HashMap + freq buckets; O(1) updates by moving nodes between freq lists.',
      'Example: tie-break by LRU within same freq.'
    ),
    hard: H(
      'Thread-safety / high QPS.',
      'Segmented locks or sharded caches; approximate LFU with counters.',
      'Example: windowed aging to prevent stale hot entries.'
    )
  },

  'hard-strings': {
    easy: H(
      'Basic palindrome partitioning.',
      'DP for palindrome table; then backtrack partitions.',
      'Example: precompute isPal[i][j].'
    ),
    medium: H(
      'Min cuts for palindrome partition.',
      'DP on end index: cuts[j] = min(cuts[i]+1) for pal(i..j).',
      'Example: expand-around-center + DP for O(n^2).'
    ),
    hard: H(
      'Compressed strings / constraints.',
      'Meet-in-the-middle on pal halves; or Manacher + DP when applicable.',
      'Example: treat blocks rather than chars for RLE input.'
    )
  },

  'median-two-arrays': {
    easy: H(
      'Median of two equal-length sorted arrays (intuition).',
      'Think partitions so left size == right size.',
      'Example: merge intuition first.'
    ),
    medium: H(
      'Log-time solution.',
      'Binary search the smaller array’s cut; ensure leftMax ≤ rightMin.',
      'Example: adjust cut by comparing borders.'
    ),
    hard: H(
      'Edge heavy (empty sides / duplicates / wildly uneven).',
      'Careful sentinel values (±∞) and off-by-one around partition.',
      'Example: handle m<<n robustly.'
    )
  },

  'word-ladder': {
    easy: H(
      'Shortest transformation length.',
      'BFS on wildcard buckets (generic states).',
      'Example: hit → hot → dot → dog → cog.'
    ),
    medium: H(
      'Return path(s).',
      'BFS parents, then backtrack to build sequences.',
      'Example: multiple shortest paths.'
    ),
    hard: H(
      'Huge dictionary / memory.',
      'Bidirectional BFS; shrink branching factor with buckets on the fly.',
      'Example: stop when frontiers meet.'
    )
  }
};

// ---- format response as 3 labeled lines
function formatHint(catKey, difficulty = 'medium') {
  const pack =
    (HINTS[catKey] && HINTS[catKey][difficulty]) ||
    (HINTS.fallback && HINTS.fallback[difficulty]) ||
    H('Rephrase the problem.', 'Sketch brute-force then one optimization.', 'Walk a small example.');

  return `Concept: ${pack.c}\nApproach: ${pack.a}\nExample: ${pack.e}`;
}

function pickCategory(titleOrSlug) {
  const s = (titleOrSlug || '').toLowerCase();
  for (const m of CATEGORY_MATCHERS) {
    if (m.rx.test(s)) return m.key;
  }
  return 'fallback';
}

// ---- message handling
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === 'PROBLEM_META') {
    chrome.storage?.local?.set({ lastProblem: msg.payload }, () => {});
    return; // no response
  }

  if (msg.type === 'REQUEST_HINT') {
    const title = msg?.problem?.title || msg?.problem?.slug || '';
    const difficulty = (msg?.difficulty || 'medium').toLowerCase(); // from dropdown
    const cat = pickCategory(title);
    const hint = formatHint(cat, ['easy','medium','hard'].includes(difficulty) ? difficulty : 'medium');
    sendResponse({ hint, category: cat, difficulty });
    return true;
  }
});
