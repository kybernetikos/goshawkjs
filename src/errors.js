// Adds name to inherited js errors
class Throwable extends Error {
	constructor(message) {
		super(message)
		this.name = this.constructor.name
		this.message = message
	}
}

// Thrown when a transaction should be retried
class TransactionRetryNeeded extends Throwable {}
class MutationNotAllowed extends Throwable {}
class CapabilityDenied extends Throwable {}
class TransactionRejectedError extends Throwable {}

exports.CapabilityDenied = CapabilityDenied
exports.MutationNotAllowed = MutationNotAllowed
exports.TransactionRetryNeeded = TransactionRetryNeeded
exports.Throwable = Throwable
exports.TransactionRejectedError = TransactionRejectedError