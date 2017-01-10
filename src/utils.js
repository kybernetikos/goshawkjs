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

exports.binaryToHex = binaryToHex