const test = require('ava')
const ObjectCache = require('../../src/objectcache')
const Ref = require('../../src/ref')
const {TransactionRetryNeeded, MutationNotAllowed} = require("../../src/errors")

const id1 = new Uint8Array(10)
const testValue = new Uint8Array(5).buffer
const emptyRefs = []
const v0 = new Uint8Array(10)

let cache = null
let view = null
test.beforeEach(() => {
	cache = new ObjectCache()
	view = cache.getTemporaryView()
})

test("ObjectCache#get returns the same cache entry for two uint8arrays of the same value.", (t) => {
	const id2 = new Uint8Array(10)

	const cacheEntry1 = cache.get(id1)
	const cacheEntry2 = cache.get(id2)

	t.true(cacheEntry1 === cacheEntry2)
})

test("ObjectCache#get returns different cache entries for two uint8arrys of different value", (t) => {
	const id2 = new Uint8Array(10)
	id2[0] = 1

	const cacheEntry1 = cache.get(id1)
	const cacheEntry2 = cache.get(id2)

	t.true(cacheEntry1 !== cacheEntry2)
})

test("ObjectCache#getTemporaryView produces a view with its own cache entries.", (t) => {
	const parentCacheEntry = cache.get(id1)
	parentCacheEntry.update(v0, testValue, emptyRefs)

	const viewEntry = view.get(id1)

	// the cache entry from a temporary view and the parent cache are different objects with the same data
	t.true(parentCacheEntry !== viewEntry)
	t.true(viewEntry.id === parentCacheEntry.id)
	t.true(viewEntry.version === parentCacheEntry.version)
	t.true(viewEntry.data.value === parentCacheEntry.data.value)
	t.deepEqual(viewEntry.data.refs, parentCacheEntry.data.refs)

	viewEntry.write(testValue, [new Ref(v0, false, true)])

	// after a write to the cache entry from the temporary view, the parent cache entry does not change
	t.true(viewEntry.id === parentCacheEntry.id)
	t.true(viewEntry.version === parentCacheEntry.version)
	t.true(viewEntry.data.value === parentCacheEntry.data.value)
	t.deepEqual(viewEntry.data.refs, [new Ref(v0, false, true)])
	t.deepEqual(parentCacheEntry.data.refs, [])

	view.promote(v0)

	// after a promote, the parent cache entry does change
	t.deepEqual(parentCacheEntry.data.refs, [new Ref(v0, false, true)])
})

test("ObjectCache#getTemporaryView throws a retry needed transaction if you read a value that hasn't been cached.", (t) => {
	t.throws(() => {
		view.get(id1).read()
	}, TransactionRetryNeeded)
})

test("ObjectCache#getTemporaryView allows reads if the value has been cached, and can produce actions including the recorded read.", (t) => {
	const viewEntry = view.get(id1)
	viewEntry.update(v0, testValue, emptyRefs)

	const {value:readValue, refs:readRefs} = viewEntry.read()
	t.throws(() => {
		readRefs.push("hi")
	}, MutationNotAllowed)
	t.deepEqual(readValue, testValue)
	t.deepEqual(readRefs, emptyRefs)

	const dummyTxnId = new Uint8Array(12)
	const actions = view.getActions(dummyTxnId, (entry) => entry.hasBeenCreated || entry.hasBeenWritten || entry.hasBeenRead)
	t.deepEqual(actions, [{
		VarId: id1.buffer,
		Read: { Version: v0.buffer}
	}])
})