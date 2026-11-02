/**
 * @description LRU 缓存
 */

export class LRUCache<K, V> {
	private maxSize: number;
	private map: Map<K, V>;
	private onEvict: ((key: K, value: V) => void) | null;
	private weight = 0;

	constructor(
		maxSize: number,
		onEvict: ((key: K, value: V) => void) | null = null,
		private maxWeight = Number.POSITIVE_INFINITY,
		private getWeight: (value: V) => number = () => 1,
	) {
		this.maxSize = maxSize > 0 ? maxSize : 1;
		this.map = new Map<K, V>();
		this.onEvict = onEvict;
	}

	/**
	 * @description 获取一个条目
	 */
	get(key: K): V | undefined {
		const entry = this.map.get(key);
		if (entry) {
			this.map.delete(key);
			this.map.set(key, entry);
		}
		return entry;
	}

	/**
	 * @description 设置一个条目，如果已存在则替换，并尝试驱逐最久未使用的条目
	 */
	set(key: K, value: V) {
		if (this.map.has(key)) {
			const existingEntry = this.map.get(key);
			if (existingEntry) {
				this.weight -= this.getWeight(existingEntry);
				this.onEvict?.(key, existingEntry);
			}
			this.map.delete(key);
		}

		this.map.set(key, value);
		this.weight += this.getWeight(value);

		while (
			this.map.size > this.maxSize ||
			(this.weight > this.maxWeight && this.map.size > 1)
		) {
			this.evict();
		}
	}

	/**
	 * @description 驱逐最久未使用的条目
	 */
	private evict() {
		const oldest = this.map.keys().next();
		if (!oldest.done) {
			const lruKey = oldest.value;
			const lruEntry = this.map.get(lruKey);
			if (lruEntry) {
				this.weight -= this.getWeight(lruEntry);
				this.onEvict?.(lruKey, lruEntry);
			}
			this.map.delete(lruKey);
		}
	}

	/**
	 * @description 清空缓存
	 */
	clear() {
		if (this.onEvict) {
			for (const [key, entry] of this.map.entries()) {
				this.onEvict(key, entry);
			}
		}
		this.map.clear();
		this.weight = 0;
	}
}
