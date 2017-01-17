const test = require('ava')
const ObjectCache = require('../../src/objectcache')
const Ref = require('../../src/ref')
const {TransactionRetryNeeded, MutationNotAllowed} = require("../../src/errors")
const {asPromise} = require('../../src/utils')
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

const ref0 = new Ref(id0, true, true)
const ref1 = new Ref(id1, true, true)
const ref2 = new Ref(id2, true, true)
const ref3 = new Ref(id3, true, true)

const roots = {"root": ref0}

const nullV = new Uint8Array(Uint64.from(0, 0, 0, 0, 0, 0, 0, 0).concat(namespace))
const v0 = new Uint8Array(Uint64.from(1, 0, 0, 0, 0, 0, 0, 0).concat(oldNamespace))
const v1 = new Uint8Array(Uint64.from(2, 0, 0, 0, 0, 0, 0, 0).concat(oldNamespace))

test("Transaction only sends reads for retries", (t) => {
	const topLevelCache = new ObjectCache()
	topLevelCache.get(id1).update(v0, new ArrayBuffer(0), [])
	topLevelCache.get(id3).update(v1, new ArrayBuffer(0), [])

	function fn(txn) {
		txn.create(new ArrayBuffer(3), [])
		txn.read(ref1)
		txn.write(ref2, new ArrayBuffer(4), [])
		txn.read(ref2)
		txn.read(ref3)

		txn.retry()
	}

	const message = testRunTransaction(fn, topLevelCache)

	console.log(message.ClientTxnSubmission.Actions[0])

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

function testRunTransaction(fn, topLevelCache) {
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