const msgpack = require('../lib/msgpack.min')
const WebSocket = require('ws')

class MsgpackConnection {
	constructor(url) {
		this.url = url
		this.websocket = null
		this.options = {
			codec: msgpack.createCodec({binarraybuffer: true})
		}
		this.onOpen = null
		this.onEnd = null
		this.onMessage = null
		this.onClose = null
		this.onError = null
	}

	connect(onMessage, onEnd, onOpen, connectionOptions) {
		this.onMessage = onMessage
		this.onEnd = onEnd
		this.onOpen = onOpen

		const websocket = this.websocket = new WebSocket(this.url, undefined, connectionOptions)
		websocket.binaryType = 'arraybuffer'
		websocket.onopen = (evt) => {
			console.debug("Connection Open")
			if (this.onOpen) {
				this.onOpen(evt)
			}
		}
		websocket.onclose = (evt) => {
			console.debug("Connection Closed", evt.code, evt.reason)
			if (this.onEnd) {
				this.onEnd(evt)
			}
			if (this.onClose) {
				this.onClose(evt)
			}
		}
		websocket.onerror = (evt) => {
			console.error("Connection Error", evt.code, evt.reason)
			if (this.onEnd) {
				this.onEnd(evt)
			}
			if (this.onError) {
				this.onError(evt)
			}
		}
		websocket.onmessage = (messageEvent) => {
			const data = msgpack.decode(new Uint8Array(messageEvent.data));
			console.debug("<", data)

			if (this.onMessage) {
				this.onMessage(data)
			}
		}
	}

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
				reject(evt)
				if (oldEndHandler) {
					oldEndHandler(evt)
				}
			}
			this.send(message)
		})
	}

	send(message) {
		console.debug(">", message)
		this.websocket.send(msgpack.encode(message, this.options))
	}

	close() {
		this.websocket.close()
	}
}

module.exports = MsgpackConnection