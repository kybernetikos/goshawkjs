class Util {
	static binaryToHex(binary) {
		return goshawkdb.binaryToHex(binary)
	}

	static arrayBufferEqual(a1, a2) {
		if (a1 === null && a2 !== null) {
			return true
		}
		if (a1 !== null && a2 === null) {
			return true
		}
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

	static removeEdge(edges, source, destination) {
		if (edges.has(source)) {
			edges.get(source).delete(destination)
			if (edges.get(source).size === 0) {
				edges.delete(source)
			}
		}
	}

	static forEachEdge(edges, fn) {
		for (let [source, dests] of edges) {
			for (let [dest, data] of dests) {
				fn(source, dest, data)
			}
		}
	}

	static nodeEqual(node1, node2) {
		if (!Util.arrayBufferEqual(node1.value, node2.value)) {
			return false
		}
		if (node1.read !== node2.read || node1.write !== node2.write || node1.name !== node2.name) {
			return false
		}
		return true
	}
}

class DataGraph {
	constructor() {
		this.nodes = new Map()
		this.edges = new Map()
	}

	getNode(ref) {
		const hashable = Util.binaryToHex(ref.varId)
		if (!this.nodes.has(hashable)) {
			this.nodes.set(hashable, {id: hashable, write: ref.write, read: ref.read, visited: false, value: null})
		} else {
			const data = this.nodes.get(hashable)
			data.read = data.read  || ref.read
			data.write = data.write || ref.write
		}
		return this.nodes.get(hashable)
	}

	addEdge(source, destination, read, write) {
		if (!this.edges.has(source)) {
			this.edges.set(source, new Map())
		}
		this.edges.get(source).set(destination, {read, write})
	}

	diff(previousGraph) {
		// current nodes - last nodes
		const addedNodes = new Set(this.nodes.keys())
		previousGraph.nodes.forEach((value, key) => {
			addedNodes.delete(key)
		})

		// last nodes - current nodes
		const removedNodes = new Set(previousGraph.nodes.keys())
		this.nodes.forEach((value, key) => {
			removedNodes.delete(key)
		})

		// nodes we used to have that weren't removed that are different now
		const changedValues = new Set()
		for (let [lastNodeLabel, lastNode] of previousGraph.nodes) {
			if (!removedNodes.has(lastNodeLabel)) {
				const newNode = this.nodes.get(lastNodeLabel)
				if (!Util.nodeEqual(newNode, lastNode)) {
					changedValues.add(lastNodeLabel)
				}
			}
		}

		// all the new nodes - the old nodes
		const addedEdges = new Map(this.edges)
		Util.forEachEdge(previousGraph.edges, (source, destination, data) => {
			Util.removeEdge(addedEdges, source, destination)
		})

		// old nodes - all the new nodes
		const removedEdges = new Map(previousGraph.edges)
		Util.forEachEdge(this.edges, (source, destination, data) => {
			Util.removeEdge(removedEdges, source, destination)
		})

		return {
			graph: this,
			previousGraph,
			addedNodes, removedNodes,
			changedValues,
			addedEdges, removedEdges
		}
	}

	visit(txn, ref) {
		const node = this.getNode(ref)
		if (node.visited) {
			return
		}
		if (ref.read) {
			const {value, refs} = txn.read(ref)
			node.value = value
			node.visited = true

			for (let otherRef of refs) {
				const otherLabel = Util.binaryToHex(otherRef.varId)
				this.addEdge(node.id, otherLabel, otherRef.read, otherRef.write)
				this.visit(txn, otherRef)
			}
		}
	}
}