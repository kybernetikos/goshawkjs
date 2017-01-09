const GosConnection = require('./gos-connection')

if (!global.console.debug) {
	global.console.debug = () => {}
}

class Goshawk {
	static connect(url, connectionOptions) {
		return new GosConnection(url).connect(connectionOptions)
	}
}

module.exports = Goshawk