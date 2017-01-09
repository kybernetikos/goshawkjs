const assert = require('assert');
const ObjectCache = require('../src/objectcache')
const Ref = require('../src/ref')

describe('ObjectCache', () => {
	const id1 = new Uint8Array(10)
	const testValue = new Uint8Array(5).buffer
	const emptyRefs = []
	const v0 = new Uint8Array(10)

	let cache = null

	beforeEach(() => {
		cache = new ObjectCache()
	})

	describe('#get', () => {
		it('returns the same cache entry for two uint8arrays of the same value.', () => {
			const id2 = new Uint8Array(10)

			const cacheEntry1 = cache.get(id1)
			const cacheEntry2 = cache.get(id2)

			assert(cacheEntry1 === cacheEntry2)
		})

		it('returns different cache entries for two uint8arrays of different value.', () => {
			const id2 = new Uint8Array(10)
			id2[0] = 1

			const cacheEntry1 = cache.get(id1)
			const cacheEntry2 = cache.get(id2)

			assert(cacheEntry1 !== cacheEntry2)
		})
	})

	describe("#getTemporaryView", () => {
		it('produces a view with its own cache entries.', () => {
			const parentCacheEntry = cache.get(id1)
			parentCacheEntry.update(v0, testValue, emptyRefs)

			const view = cache.getTemporaryView()
			const viewEntry = view.get(id1)

			// the cache entry from a temporary view and the parent cache are different objects with the same data
			assert(parentCacheEntry !== viewEntry)
			assert(viewEntry.id === parentCacheEntry.id)
			assert(viewEntry.version === parentCacheEntry.version)
			assert(viewEntry.data.value === parentCacheEntry.data.value)
			assert.deepEqual(viewEntry.data.refs, parentCacheEntry.data.refs)

			viewEntry.write(testValue, [new Ref(v0, false, true)])

			// after a write to the cache entry from the temporary view, the parent cache entry does not change
			assert(viewEntry.id === parentCacheEntry.id)
			assert(viewEntry.version === parentCacheEntry.version)
			assert(viewEntry.data.value === parentCacheEntry.data.value)
			assert.deepEqual(viewEntry.data.refs, [new Ref(v0, false, true)])
			assert.deepEqual(parentCacheEntry.data.refs, [])

			view.promote(v0)

			// after a promote, the parent cache entry does change
			assert.deepEqual(parentCacheEntry.data.refs, [new Ref(v0, false, true)])
		})
	})
})