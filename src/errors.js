//Improves the inheritability of js errors
class Throwable extends Error {
	constructor(message) {
		super(message)
		this.name = this.constructor.name
		this.message = message
	}
}

// Thrown when a transaction should be retried
class TransactionRetryNeeded extends Throwable {}