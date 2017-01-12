const Ref = require('./ref')
const {TransactionRetryNeeded, CapabilityDenied} = require('./errors')
const {toArrayBuffer} = require('./utils')

class Transaction {
	constructor(connection, txnFn, onSuccess, onFail, parentCache) {
		this.onSuccess = onSuccess;
		this.onFail = onFail;
		this.shouldRetry = false
		this.roots = connection.roots
		this.fn = txnFn
		this.connection = connection
		this.parentCache = parentCache
		this.cache = parentCache.getTemporaryView()
	}

	read(ref) {
		if (ref instanceof Ref == false) {
			throw new TypeError(`Can only read a reference; you tried to read from ${String(ref)}`)
		}
		if (!ref.read) {
			throw new CapabilityDenied(`Unable to read using reference ${ref.toString()}, as it doesn't allow reads.`)
		}
		const id = ref.varId
		const cacheEntry = this.cache.get(id)
		return cacheEntry.read()
	}

	write(ref, value, refs) {
		if (ref instanceof Ref == false) {
			throw new TypeError(`Can only write with a reference; you tried to write to ${String(ref)}.`)
		}
		if (!ref.write) {
			throw new CapabilityDenied(`Unable to write using reference ${ref.toString()}, as it doesn't allow writes.`)
		}
		value = toArrayBuffer(value)
		const id = ref.varId
		const cacheEntry = this.cache.get(id)
		cacheEntry.write(value, refs)
	}

	create(value, refs) {
		value = toArrayBuffer(value)
		const newId = this.connection.getNewObjectId()
		const cacheEntry = this.cache.get(newId)
		cacheEntry.create(value, refs)
		return new Ref(new Uint8Array(newId), true, true)
	}

	retry() {
		this.shouldRetry = true
		throw new TransactionRetryNeeded("Transaction code called retry.")
	}

	transact(fn) {
		if (fn instanceof Function === false) {
			throw new TypeError("Transaction argument must be a function.")
		}
		const nestedTransaction = new Transaction(this.connection, fn, this.onSuccess, this.onFail, this.cache)
		this.connection.currentTransaction = nestedTransaction
		let resultPromise = undefined
		try {
			resultPromise = Promise.resolve(fn(nestedTransaction))
		} catch (e) {
			if (e instanceof TransactionRetryNeeded) {
				this.shouldRetry = true
			}
			this.connection.currentTransaction = this
			throw e
		}

		return resultPromise
			.then((result) => {
				this.connection.currentTransaction = this
				nestedTransaction.promoteCache(undefined)
				return result
			})
	}

	// private API

	reset() {
		this.cache = this.parentCache.getTemporaryView()
		this.shouldRetry = false
	}

	promoteCache(finalTxnId) {
		this.cache.promote(finalTxnId)
	}

	toMessage(txnId) {
		const actions = this.cache.getActions(this.connection.namespace)
		return {
			ClientTxnSubmission: {
				Id: txnId,
				Retry: this.shouldRetry,
				Actions: actions
			}
		}
	}
}

module.exports = Transaction