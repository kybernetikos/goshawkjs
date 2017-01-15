// Adds type name to inherited js errors so they behave more like the built in ones.
exports.Throwable = class Throwable extends Error {
	/** @param {string} message a human readable description of this error. */
	constructor(message) {
		super(message)
		/** the type of this error.
		 * @type {string} */
		this.name = this.constructor.name
		/** human readable description of this error.
		 * @type {string} */
		this.message = message
	}
}

/**
 * Thrown when a transaction should be retried, either because the user called 'retry' or because values are missing.
 */
exports.TransactionRetryNeeded = class TransactionRetryNeeded extends exports.Throwable {}

/**
 * Thrown when a user attempts to modify a value without using the appropriate methods.
 */
exports.MutationNotAllowed = class MutationNotAllowed extends exports.Throwable {}

/**
 * Thrown when a user attempts to read or write with a reference that doesn't allow it.
 */
exports.CapabilityDenied = class CapabilityDenied extends exports.Throwable {}

/**
 * Thrown when the server sends back an error because it was not able to commit the transaction.
 */
exports.TransactionRejectedError = class TransactionRejectedError extends exports.Throwable {}
