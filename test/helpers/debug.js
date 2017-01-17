const util = require('util')

global.console.debug = console.log
if (process.stdout.isTTY) {
	util.inspect.defaultOptions.colors = true
	util.inspect.defaultOptions.depth = 6
	ArrayBuffer.prototype[util.inspect.custom] = function arrayBufferToString(depth, opts) {
		const showBytes = 30
		const arrayBuffer = this
		const firstBit = new Uint8Array(arrayBuffer, 0, Math.min(showBytes, arrayBuffer.byteLength))
		const missingBytes = showBytes < arrayBuffer.byteLength
		const summary = Array.from(firstBit).map((byte) => opts.stylize(("0" + byte.toString(16)).substr(-2), 'number')).join(" ") + (missingBytes ? "..." : "")
		return `ArrayBuffer {length = ${opts.stylize(arrayBuffer.byteLength, 'number')}; content = [ ${summary} ]}`
	}
}