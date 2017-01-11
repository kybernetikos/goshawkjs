const test = require('ava')
const goshawkjs = require('../..')

const connectionOptions = require('../../integration-test-configuration')

function firstRoot(txn) {
	for (let rootName in txn.roots) {
		console.log("Found root", rootName)
		return txn.roots[rootName]
	}
	throw new Error("No roots.")
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
						connection.transact((txn) => {
							test(t, conn, txn)
						})
					}).then(resolve, reject)
				}, reject)
		})
	}
}

test("Capabilities are enforced.",
	setupThenTest(
		(t, connection, txn) => {
			const root = firstRoot(txn)
			const o1 = txn.create(Buffer.from("Hello World"), [])
			txn.write(root, Buffer.from("root obj"), [o1.denyRead(), o1.denyWrite(), o1.denyRead().denyWrite()])
		},
		(t, connection, txn) => {
			const root = firstRoot(txn)
			const {value:rootValue, refs:rootRefs} = txn.read(root)
			const noReadyRef = rootRefs[0]
			const noWriteyRef = rootRefs[1]
			const noAnythingRef = rootRefs[2]

			t.throws(() => txn.read(noReadyRef), goshawkjs.errors.CapabilityDenied)

			const {value:newReadValue, refs: newRefs} = txn.read(noWriteyRef)
			t.true(Buffer.from(newReadValue).toString() === "Hello World")
			t.deepEqual(newRefs, [])
			t.throws(() => txn.write(noWriteyRef, Buffer.from("this shouldn't work"), []), goshawkjs.errors.CapabilityDenied)

			t.throws(() => txn.read(noAnythingRef), goshawkjs.errors.CapabilityDenied)
			t.throws(() => txn.write(noAnythingRef, Buffer.from("this shouldn't work"), []), goshawkjs.errors.CapabilityDenied)
		}
	)
)