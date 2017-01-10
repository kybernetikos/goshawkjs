const assert = require('assert');
const ObjectCache = require('../src/objectcache')
const Ref = require('../src/ref')
const {TransactionRetryNeeded, MutationNotAllowed} = require("../src/errors")
const {describe, beforeEach, it} = require("mocha")

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

		let view = null

		beforeEach(() => {
			view = cache.getTemporaryView()
		})

		it('produces a view with its own cache entries.', () => {
			const parentCacheEntry = cache.get(id1)
			parentCacheEntry.update(v0, testValue, emptyRefs)

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

		it("throws a transaction retry needed if you read a value that hasn't been cached", () => {
			assertThrows(TransactionRetryNeeded, () => {
				view.get(id1).read()
			})
		})

		it("allows reads if the value has been cached, and can produce actions including the recorded read.", () => {
			const viewEntry = view.get(id1)
			viewEntry.update(v0, testValue, emptyRefs)

			const {value:readValue, refs:readRefs} = viewEntry.read()
			assertThrows(MutationNotAllowed, () => {
				readRefs.push("hi")
			})
			assert.deepEqual(readValue, testValue)
			assert.deepEqual(readRefs, emptyRefs)

			const dummyTxnId = new Uint8Array(12)
			const actions = view.getActions(dummyTxnId)
			assert.deepEqual(actions, [{
				VarId: id1.buffer,
				Read: { Version: v0}
			}])
		})
	})
})

function assertThrows(exceptionClass, codeBlock) {
	try {
		codeBlock()
		throw new Error(`Block should have thrown a ${exceptionClass.name} exception but did not, in\n\t${codeBlock.toString()}`)
	} catch (e) {
		if (e instanceof exceptionClass === false) {
			throw e
		}
	}
}