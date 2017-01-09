const GosConnection = require('./gos-connection')

class Goshawk {
	static connect(url, connectionOptions) {
		return new GosConnection(url).connect(connectionOptions)
	}
}

module.exports = Goshawk