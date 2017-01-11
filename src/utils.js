function binaryToHex(binary) {
	let uintarray = null
	if (binary instanceof Uint8Array) {
		uintarray = binary
	} else if (binary instanceof ArrayBuffer) {
		uintarray = new Uint8Array(binary)
	} else if (binary.buffer instanceof ArrayBuffer) {
		uintarray = new Uint8Array(binary.buffer)
	} else {
		throw new TypeError("Unknown binary type : " + binary)
	}
	return "0x" + Array.from(uintarray).map((x) => ('0' + x.toString(16)).substr(-2)).join("")
}

function toArrayBuffer(value) {
	if (value instanceof ArrayBuffer) {
		return value
	} else if (value instanceof Buffer) {
		return value.buffer.slice(value.offset, value.offset + value.length)
	} else if (value instanceof ArrayBuffer === false && value.buffer && value.buffer instanceof ArrayBuffer) {
		return value.buffer
	}
	throw new TypeError("Unable to convert value to array buffer " + value)
}

exports.binaryToHex = binaryToHex
exports.toArrayBuffer = toArrayBuffer