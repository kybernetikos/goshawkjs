const {binaryToHex} = require('./utils')

/**
 * A Ref represents a pointer to an object in the database.
 * Each Ref also carries with it some capabilities that determine
 * which of the actions `read` and `write` can be done with that reference.
 *
 * You can get a Ref either by looking at the roots of the transaction,
 * creating a new object or reading it from an objects references with
 * {@link Transaction#read}.
 */
class Ref {
	/** @private */
	constructor(varId, read, write) {
		if (varId instanceof Uint8Array == false) {
			throw new TypeError("var id must be a uint8 array")
		}

		/**
		 * The goshawkdb id of the object this reference refers to.
		 * @private
		 */
		this.varId = varId

		/**
		 * Whether this reference can be used to read the object.
		 * @type {boolean}
		 */
		this.read = read
		/**
		 * Whether this reference can be used to write the object.
		 * @type {boolean}
		 */
		this.write = write
	}

	/** @private */
	static fromCapRef(capability, varId) {
		return new Ref(varId, capability.Read, capability.Write)
	}

	/** @private */
	static fromMessage(msg) {
		return Ref.fromCapRef(msg.Capability, msg.VarId)
	}

	/**
	 * Checks to see if this reference and the other reference
	 * refer to the same object in the database.
	 * @param {Ref} otherRef
	 * @returns {boolean} true if the other reference points to the same object, false otherwise.
	 */
	sameReferent(otherRef) {
		return binaryToHex(this.varId) === binaryToHex(otherRef.varId)
	}

	/**
	 * @returns {Ref} a new reference the same as this one, but that cannot be used to read.
	 */
	denyRead() {
		return new Ref(this.varId, false, this.write)
	}

	/**
	 * @returns {Ref} a new reference the same as this one, but that cannot be used to write.
	 */
	denyWrite() {
		return new Ref(this.varId, this.read, false)
	}

	/** @returns {string} a representation of this reference.  String representations are for debug only and are not considered part of the public API. */
	toString() {
		return `{Ref ${binaryToHex(this.varId)} ${this.read ? 'r' : '-'}${this.write ? 'w' : '-'}}`
	}

	/** @private */
	toMessage() {
		return {VarId: this.varId.buffer, Capability: {Read: this.read, Write: this.write}}
	}
}

module.exports = Ref