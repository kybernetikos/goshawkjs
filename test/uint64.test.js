const test = require('ava')
const Uint64 = require('../src/uint64')

test("Check that I can increment a Uint64 loaded from a buffer", (t) => {
	const a = Uint64.fromBinary(new Buffer([0, 0, 0, 0, 0, 0, 0, 4]))
	a.inc()

	t.true(a.data[7] === 5)
})

test("Check that a uint64 has a .buffer of the right length even if instantiated from a larger buffer", (t) => {
	const a = Uint64.fromBinary(new Buffer([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]))

	t.true(a.buffer.byteLength === 8)
	t.true(a.data[0] === 1)
})