const MsgpackConnection = require('./msgpack-connection')
const Uint64 = require('./uint64')
const Transaction = require('./transaction')
const Ref = require('./ref')
const {TransactionRetryNeeded, TransactionRejectedError} = require('./errors')
const ObjectCache = require('./objectcache')
const {binaryToHex, asPromise} = require('./utils')

let nextConnectionNumber = 0

/**
 * GosConnections represent the connection to the GoshawkDB.
 *
 * They should be acquired through the static {@link Goshawk.connect} function.
 */
class GosConnection {
	/** @private */
	constructor(url) {
		/** @private used in logging to distinguish different connections */
		this.connectionId = (nextConnectionNumber++)
		/** @private */
		this.link = new MsgpackConnection(url, ("000" + this.connectionId).substr(-3))

		/**
		 * The product and version information we sent to the server during the initial connection handshake.
		 * @type {{Product: string, Version: string}}
		 */
		this.clientInfo = {Product: "GoshawkDB", Version: "dev"}

		/**
		 * The product and version information we receive from the server during the initial handshake,
		 * or null if it hasn't occurred yet.
		 * @type {?{Product: string, Version: string}}
		 */
		this.serverInfo = null

		/**
		 * The namespace that the server assigns to this client.
		 * @type {?ArrayBuffer}
		 */
		this.namespace = null

		/**
		 * The roots that this client has access to.
		 * Provided by the server during handshake.
		 * @type {{string: Ref}}
		 */
		this.roots = {}

		/** @private the function to deal with incoming messages */
		this.messageHandler = null
		/** @private the top level cache that stores all the values and refs for objects the client knows about. */
		this.cache = null

		// we control the first 8 bytes of transaction ids and new object ids (used during creation).
		// the namespace is appended to them when actually sent to the server.  We can't use normal js
		// numbers as javascript doesn't support 64 integers.  The only actual operation we need is 'increment'.
		/** @private */
		this.nextTransactionId = Uint64.from(0, 0, 0, 0, 0, 0, 0, 0)

		/** @private the queue of transactions.*/
		this.transactions = []
		/** @private the transaction currently being processed.*/
		this.currentTransaction = null
		/** @private the timeout handle or null if no timeout to process a transaction is waiting*/
		this.scheduledCallback = null
	}

	/**
	 * Connects to the server.  If running in node, you will need to provide connectionOptions that include the client
	 * certificate and key.
	 *
	 * @return {Promise<GosConnection, Error>}
	 */
	connect(connectionOptions) {
		const serverHelloHandler = (message) => {
			// TODO? : a check could go here to ensure that the server version matches our version (from this.clientInfo.Version).
			this.serverInfo = message
			this.messageHandler = rootsHandler
		}

		const rootsHandler = (message) => {
			// populate the roots
			this.roots = {}
			for (const root of message.Roots) {
				this.roots[root.Name] = Ref.fromMessage(root)
			}
			// set the namespace
			this.namespace = message.Namespace

			// now we're properly connected
			this.messageHandler = null
			this.cache = new ObjectCache(this.namespace)
			console.info(`Connection ${this.connectionId}: Connected to goshawk`, this.serverInfo, this.clientInfo, this.namespace, this.roots)
			this._onConnectionNegotiated(this)
		}

		// This promise should resolve with a working, setup connection if the connection makes its way to a fully
		// negotiated connection: i.e. it connects, it swaps info, it loads the roots and the namespace and initialises the
		// relevant state.
		// If anything happens to disrupt this process before it completes, this promise will reject.
		return new Promise((resolve, reject) => {
			this._onConnectionNegotiated = resolve
			this.messageHandler = serverHelloHandler
			this.link.connect(
				// on message
				(data) => {
					if (this.messageHandler) {
						this.messageHandler(data)
					} else {
						console.warn(`Connection ${this.connectionId}: No handler found for message`, data)
					}
				},
				// on end - if the connection stops for any reason (error, or deliberate) before it resolves then it rejects.
				(e) => reject(e),
				// on open we start the handshake by sending the client info.
				() => this.link.send(this.clientInfo),
				connectionOptions
			)
		})
	}

