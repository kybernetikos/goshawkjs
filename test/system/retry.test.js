const test = require('ava')
const {transactionTest, firstRoot, setupThenTest} = require('../helpers/utils')

test("Retry with value changed by a time", setupThenTest(
	transactionTest((t, connection, txn) => txn.write(firstRoot(txn), Buffer.from([0]), [])),
	transactionTest(async (t, connection, txn) => {
		t.plan(1)
		const {value: valueBuf} = txn.read(firstRoot(txn))
		const value = new Uint8Array(valueBuf)
		if (value[0] < 2) {
			txn.retry()
		}
		t.true(value[0], 2)
	}),
	transactionTest((t, connection, txn) => {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				txn.write(firstRoot(txn), Buffer.from([2]), [])
				resolve()
			}, 2000)
		})
	})
))

function testAndIncrement(number) {
	return (t, connection, txn) => {
		const rootRef = firstRoot(txn)
		const {value: valueBuffer} = txn.read(rootRef)
		const value = new Uint8Array(valueBuffer)
		if (value[0] < number) {
			txn.retry()
		}
		txn.write(rootRef, Buffer.from([number + 1]), [])
	}
}

test("Retry with value changed multiple times by other connections.",
	setupThenTest(
		transactionTest((t, connection, txn) => txn.write(firstRoot(txn), Buffer.from([0]), [])),
		transactionTest((t, connection, txn) => {
			t.plan(1)
			const {value: valueBuf} = txn.read(firstRoot(txn))
			const value = new Uint8Array(valueBuf)
			if (value[0] < 5) {
				txn.retry()
			}
			t.is(value[0], 5)
		}),
		transactionTest(testAndIncrement(0)),
		transactionTest(testAndIncrement(1)),
		transactionTest(testAndIncrement(2)),
		transactionTest(testAndIncrement(3)),
		transactionTest(testAndIncrement(4)),
	)
)
