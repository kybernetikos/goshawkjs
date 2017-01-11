const {binaryToHex, toArrayBuffer} = require('./utils')

class Uint64 {
	constructor(uintArray = new Uint8Array(8)) {
		if (uintArray instanceof Uint8Array === false) {
			throw new TypeError("Uint64 source must be a Uint8Array, Uint64.from(bytes), Uint64.fromTypedArray, Uint64.fromArrayBuffer might suit your needs better.")
		}
		this.data = uintArray
		this.buffer = this.data.buffer
	}

	static from(...bytes) {
		const result = new Uint64()
		result.set(...bytes)
		return result
	}

	static fromBinary(binary) {
		return Uint64.fromArrayBuffer(toArrayBuffer(binary))
	}

	static fromArrayBuffer(arrayBuffer, byteOffset = 0) {
		return new Uint64(new Uint8Array(arrayBuffer.slice(byteOffset, byteOffset + 8)))
	}

	inc() {
		for (let idx = this.data.length - 1; idx >= 0; --idx) {
			this.data[idx] += 1
			if (this.data[idx] != 0) {
				break
			}
		}
		return this
	}

	clone() {
		const dst = new ArrayBuffer(this.data.byteLength)
		const uintArray = new Uint8Array(dst)
		uintArray.set(this.data)
		return new Uint64(uintArray)
	}

	set(...bytes) {
		if (bytes[0] instanceof Uint64) {
			this.data.set(bytes[0].data, 0)
		} else {
			for (let i = 0; i < bytes.length; ++i) {
				this.data[this.data.length - bytes.length + i] = bytes[i]
			}
		}
	}

	concat(buffer) {
		if (buffer instanceof ArrayBuffer === false && buffer.buffer instanceof ArrayBuffer) {
			buffer = buffer.buffer
		}
		const result = new Uint8Array(this.data.length + buffer.byteLength)
		result.set(this.data, 0)
		result.set(new Uint8Array(buffer), this.data.length)
		return result.buffer
	}

	toString() {
		return binaryToHex(this.data)
	}
}

module.exports = Uint64