	/**
	 * Queues a transaction for running, then ensures that transaction processing is happening.
	 * The returned promise resolves with the value returned by the fn once the transaction has committed.  The fn may be
	 * run multiple times and so should avoid side effects.
	 * fn may be an asynchronous or a synchronous function.
	 *
	 * @param {function(txn: Transaction): {*|Promise<*, Error>}}} fn the transaction function.  This function may be run multiple times and should rethrow any TransactionRetryNeeded exceptions.
	 * @returns {Promise<*, Error>} a promise that resolves to the result of the transaction function once the transaction submits or an error if it cannot.
 	 */
	transact(fn) {
		if (fn instanceof Function === false) {
			throw new TypeError(`Connection ${this.connectionId}: Transaction argument must be a function, was ${String(fn)}`)
		}

		return new Promise((resolve, reject) => {
			this.transactions.push(new Transaction(fn, {onSuccess: resolve, onFail: reject}, this.roots, this.namespace, this.cache))
			this.scheduleNextTransaction(false)
		})
	}

	/**
	 * Closes the underlying link.
	 */
	close() {
		this.link.close()
	}

	// private api

	/** @private
	 * Actually runs the next queued transaction.
	 */
	executeNextTransaction() {
		if (this.currentTransaction != null) {
			// we're currently processing a transaction, exit without doing anything.
			return
		}

		const currentTransaction = this.currentTransaction = this.transactions.shift()
		const txnIdWithNamespace = this.nextTransactionId.concat(this.namespace)

		const succeed = (finalId, transactionResult) => {
			if (finalId) {
				currentTransaction.promoteCache(finalId)
			}
			currentTransaction.onSuccess(transactionResult)
			this.scheduleNextTransaction(true)
		}
		const retry = () => {
			currentTransaction.reset()
			this.transactions.unshift(currentTransaction)
			this.scheduleNextTransaction(true)
		}
		const fail = (err) => {
			currentTransaction.onFail(err)
			this.scheduleNextTransaction(true)
		}
		const sendTransaction = (result) => {
			const transactionMessage = currentTransaction.toMessage(txnIdWithNamespace)
			if (transactionMessage.ClientTxnSubmission.Actions.length > 0) {
				this.link.request(transactionMessage)
					.then((response) => {
						this.updateFromTransactionResponse(response)
						const outcome = response.ClientTxnOutcome
						if (outcome.Commit) {
							succeed(outcome.FinalId, result)
						} else if (outcome.Error != "") {
							fail(new TransactionRejectedError(outcome.Error))
						} else if (outcome.Abort) {
							retry()
						} else {
							fail("Unknown response message " + JSON.stringify(outcome))
						}
					}).catch(fail)
			} else {
				succeed(undefined, result)
			}
		}

		// we use asPromise, since the result of running fn might be a Promise.
		asPromise(() => {
			return currentTransaction.fn(currentTransaction)
		}).catch( (e) => {
			if (e instanceof TransactionRetryNeeded === false) {
				throw e
			}
		}).then(sendTransaction, fail)
	}

	/** @private
	 * Updates the top level connection cache and counters based on a response from the server.
	 * @param response the msgpack response.
	 */
	updateFromTransactionResponse(response) {
		// Responses contain a final transaction id.  We take the first 8 bytes and increment it.
		this.nextTransactionId = Uint64.fromBinary(response.ClientTxnOutcome.FinalId).inc()
		// If we received an Abort message, then we may also have received some cache update instructions.
		if (response.ClientTxnOutcome.Abort) {
			for (let update of response.ClientTxnOutcome.Abort) {
				const otherTxnId = update.Version.buffer
				for (let action of update.Actions) {
					const id = action.VarId
					if (action.Delete) {
						console.debug(`Connection ${this.connectionId}: Removing ${binaryToHex(id)} from cache.`)
						this.cache.remove(id)
					} else {
						const writeData = action.Write || action.Create
						if (writeData) {
							this.cache.get(id).update(otherTxnId, writeData.Value.buffer, writeData.References.map(Ref.fromMessage))
						}
					}
				}
			}
		}
	}

	/** @private
	 * If there is no transaction currently processing and we haven't scheduled one
	 * and there is a transaction waiting to be processed, then schedule it.
	 * @param {boolean} clearCurrentTransaction if true, this will first clear the current transaction.
	 */
	scheduleNextTransaction(clearCurrentTransaction) {
		if (clearCurrentTransaction) {
			this.currentTransaction = null
		}
		if (this.scheduledCallback == null && this.currentTransaction == null && this.transactions.length > 0) {
			this.scheduledCallback = setTimeout(() => {
				this.scheduledCallback = null
				this.executeNextTransaction()
			}, 0)
		}
	}
}

module.exports = GosConnection