const msgpack = require('../lib/msgpack.min')
const WebSocket = require('ws')

/**
 * The websocket and Msgpack connection.
 * @private
 */
class MsgpackConnection {
	constructor(url, connectionLabel = "") {
		this.url = url
		// connectionLabel is purely used for logging.
		this.connectionLabel = connectionLabel
		this.websocket = null
		this.options = {
			codec: msgpack.createCodec({binarraybuffer: true})
		}
		// all the callbacks!
		this.onOpen = null
		this.onEnd = null
		this.onMessage = null
		this.onClose = null
		this.onError = null
	}

	connect(onMessage, onEnd, onOpen, connectionOptions) {
		this.onMessage = onMessage
		// onEnd triggers onError or onClose.
		this.onEnd = onEnd
		this.onOpen = onOpen
		const websocket = this.websocket = new WebSocket(this.url, undefined, connectionOptions)
		websocket.binaryType = 'arraybuffer'
		websocket.onopen = (evt) => {
			console.debug(`Connection ${this.connectionLabel}: Connection Open`)
			if (this.onOpen) {
				this.onOpen(evt)
			}
		}
		websocket.onclose = (evt) => {
			console.debug(`Connection ${this.connectionLabel}: Connection Closed`, evt.code, evt.reason)
			if (this.onEnd) {
				this.onEnd(evt)
			}
			if (this.onClose) {
				this.onClose(evt)
			}
		}
		websocket.onerror = (evt) => {
			console.error(`Connection ${this.connectionLabel}: Connection Error`, evt.code, evt.reason)
			if (this.onEnd) {
				this.onEnd(evt)
			}
			if (this.onError) {
				this.onError(evt)
			}
		}
		websocket.onmessage = (messageEvent) => {
			const data = msgpack.decode(new Uint8Array(messageEvent.data));
			console.debug(`${this.connectionLabel} <`, data)

			if (this.onMessage) {
				this.onMessage(data)
			}
		}
	}

	send(message) {
		console.debug(`${this.connectionLabel} >`, message)
		this.websocket.send(msgpack.encode(message, this.options))
	}

	// sends a message, and returns a promise which resolves with the next message back from the server. This helps
	// make a request/response pattern easy.  It replaces onMessage and onEnd until it receives the message.
	request(message) {
		const oldHandler = this.onMessage
		const oldEndHandler = this.onEnd
		return new Promise((resolve, reject) => {
			this.onMessage = (msg) => {
				resolve(msg)
				this.onMessage = oldHandler
				this.onEnd = oldEndHandler
			}
			this.onEnd = (evt) => {
				this.onMessage = oldHandler
				this.onEnd = oldEndHandler
				reject(evt)
				if (oldEndHandler) {
					oldEndHandler(evt)
				}
			}
			this.send(message)
		})
	}

	close() {
		this.websocket.close()
	}
}

module.exports = MsgpackConnection