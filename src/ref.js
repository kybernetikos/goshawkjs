const {binaryToHex} = require('./utils')

class Ref {
	constructor(/*Uint8Array*/ varId, read, write) {
		if (varId instanceof Uint8Array == false) {
			throw new TypeError("var id must be a uint8 array")
		}
		this.varId = varId
		this.read = read
		this.write = write
	}

	static fromCapRef(capability, varId) {
		return new Ref(varId, capability.Read, capability.Write)
	}

	static fromMessage(msg) {
		return Ref.fromCapRef(msg.Capability, msg.VarId)
	}

	sameReferent(otherRef) {
		return binaryToHex(this.varId) === binaryToHex(otherRef.varId)
	}

	denyRead() {
		return new Ref(this.varId, false, this.write)
	}

	denyWrite() {
		return new Ref(this.varId, this.read, false)
	}

	withCapabilities(read = this.read, write = this.write) {
		if (read && ! this.read) {
			throw new Error("Can't add read permission")
		}
		if (write && ! this.write) {
			throw new Error("Can't add write permission")
		}
		return new Ref(this.varId, read, write)
	}

	toMessage() {
		return {VarId: this.varId.buffer, Capability: {Read: this.read, Write: this.write}}
	}

	toString() {
		return `{Ref ${binaryToHex(this.varId)} ${this.read ? 'r' : '-'}${this.write ? 'w' : '-'}}`
	}
}

module.exports = Ref