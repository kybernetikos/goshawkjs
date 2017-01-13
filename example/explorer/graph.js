const binaryToHex = goshawkjs.binaryToHex

function stringToArrayBuffer(string) {
	return new TextEncoder('utf-8').encode(string).buffer
}

function arrayBufferToString(arraybuffer) {
	return new TextDecoder('utf-8').decode(arraybuffer)
}

function arrayBufferEqual(a1, a2) {
	if (a1.byteLength !== a2.byteLength) {
		return false
	}
	const u1 = new Uint8Array(a1)
	const u2 = new Uint8Array(a2)
	for (let i = 0; i < u1.length; ++i) {
		if (u1[i] != u2[i]) {
			return false
		}
	}
	return true
}

let nodes = new Map()
function getNode(ref) {
	const hashable = binaryToHex(ref.varId)
	if (!nodes.has(hashable)) {
		nodes.set(hashable, {id: hashable, ref: ref})
	}
	return nodes.get(hashable)
}

let edges = new Map()

function visit(txn, ref) {
	const node = getNode(ref)
	if (node.visited) {
		return
	}

	const label = binaryToHex(ref.varId)
	const {value, refs} = txn.read(ref)

	node.value = value
	node.strValue = arrayBufferToString(value)
	node.uintValue = new Uint8Array(value)

	for (let otherRef of refs) {
		const otherLabel = binaryToHex(otherRef.varId)
		addEdge(edges, label, otherLabel)
		visit(txn, otherRef)
	}
	node.visited = true
}

function hasEdge(edges, source, destination) {
	return edges.has(source) &&  edges.get(source).has(destination)
}

function addEdge(edges, source, destination) {
	if (!edges.has(source)) {
		edges.set(source, new Set())
	}
	edges.get(source).add(destination)
}

function removeEdge(edges, source, destination) {
	console.log('trying to remove', source, destination)
	if (edges.has(source)) {
		edges.get(source).delete(destination)
		if (edges.get(source).size === 0) {
			edges.delete(source)
		}
	}
}

function forEachEdge(edges, fn) {
	for (let [source, dests] of edges) {
		for (let dest of dests) {
			fn(source, dest)
		}
	}
}

let lastNodes = new Map()
let lastEdges = new Map()

function traceGraph(render) {
	goshawkjs.connect("wss://localhost:9999/ws").then((connection) => {
		connection.transact((txn) => {
			for (let root in txn.roots) {
				getNode(txn.roots[root]).name = root
				visit(txn, txn.roots[root])
			}

			const changedValues = new Set()
			const addedEdges = new Map(edges)
			const addedNodes = new Set(nodes.keys())
			lastNodes.forEach((value, key) => {
				addedNodes.delete(key)
			})
			const removedEdges = new Map(lastEdges)
			const removedNodes = new Set(lastNodes.keys())
			nodes.forEach((value, key) => {
				removedNodes.delete(key)
			})

			for (let [lastNodeLabel, lastNode] of lastNodes) {
				if (!removedNodes.has(lastNodeLabel)) {
					const newNode = nodes.get(lastNodeLabel)
					if (!arrayBufferEqual(newNode.value, lastNode.value)) {
						changedValues.add(lastNodeLabel)
					}
				}
			}

			forEachEdge(lastEdges, (source, destination) => {
				removeEdge(addedEdges, source, destination)
			})
			forEachEdge(edges, (source, destination) => {
				removeEdge(removedEdges, source, destination)
			})

			render(nodes, edges, addedNodes, removedNodes, addedEdges, removedEdges, changedValues)

			lastNodes = nodes
			lastEdges = edges
			nodes = new Map()
			edges = new Map()

			txn.retry()
		})
	}).catch((err) => {
		console.log("Connection Failed", err)
	})
}
