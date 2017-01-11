const Ref = require('./ref')
const {TransactionRetryNeeded, CapabilityDenied} = require('./errors')

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
			throw new TypeError(`Can only read a reference, you tried to read from ${ref.toString()}`)
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
			throw new TypeError(`Can only write to a Ref, you tried to write to ${ref.toString()}.`)
		}
		if (!ref.write) {
			throw new CapabilityDenied(`Unable to write using reference ${ref.toString()}, as it doesn't allow writes.`)
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