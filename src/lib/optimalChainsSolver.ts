// src/lib/optimalChainsSolver.ts

export type OptimizationStrategy = "MAX_IMPACT" | "QUALITY_FIRST";

export type ChainCandidate = {
    id: string;
    nodeIds: string[];
    avgPriority: number;
    sumPriority?: number;
    length?: number;
};

function score(chains: ChainCandidate[]) {
    const count = chains.length;
    const sumAvg = chains.reduce((a, c) => a + c.avgPriority, 0);
    const avgOfAvgs = count > 0 ? sumAvg / count : Infinity;
    const sumPriority = chains.reduce((a, c) => a + (c.sumPriority ?? 0), 0);
    return { count, avgOfAvgs, sumPriority };
}

function betterThan(
    a: ChainCandidate[],
    b: ChainCandidate[],
    strategy: OptimizationStrategy
): boolean {
    const sa = score(a);
    const sb = score(b);

    if (strategy === "MAX_IMPACT") {
        if (sa.count !== sb.count) return sa.count > sb.count;
        if (sa.avgOfAvgs !== sb.avgOfAvgs) return sa.avgOfAvgs < sb.avgOfAvgs;
        return sa.sumPriority < sb.sumPriority;
    }

    // QUALITY_FIRST
    if (sa.avgOfAvgs !== sb.avgOfAvgs) return sa.avgOfAvgs < sb.avgOfAvgs;
    if (sa.count !== sb.count) return sa.count > sb.count;
    return sa.sumPriority < sb.sumPriority;
}

export function solveOptimalChains(
    candidates: ChainCandidate[],
    strategy: OptimizationStrategy
) {
    let best: ChainCandidate[] = [];
    let explored = 0;

    const used = new Set<string>();
    const chosen: ChainCandidate[] = [];

    const ordered = [...candidates].sort((a, b) => {
        if ((a.length ?? 0) !== (b.length ?? 0))
            return (a.length ?? 0) - (b.length ?? 0);
        return a.avgPriority - b.avgPriority;
    });

    function canAdd(c: ChainCandidate) {
        return c.nodeIds.every((n) => !used.has(n));
    }
    function add(c: ChainCandidate) {
        c.nodeIds.forEach((n) => used.add(n));
    }
    function remove(c: ChainCandidate) {
        c.nodeIds.forEach((n) => used.delete(n));
    }

    function search(i: number) {
        explored++;

        if (chosen.length + (ordered.length - i) < best.length) return;

        if (i === ordered.length) {
            if (betterThan(chosen, best, strategy)) best = [...chosen];
            return;
        }

        const c = ordered[i];

        if (canAdd(c)) {
            chosen.push(c);
            add(c);
            search(i + 1);
            remove(c);
            chosen.pop();
        }

        search(i + 1);
    }

    search(0);

    return {
        selectedChains: best,
        stats: {
            exploredStates: explored,
            count: best.length,
            avgPriority: score(best).avgOfAvgs,
        },
    };
}
