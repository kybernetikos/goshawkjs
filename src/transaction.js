const Ref = require('./ref')
const {TransactionRetryNeeded} = require('./errors')

class Transaction {
	constructor(connection, txnFn, onSuccess, onFail) {
		this.onSuccess = onSuccess;
		this.onFail = onFail;
		this.shouldRetry = false
		this.roots = connection.roots
		this.fn = txnFn
		this.connection = connection
		this.cache = connection.cache.getTemporaryView()
	}

	read(ref) {
		if (ref instanceof Ref == false) {
			throw new Error("Can only read a Ref")
		}
		const id = ref.varId
		const cacheEntry = this.cache.get(id)
		// will need to restrict what can be modified on this by
		// those outside, or clone it or something.
		return cacheEntry.read()
	}

	write(ref, value, refs) {
		if (ref instanceof Ref == false) {
			throw new Error(`Can only write to a Ref, you tried to write to ${ref.toString()}.`)
		}
		if (value instanceof Buffer) {
			value = value.buffer.slice(value.offset, value.offset + value.length)
		}
		if (value instanceof ArrayBuffer === false && value.buffer && value.buffer instanceof ArrayBuffer) {
			value = value.buffer
		}
		const id = ref.varId
		const cacheEntry = this.cache.get(id)
		cacheEntry.write(value, refs)
	}

	create(value, refs) {
		if (value instanceof Buffer) {
			value = value.buffer.slice(value.offset, value.offset + value.length)
		}
		if (value instanceof ArrayBuffer === false && value.buffer && value.buffer instanceof ArrayBuffer) {
			value = value.buffer
		}
		const newId = this.connection.getNewObjectId()
		const cacheEntry = this.cache.get(newId)
		cacheEntry.create(value, refs)
		return new Ref(new Uint8Array(newId), true, true)
	}

	retry() {
		this.shouldRetry = true
		throw new TransactionRetryNeeded("User called retry.")
	}

	transact(fn) {
		return Promise.resolve(fn(this))
	}

	// private API

	resetCache() {
		this.cache = this.connection.cache.getTemporaryView()
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