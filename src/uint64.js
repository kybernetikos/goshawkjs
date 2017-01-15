const {binaryToHex, toArrayBuffer} = require('./utils')

/**
 * A representation of a Uint64, since otherwise javascript can't do them.
 */
class Uint64 {
	/**
	 * Makes a new Uint64 from a Uint8Array
	 * @param {Uint8Array} uintArray an array of bytes to be used to represent this 64 bit integer.
	 */
	constructor(uintArray = new Uint8Array(8)) {
		if (uintArray instanceof Uint8Array === false) {
			throw new TypeError("Uint64 source must be a Uint8Array, Uint64.from(bytes), Uint64.fromTypedArray, Uint64.fromArrayBuffer might suit your needs better.")
		}
		/**
		 * @private
		 * @type {Uint8Array}
		 */
		this.data = uintArray

		/**
		 * An arraybuffer representation of this value.
		 * @type {ArrayBuffer}
		 */
		this.buffer = this.data.buffer
	}

	/**
	 * Creates a Uint64 from bytes
	 * @param {number[]} bytes
	 * @returns {Uint64}
	 */
	static from(...bytes) {
		const result = new Uint64()
		result.set(...bytes)
		return result
	}

	/**
	 * Creates a Uint64 from the first 8 bytes of one of the binary forms.
	 * @param {ArrayBuffer|Buffer|TypedArray} binary
	 * @returns {Uint64}
	 */
	static fromBinary(binary) {
		return Uint64.fromArrayBuffer(toArrayBuffer(binary))
	}

	/**
	 * Creates a Uint64 from an array buffer. Potentially with a byte offset.
	 * Only the first 8 bytes will be taken.
	 * @param {ArrayBuffer} arrayBuffer
	 * @param {number} byteOffset the starting position in the array buffer. Defaults to 0.
	 * @returns {Uint64}
	 */
	static fromArrayBuffer(arrayBuffer, byteOffset = 0) {
		return new Uint64(new Uint8Array(arrayBuffer.slice(byteOffset, byteOffset + 8)))
	}

	/**
	 * Modifies this Uint64 to represent the succeeding integer.  If
	 * this represents the largest integer the Uint64 can represent, it will wrap to 0.
	 * @returns {Uint64} this, modified Uint64.
	 */
	inc() {
		for (let idx = this.data.length - 1; idx >= 0; --idx) {
			this.data[idx] += 1
			if (this.data[idx] != 0) {
				break
			}
		}
		return this
	}

	/**
	 * @returns {Uint64} a copy of this Uint64.
	 */
	clone() {
		const dst = new ArrayBuffer(this.data.byteLength)
		const uintArray = new Uint8Array(dst)
		uintArray.set(this.data)
		return new Uint64(uintArray)
	}

	/**
	 * Set the last last bytes.length bytes.
	 * @param {number[]} bytes the bytes to set.
	 */
	set(...bytes) {
		if (bytes[0] instanceof Uint64) {
			this.data.set(bytes[0].data, 0)
		} else {
			for (let i = 0; i < bytes.length; ++i) {
				this.data[this.data.length - bytes.length + i] = bytes[i]
			}
		}
	}

	/**
	 * Returns an array buffer where this Uint64 is the first 8 bytes and
	 * the passed buffer is the subsequent bytes.
	 * @param {ArrayBuffer|Buffer|TypedArray} buffer the subsequent bytes.
	 * @returns {ArrayBuffer}
	 */
	concat(buffer) {
		buffer = toArrayBuffer(buffer)
		const result = new Uint8Array(this.data.length + buffer.byteLength)
		result.set(this.data, 0)
		result.set(new Uint8Array(buffer), this.data.length)
		return result.buffer
	}

	/**
	 * A string representation of this Uint64.  This string representation is for debugging purposes
	 * and does not form part of the public API.
	 */
	toString() {
		return binaryToHex(this.data)
	}
}

module.exports = Uint64