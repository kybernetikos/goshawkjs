const GosConnection = require('./gos-connection')

// Ensure that all our calls to console.debug don't cause errors.
if (!global.console.debug) {
	global.console.debug = () => {}
}

/**
 * Goshawkdb client.
 */
module.exports = class Goshawk {
	/**
	 * Connects to the websocket port of a goshawkdb server.
	 * See the [goshawkdb documentation](https://goshawkdb.io/documentation.html) for more information.
	 *
	 * @param {string} url the url of the websocket endpoint. e.g. wss://localhost:9999/ws
	 * @param {*} connectionOptions in node.js, the connection options are used to make the connection.
	 * 				They are for the WS module and are defined [here](https://github.com/websockets/ws/blob/master/doc/ws.md).
	 * 				The options should include `key`, `cert` and if you don't want it to check
	 * 				the server certificates, `{rejectUnauthorized: false}`.
	 * @return {Promise<GosConnection, Error>} A promise that resolves with a connection or rejects with an error.
	 */
	static connect(url, connectionOptions) {
		return new GosConnection(url).connect(connectionOptions)
	}
}