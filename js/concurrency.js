/**
 * CONCURRENCY HELPERS (concurrency.js)
 */

/**
 * Runs `worker` over `items` with at most `limit` calls in flight, starting the
 * next item as soon as any call finishes (no waiting on whole batches).
 * @template T, R
 * @param {T[]} items
 * @param {number} limit - Maximum concurrent calls (>= 1).
 * @param {function(T, number): Promise<R>} worker
 * @returns {Promise<R[]>} Results in input order.
 */
export async function mapWithConcurrency(items, limit, worker) {
    const results = new Array(items.length);
    let nextIndex = 0;

    const run = async () => {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            results[index] = await worker(items[index], index);
        }
    };

    await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, run));
    return results;
}
