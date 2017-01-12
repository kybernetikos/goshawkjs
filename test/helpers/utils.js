const connectionOptions = require('./system-test-configuration')
const goshawkjs = require('../..')

function firstRoot(txn) {
	for (let rootName in txn.roots) {
		console.log("Found root", rootName)
		return txn.roots[rootName]
	}
	throw new Error("No roots.")
}

function transactionMustFail(error, test) {
	return (t) => {
		return new Promise((resolve, reject) => {
			goshawkjs
				.connect(`wss://${connectionOptions.host}:${connectionOptions.wssPort}/ws`, connectionOptions)
				.then((conn) => {
					return conn.transact((txn) => {
						return test(t, conn, txn)
					}).then(reject, (err) => {
						if (err instanceof error) {
							resolve()
						} else {
							reject(err)
						}
					})
				}).catch(reject)
		})
	}
}

function transactionTest(test) {
	return (t) => {
		return new Promise((resolve, reject) => {
			goshawkjs
				.connect(`wss://${connectionOptions.host}:${connectionOptions.wssPort}/ws`, connectionOptions)
				.then((conn) => {
					return conn.transact((txn) => {
						test(t, conn, txn)
					})
				}).then(resolve, reject)
		})
	}
}

function setupThenTest(setup, test) {
	return (t) => {
		return new Promise((resolve, reject) => {
			let connection = null
			goshawkjs
				.connect(`wss://${connectionOptions.host}:${connectionOptions.wssPort}/ws`, connectionOptions)
				.then((conn) => {
					connection = conn
					connection.transact((txn) => {
						setup(t, conn, txn)
					}).then(() => {
						return connection.transact((txn) => {
							return test(t, conn, txn)
						})
					}, reject).then(resolve, reject)
				}, reject)
		})
	}
}

exports.connectionOptions = connectionOptions
exports.setupThenTest = setupThenTest
exports.firstRoot = firstRoot
exports.transactionTest = transactionTest
exports.transactionMustFail = transactionMustFail