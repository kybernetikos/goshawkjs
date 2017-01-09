function binaryToHex(arraybuffer) {
	if (arraybuffer instanceof ArrayBuffer) {
		arraybuffer = new Uint8Array(arraybuffer)
	}
	return "0x" + Array.from(arraybuffer).map((x) => ('0' + x.toString(16)).substr(-2)).join("")
}
