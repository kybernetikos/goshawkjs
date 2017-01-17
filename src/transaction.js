const Ref = require('./ref')
const {TransactionRetryNeeded, CapabilityDenied} = require('./errors')
const {toArrayBuffer} = require('./utils')
const Uint64 = require('./uint64')

/** @private */
const nextNewObjectId = Uint64.from(0, 0, 0, 0, 0, 0, 0, 0)

/** @private
 * Gets the object id to use for the next `txn.create` and increments the counter.
 * @returns {Uint8Array}
 */
function getNewObjectId(namespace) {
	const objId = nextNewObjectId.concat(namespace)
	nextNewObjectId.inc()
	return new Uint8Array(objId)
}

/**
 * A transaction represents an attempt to make a modification to the database.
 *
 * The code associated with it may be required to run multiple times before it
 * successfully completes.  Care must be taken to make sure this will not
 * break the client environment.
 *
 * Transactions are acquired by calling {@link Connection#transact}.
 */
class Transaction {

	/** @private */
	constructor(txnFn, {onSuccess, onFail}, roots, namespace, parentCache) {
		/** @private */
		this.onSuccess = onSuccess;

		/** @private */
		this.onFail = onFail;

		/** @private */
		this.shouldRetry = false

		/** @private */
		this.hasCacheMissed = false

		/** @private */
		this.namespace = namespace

		/**
		 * The roots that this client has access to.
		 * @type {{string: Ref}}
		 */
		this.roots = roots

		/** @private */
		this.fn = txnFn

		/** @private */
		this.parentCache = parentCache

		/** @private */
		this.cache = parentCache.getTemporaryView()
	}

	/**
	 * Reads the value and references from an object pointed to by a Ref.
	 * @param {Ref} ref a reference to the object to read from.
	 * @returns {{value:ArrayBuffer, refs:Ref[]}}
	 * @throws {CapabilityDenied} if ref does not have read capability.
	 * @throws {TransactionRetryNeeded} if the object is not in cache. Do not catch this without rethrowing it.
	 */
	read(ref) {
		if (ref instanceof Ref == false) {
			throw new TypeError(`Can only read a reference; you tried to read from ${String(ref)}`)
		}
		if (!ref.read) {
			throw new CapabilityDenied(`Unable to read using reference ${ref.toString()}, as it doesn't allow reads.`)
		}
		const id = ref.varId
		const cacheEntry = this.cache.get(id)
		if (cacheEntry.hasData() === false) {
			this.hasCacheMissed = true
		}
		return cacheEntry.read()
	}

	/**
	 * Changes the value an dreferences of an object pointed to by a Ref.
	 * @param {Ref} ref a reference to the object to be written.
	 * @param {ArrayBuffer|Buffer|TypedArray} value the new value to be stored in the object.
	 * @param {Ref[]} refs the references from this object to other objects.
	 */
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

	/**
	 * Creates a new object and returns the reference to it.
	 * @param {ArrayBuffer|Buffer|TypedArray} value the value that the new object will be created with.
	 * @param {Ref[]} refs the references that the new object will be created with.  This will default to the empty array.
	 * @returns {Ref} a reference to the newly created object.
	 */
	create(value, refs = []) {
		value = toArrayBuffer(value)
		const newId = getNewObjectId(this.namespace)
		const cacheEntry = this.cache.get(newId)
		cacheEntry.create(value, refs)
		return new Ref(new Uint8Array(newId), true, true)
	}

	/**
	 * Stops the current transaction, and waits for any of the values that have been
	 * read to change before rerunning.  No further transactions will be processed while
	 * a transaction is waiting.
	 *
	 * Internally, this method throws a TransactionRetryNeeded error.  If you catch it
	 * and do not rethrow it, you will stop the retry behaviour from working.
	 *
	 * @throws {TransactionRetryNeeded}
	 */
	retry() {
		this.shouldRetry = true
		throw new TransactionRetryNeeded("Transaction code called retry.")
	}

	/**
	 * Runs a nested transaction inside this transaction.
	 *
	 * If a nested transaction fails, its modifications will not be seen by the parent transaction.
	 *
	 * @param {function} fn the transaction function.  This function may be run multiple times and should rethrow any
	 * 							TransactionRetryNeeded exceptions.
	 * @returns {Promise<*, Error>} a promise that resolves to the result of the transaction function once the transaction
	 * 							submits or an error if it cannot.
	 */
	transact(fn) {
		if (fn instanceof Function === false) {
			throw new TypeError("Transaction argument must be a function.")
		}
		// txnFn, {onSuccess, onFail}, roots, namespace, parentCache
		const nestedTransaction = new Transaction(fn, {onSuccess: this.onSuccess, onFail: this.onFail}, this.roots, this.namespace, this.cache)
		let resultPromise = undefined
		try {
			resultPromise = Promise.resolve(fn(nestedTransaction))
		} catch (e) {
			if (e instanceof TransactionRetryNeeded) {
				this.shouldRetry = true
			}
			throw e
		}

		return resultPromise
			.then((result) => {
				nestedTransaction.promoteCache(undefined)
				return result
			})
	}

	// private API

	/** @private
	 * Prepares this transaction to be run again.*/
	reset() {
		this.cache = this.parentCache.getTemporaryView()
		this.shouldRetry = false
		this.hasCacheMissed = false
	}

	/** @private
	 * This transaction has completed successfully, notify the parent.*/
	promoteCache(finalTxnId) {
		this.cache.promote(finalTxnId)
	}

	/** @private */
	toMessage(txnId) {
		const anyChange = (entry) => entry.hasBeenCreated || entry.hasBeenWritten || entry.hasBeenRead
		const justReads = (entry) => entry.hasBeenRead
		const justCacheMisses = (entry) => entry.hasBeenRead && entry.hasData() === false

		let filter = anyChange
		if (this.shouldRetry) {
			filter = justReads
		} else if (this.hasCacheMissed) {
			filter = justCacheMisses
		}

		const actions = this.cache.getActions(this.namespace, filter)
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