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

	resetCache() {
		this.cache = this.connection.cache.getTemporaryView()
	}

	promoteCache(finalTxnId) {
		this.cache.promote(finalTxnId)
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
			throw new Error("Can only read a Ref")
		}
		const id = ref.varId
		const cacheEntry = this.cache.get(id)
		cacheEntry.write(value, refs)
	}

	create(value, refs) {
		const newId = this.connection.getNewObjectId()
		const cacheEntry = this.cache.get(newId)
		cacheEntry.create(value, refs)
		return new Ref(new Uint8Array(newId), true, true)
	}

	retry() {
		this.shouldRetry = true
		throw new TransactionRetryNeeded("User called retry.")
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