/**
 * @param {ArrayBuffer|Buffer|TypedArray} binary the binary we want to represent in hex.
 * @returns {string} a hexadecimal representation of this binary.
 */
exports.binaryToHex = function binaryToHex(binary) {
	let uintarray = null
	if (binary instanceof Uint8Array) {
		uintarray = binary
	} else {
		uintarray = new Uint8Array(toArrayBuffer(binary))
	}
	return "0x" + Array.from(uintarray).map((x) => ('0' + x.toString(16)).substr(-2)).join("")
}

/**
 * Tries to convert a binary value into an array buffer.
 * @param {ArrayBuffer|Buffer|TypedArray} value the value to convert.
 * @returns {ArrayBuffer}
 */
exports.toArrayBuffer = function toArrayBuffer(value) {
	if (value instanceof ArrayBuffer) {
		return value
	} else if (value instanceof Buffer) {
		return value.buffer.slice(value.offset, value.offset + value.length)
	} else if (value instanceof ArrayBuffer === false && value.buffer && value.buffer instanceof ArrayBuffer) {
		return value.buffer
	}
	throw new TypeError("Unable to convert value to array buffer " + value)
}

/**
 * Runs the provided function, and wraps the output or thrown error in a promise.
 * This is useful for writing code that deals with functions that may be either syncrhonous or
 * asynchronous.
 * @param {function} fn the function that will be evaluated to populate the promise.
 * @returns {Promise}
 */
exports.asPromise = function asPromise(fn) {
	try {
		return Promise.resolve(fn())
	} catch (e) {
		return Promise.reject(e)
	}
}