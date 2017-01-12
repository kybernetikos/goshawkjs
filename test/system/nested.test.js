const test = require('ava')
const {transactionTest, transactionMustFail, firstRoot} = require('../helpers/utils')
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
		txn.transact(async (subTxn) => {
			ref = subTxn.create(Buffer.from("hello"), [])
			throw new Error("What can the matter be?")
		}).catch((e) => {
			console.log(e)
		})

		// this transaction must fail because the object hasn't been created since the child transaction failed.
		const {value} = txn.read(ref)
		t.is(Buffer.from(value).toString(), "hello")
	})
)