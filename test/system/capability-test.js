const test = require('ava')
const goshawkjs = require('../..')
const {setupThenTest, firstRoot} = require('../helpers/utils')

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