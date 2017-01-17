const test = require('ava')
const ObjectCache = require('../../src/objectcache')
const Ref = require('../../src/ref')
const {TransactionRetryNeeded} = require("../../src/errors")
const Uint64 = require('../../src/uint64')
const Transaction = require('../../src/transaction')

require('../helpers/debug')

const nullFn = () => {}
const oldNamespace = Uint8Array.from([0, 0, 0, 0, 0,  0,0, 0, 0, 0, 0, 0])
const namespace = Uint8Array.from([0, 0, 0, 0, 0,  0,0, 0, 0, 0, 9, 9])

const id0 = new Uint8Array(Uint64.from(0, 0, 0, 0, 0, 0, 0, 0).concat(oldNamespace))
const id1 = new Uint8Array(Uint64.from(0, 0, 0, 0, 0, 0, 0, 1).concat(oldNamespace))
const id2 = new Uint8Array(Uint64.from(0, 0, 0, 0, 0, 0, 0, 2).concat(oldNamespace))
const id3 = new Uint8Array(Uint64.from(0, 0, 0, 0, 0, 0, 0, 3).concat(oldNamespace))
const id4 = new Uint8Array(Uint64.from(0, 0, 0, 0, 0, 0, 0, 4).concat(oldNamespace))

const ref0 = new Ref(id0, true, true)
const ref1 = new Ref(id1, true, true)
const ref2 = new Ref(id2, true, true)
const ref3 = new Ref(id3, true, true)
const ref4 = new Ref(id4, true, true)

const roots = {"root": ref0}

const nullV = new Uint8Array(Uint64.from(0, 0, 0, 0, 0, 0, 0, 0).concat(namespace))
const v0 = new Uint8Array(Uint64.from(1, 0, 0, 0, 0, 0, 0, 0).concat(oldNamespace))
const v1 = new Uint8Array(Uint64.from(2, 0, 0, 0, 0, 0, 0, 0).concat(oldNamespace))

test("Transaction only sends cache misses if there is a cache miss", (t) => {
	const topLevelCache = new ObjectCache()
	topLevelCache.get(id1).update(v0, new ArrayBuffer(0), [])

	const message = testRunTransaction(topLevelCache, (txn) => {
		txn.create(new ArrayBuffer(3), [])
		txn.read(ref1)
		txn.write(ref2, new ArrayBuffer(4), [])
		txn.read(ref2)
		try {
			txn.read(ref3)
		} catch (e) {}
		try {
			txn.read(ref4)
		} catch (e) {}
	})

	t.deepEqual(message.ClientTxnSubmission.Actions, [
		{
			VarId: id3.buffer,
			Read: { Version: nullV.buffer }
		},
		{
			VarId: id4.buffer,
			Read: { Version: nullV.buffer }
		}
	])
})

test("Transaction only sends reads for retries", (t) => {
	const topLevelCache = new ObjectCache()
	topLevelCache.get(id1).update(v0, new ArrayBuffer(0), [])
	topLevelCache.get(id3).update(v1, new ArrayBuffer(0), [])

	const message = testRunTransaction(topLevelCache, (txn) => {
		txn.create(new ArrayBuffer(3), [])
		txn.read(ref1)
		txn.write(ref2, new ArrayBuffer(4), [])
		txn.read(ref2)
		txn.read(ref3)

		txn.retry()
	})

	t.deepEqual(message.ClientTxnSubmission.Actions, [
		{
			VarId: id1.buffer,
			Read: { Version: v0.buffer }
		},
		{
			VarId: id3.buffer,
			Read: { Version: v1.buffer }
		}
	])
})

function testRunTransaction(topLevelCache, fn) {
	const txn = new Transaction(fn, {onSuccess: nullFn, onFail: nullFn}, roots, namespace, topLevelCache)

	try {
		fn(txn)
	} catch (e) {
		console.log(e.message)
		if (e instanceof TransactionRetryNeeded !== true) {
			throw e
		}
	}

	return txn.toMessage(nullV)
}