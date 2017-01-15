const test = require('ava')
const {transactionTest, transactionMustFail, firstRoot, all, setupThenTest} = require('../helpers/utils')
const {TransactionRejectedError} = require('../../src/errors')

test("Nested transactions can provide values that their parents use.",
	transactionTest(async (t, connection, txn) => {
			const expected = await txn.transact((subTxn) => {
				const magicNumber = Math.floor(Math.random() * 255)
				const root = firstRoot(subTxn)
				const o1 = subTxn.create(Buffer.from([magicNumber]), [])
				subTxn.write(root, Buffer.from("root obj"), [o1])
				return magicNumber
			})

			const root = firstRoot(txn)
			const {refs:[createdObjectRef]} = txn.read(root)
			const {value} = txn.read(createdObjectRef)

			t.is(new Uint8Array(value)[0], expected)
		})
)

test("Nested transactions can throw errors and not affect their parent.",
	transactionMustFail(TransactionRejectedError, async (t, connection, txn) => {
		let ref = null
		await txn.transact(async (subTxn) => {
			ref = subTxn.create(Buffer.from("hello"), [])
			throw new Error("What can the matter be?")
		}).catch((e) => {
			console.log(e.message)
		})

		// this transaction must fail because the object hasn't been created since the child transaction failed.
		const {value} = txn.read(ref)
	})
)

test("Nested transactions can create objects that their parents can use.", transactionTest(async (t, connection, txn) => {
	let ref = await txn.transact(async (subTxn) => {
		return subTxn.create(Buffer.from("hello"), [])
	})

	const {value} = txn.read(ref)
	t.is(Buffer.from(value).toString(), "hello")
}))


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

test("Nested transactions can retry.",
	setupThenTest(
		transactionTest((t, connection, txn) => txn.write(firstRoot(txn), Buffer.from([0]), [])),
		transactionTest((t, connection, txn) => {
			t.plan(1)
			txn.transact((subTxn) => {
				const {value: valueBuf} = txn.read(firstRoot(txn))
				const value = new Uint8Array(valueBuf)
				if (value[0] < 5) {
					subTxn.retry()
				}
			})
			const {value: valueBuf} = txn.read(firstRoot(txn))
			const value = new Uint8Array(valueBuf)
			t.is(value[0], 5)
		}),
		transactionTest(testAndIncrement(0)),
		transactionTest(testAndIncrement(1)),
		transactionTest(testAndIncrement(2)),
		transactionTest(testAndIncrement(3)),
		transactionTest(testAndIncrement(4)),
	)
)
