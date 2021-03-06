const {binaryToHex, toArrayBuffer} = require('./utils')
const {TransactionRetryNeeded, MutationNotAllowed} = require('./errors')
const Uint64 = require('./uint64')
const Ref = require('./ref')

function checkRefs(refs) {
	for (let i = 0; i < refs.length; ++i) {
		const ref = refs[i]
		if (ref instanceof Ref === false) {
			throw new TypeError(`Reference ${i} was not of reference type - was a ${ref.constructor.name} : ${ref.toString()}`)
		}
	}
}

/**
 * The top level object cache. It keeps objects value and refs stored against their id.
 * @private
 */
class ObjectCache {
	constructor() {
		this.objects = new Map()
	}

	get(id) {
		const hashable = binaryToHex(id)
		if (!this.objects.has(hashable)) {
			this.objects.set(hashable, new ObjectCacheEntry(id))
		}
		return this.objects.get(hashable)
	}

	remove(id) {
		const hashable = binaryToHex(id)
		if (!this.objects.has(hashable)) {
			throw new Error(`Unexpected remove of id ${hashable}`)
		}
		this.objects.delete(hashable)
	}

	getTemporaryView() {
		return new CopyCache(this)
	}
}

module.exports = ObjectCache

// An ObjectCacheEntry represents the clients knowledge about a GoshawkDB Object.
//  - It should always have an id.
//  - If it contains values known to have been in the database (either they have been sent in a cache update, or a
//    create/write that has been acknowledged.  The values version and data.value and data.refs will be set.
//	- data.refs and data.value will be set after a write or create.
class ObjectCacheEntry {
	constructor(id) {
		if (id instanceof Uint8Array == false) {
			throw new TypeError(`id must be a uint8, was ${String(id)}`)
		}
		this.id = id

		this.version = null
		this.data = {
			value: null,
			refs: null
		}

		// best effort attempt to restrict mutations in the data I return to the user.
		this.readOnlyData = Object.create({}, {
				value: {
					set: () => {
						throw new MutationNotAllowed("Cannot set value without a transaction.write call.")
					},
					get: () => {
						return this.data.value
					}
				},
				refs: {
					set: () => {
						throw new MutationNotAllowed("Cannot set references without a transaction.write call.")
					},
					get: () => {
						const srcRefs = this.data.refs
						if (global.Proxy) {
							return new Proxy(srcRefs, {
								set: () => {
									throw new MutationNotAllowed("Cannot change references without a transaction.write call.")
								}
							})
						} else {
							return srcRefs.slice()
						}
					}
				},
				version: {
					set: () => {
						throw new MutationNotAllowed("Cannot set references without a transaction.write call.")
					},
					get: () => {
						return this.version
					}
				}
			})

		// Record which actions have occurred on this object from the client.
		// These are only needed on objects within a transactions cache, not at the top level.
		//  - If something has been written or created, calling read on it has no effect (it is answered from cache).
		//  - If something has been created, calling write on it has no effect (the create is merely updated to the contents of the write).
		this.hasBeenWritten = false
		this.hasBeenRead = false
		this.hasBeenCreated = false
	}

	// Updates representing version, value and refs are they are in the remote database.  Can populate on an abort or a submit.
	update(version, value, refs) {
		value = toArrayBuffer(value)
		checkRefs(refs)
		this.data.value = value
		this.data.refs = refs
		this.version = toArrayBuffer(version)
	}

	read() {
		if (!this.hasBeenWritten && !this.hasBeenCreated) {
			this.hasBeenRead = true
		}
		if (this.hasData()) {
			return this.readOnlyData
		}

		throw new TransactionRetryNeeded(`Object ${binaryToHex(this.id)} not present in cache`)
	}

	write(value, refs) {
		value = toArrayBuffer(value)
		checkRefs(refs)
		if (!this.hasBeenCreated) {
			this.hasBeenWritten = true
		}
		this.data.value = value
		this.data.refs = refs
	}

	hasData() {
		return this.hasBeenCreated || this.hasBeenWritten || this.version != null
	}

	create(value, refs) {
		if (value instanceof ArrayBuffer != true) {
			throw new TypeError("values should be array buffers : " + value)
		}
		checkRefs(refs)
		this.hasBeenCreated = true
		this.data.value = value
		this.data.refs = refs
	}

	clone() {
		return new ObjectCacheEntry(this.id).copyFrom(this)
	}

	copyFrom(otherEntry) {
		this.version = otherEntry.version
		this.data.value = otherEntry.data.value
		this.data.refs = otherEntry.data.refs
		this.hasBeenRead = otherEntry.hasBeenRead
		this.hasBeenWritten = otherEntry.hasBeenWritten
		this.hasBeenCreated = otherEntry.hasBeenCreated
		return this
	}

	toAction(initialVersion) {
		const result = {
			VarId: this.id.buffer,
		}
		const refMessages = this.data.refs ? this.data.refs.map((ref) => ref.toMessage()) : []

		if (this.hasBeenRead && !this.hasBeenWritten) {
			result.Read = {Version: this.version || initialVersion}
		} else if (this.hasBeenWritten && !this.hasBeenRead) {
			result.Write = {Value: this.data.value, References: refMessages}
		} else if (this.hasBeenWritten && this.hasBeenRead) {
			result.ReadWrite = {Version: this.version, Value: this.data.value, References: refMessages}
		} else if (this.hasBeenCreated) {
			result.Create = {Value: this.data.value, References: refMessages}
		} else {
			throw new Error(`No read or write has occurred on object ${this.id}, cannot form an action.`)
		}
		return result
	}
}

class CopyCache {
	constructor(parentCache) {
		this.parentCache = parentCache
		this.objects = new Map()
	}

	get(id) {
		const hashable = binaryToHex(id)
		if (!this.objects.has(hashable)) {
			this.objects.set(hashable, this.parentCache.get(id).clone())
		}
		return this.objects.get(hashable)
	}

	promote(finalTxnId) {
		for (let [, entry] of this.objects) {
			const parentEntry = this.parentCache.get(entry.id)
			if (finalTxnId) {
				// if we are given a transaction id, then this promotion should be treated like a cache update from the server.
				if (entry.hasBeenCreated || entry.hasBeenWritten) {
					parentEntry.update(finalTxnId, entry.data.value, entry.data.refs)
				}
			} else {
				// otherwise, it's a nested transaction completing, so we do a full copy into the parent.
				parentEntry.copyFrom(entry)
			}
		}
	}

	// Returns an array of all the actions that have occurred on this cache.
	getActions(namespace, cacheEntryFilter) {
		const actions = []
		// the version to ask for if we don't currently have any data in the cache for an object.
		const initialVersion = Uint64.from(0, 0, 0, 0, 0, 0, 0, 0).concat(namespace)

		for (let [,cacheEntry] of this.objects) {
			if (cacheEntryFilter(cacheEntry)) {
				actions.push(cacheEntry.toAction(initialVersion))
			}
		}

		return actions
	}

	getTemporaryView() {
		return new CopyCache(this)
	}
}