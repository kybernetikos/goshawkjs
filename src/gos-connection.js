const MsgpackConnection = require('./msgpack-connection')
const Uint64 = require('./uint64')
const Transaction = require('./transaction')
const Ref = require('./ref')
const {TransactionRetryNeeded} = require('./errors')
const ObjectCache = require('./objectcache')
const {binaryToHex} = require('./utils')

class GosConnection {
	constructor(url) {
		this.link = new MsgpackConnection(url)
		this.messageHandler = null
		this.serverInfo = null
		this.clientInfo = {Product: "GoshawkDB", Version: "dev"}
		this.roots = {}
		this.namespace = null
		this.nextTransactionId = Uint64.from(0, 0, 0, 0, 0, 0, 0, 0)
		this.nextNewObjectId = Uint64.from(0, 0, 0, 0, 0, 0, 0, 0)
		this.transactions = []
		this.currentTransaction = null
		this.cache = null
		this.scheduledCallback = null
		this.inTxnCode = false
	}

	transact(fn) {
		if (fn instanceof Function === false) {
			throw new TypeError("Transaction argument must be a function.")
		}

		if (this.inTxnCode) {
			return this.currentTransaction.transact(fn)
		}

		return new Promise((resolve, reject) => {
			this.transactions.push(new Transaction(this, fn, resolve, reject, this.cache, this.namespace))
			this.scheduleNextTransaction()
		})
	}

	connect(connectionOptions) {
		const serverHelloHandler = (message) => {
			this.serverInfo = message
			this.messageHandler = rootsHandler
		}

		const rootsHandler = (message) => {
			this.roots = {}
			for (const root of message.Roots) {
				console.info(root, message.Roots)
				this.roots[root.Name] = Ref.fromMessage(root)
			}
			this.namespace = message.Namespace
			this.cache = new ObjectCache(this.namespace)
			this.messageHandler = null
			console.info('Connected to goshawk', this.serverInfo, this.clientInfo, this.namespace, this.roots)
			this._onConnectionNegotiated(this)
		}

		return new Promise((resolve, reject) => {
			this._onConnectionNegotiated = resolve
			this.messageHandler = serverHelloHandler

			this.link.connect((data) => {
					if (this.messageHandler) {
						this.messageHandler(data)
					} else {
						console.warn("No handler found for message", data)
					}
				},
				reject,
				() => this.link.send(this.clientInfo),
				connectionOptions
			)
		})
	}

	close() {
		this.link.close()
	}

	// private api

	getNewObjectId() {
		const objId = this.nextNewObjectId.concat(this.namespace)
		this.nextNewObjectId.inc()
		return new Uint8Array(objId)
	}

	executeNextTransaction() {
		if (this.currentTransaction != null) {
			return
		}
		const currentTransaction = this.currentTransaction = this.transactions.shift()

		const succeed = (finalId, transactionResult) => {
			currentTransaction.promoteCache(finalId)
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

		const txnIdWithNamespace = this.nextTransactionId.concat(this.namespace)
		let transactionResult = null
		try {
			this.inTxnCode = true
			transactionResult = currentTransaction.fn(currentTransaction)
			this.inTxnCode = false
		} catch (e) {
			this.inTxnCode = false
			if (e instanceof TransactionRetryNeeded === false) {
				fail(e)
				return
			}
		}

		this.link.request(currentTransaction.toMessage(txnIdWithNamespace))
			.then((response) => {
				this.updateFromTransactionResponse(response)
				const outcome = response.ClientTxnOutcome
				if (outcome.Commit) {
					succeed(outcome.FinalId, transactionResult)
				} else if (outcome.Error != "") {
					fail(outcome.Error)
				} else if (outcome.Abort) {
					retry()
				} else {
					fail("Unknown response message " + JSON.stringify(outcome))
				}
			}).catch(fail)
	}

	updateFromTransactionResponse(response) {
		this.nextTransactionId = Uint64.fromBinary(response.ClientTxnOutcome.FinalId).inc()
		if (response.ClientTxnOutcome.Abort) {
			for (let update of response.ClientTxnOutcome.Abort) {
				const otherTxnId = update.Version.buffer
				for (let action of update.Actions) {
					const id = action.VarId
					if (action.Delete) {
						console.debug(`Removing ${binaryToHex(id)} from cache.`)
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