function stringToArrayBuffer(string) {
	return new TextEncoder('utf-8').encode(string).buffer
}

// This is an unused function that you can execute from the developer console
// if you want to see the data change.
function populate() {
	goshawkjs.connect(`wss://${params.host}:${params.port}/ws`).then((connection) => {
		connection.transact((txn) => {
			const root = txn.roots["myRoot"]
			const o1 = txn.create(stringToArrayBuffer("Hello"), [root])
			const o2 = txn.create(Uint8Array.from([0, 20, 40, 60, 90, 100, 32, 52, 91, 200, 65, 67, 78, 92, 35, 10, 19, 20, 39, 40, 41, 42, 43, 100, 101, 102, 103, 104]), [])
			const o3 = txn.create(stringToArrayBuffer("Maybe"), [o2, o1])
			const o4 = txn.create(stringToArrayBuffer("stuff"), [o3])

			txn.write(root, stringToArrayBuffer("ROOT"), [o4, o1.denyRead()])
		})
	}).catch((err) => {
		console.log("Connection Failed", err)
	})
}

