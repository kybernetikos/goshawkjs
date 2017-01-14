const nodeSize = 15

const graphics = Viva.Graph.View.svgGraphics()

graphics.node(function(node) {
	let fill = "#00a2e8"
	if (node.data.name) {
		fill = "red"
	}
	let result = Viva.Graph.svg("rect")
		.attr("width", nodeSize)
		.attr("height", nodeSize)
		.attr("fill", fill)

	result.onclick = () => {
		if (selectedNodeId) {
			const nodeUI = graphics.getNodeUI(selectedNodeId);
			if (nodeUI) {
				nodeUI.attr('stroke', 'none');
			}
		}
		selectedNodeId = node.id
		displayInfo()
		const nodeUI = graphics.getNodeUI(node.id);
		if (nodeUI) {
			nodeUI.attr('stroke', 'black');
		}
	}
	return result
}).placeNode(function(nodeUI, pos) {
	nodeUI.attr('x', pos.x - nodeSize / 2).attr('y', pos.y - nodeSize / 2)
})

function createMarker(id, color = 'black') {
	return Viva.Graph.svg('marker')
		.attr('id', id)
		.attr('viewBox', "0 0 10 10")
		.attr('refX', "10")
		.attr('refY', "5")
		.attr('markerUnits', "strokeWidth")
		.attr('markerWidth', "10")
		.attr('markerHeight', "5")
		.attr('orient', "auto")
		.attr('fill', color)
}

const redMarker = createMarker('RedTriangle', 'red')
redMarker.append('path').attr('d', 'M 0 0 L 10 5 L 0 10 z')

const blueMarker = createMarker('BlueTriangle', 'blue')
blueMarker.append('path').attr('d', 'M 0 0 L 10 5 L 0 10 z')

const defs = graphics.getSvgRoot().append('defs')
defs.append(redMarker)
defs.append(blueMarker)

const geom = Viva.Graph.geom()

graphics.link(function(link) {
	let {read, write} = link.data

	return Viva.Graph.svg('path')
		.attr('stroke', "black")
		.attr('stroke-width', "1px")
		.attr('marker-end', read ? 'url(#RedTriangle)' : 'url(#BlueTriangle)')
}).placeLink(function(linkUI, fromPos, toPos, {data:{read,write}}) {
	const toNodeSize = nodeSize + 3, fromNodeSize = nodeSize + 3
	const from = geom.intersectRect(
			fromPos.x - fromNodeSize / 2, // left
			fromPos.y - fromNodeSize / 2, // top
			fromPos.x + fromNodeSize / 2, // right
			fromPos.y + fromNodeSize / 2, // bottom
			fromPos.x, fromPos.y, toPos.x, toPos.y) || fromPos
	const to = geom.intersectRect(
			toPos.x - toNodeSize / 2, // left
			toPos.y - toNodeSize / 2, // top
			toPos.x + toNodeSize / 2, // right
			toPos.y + toNodeSize / 2, // bottom
			toPos.x, toPos.y, fromPos.x, fromPos.y) || toPos
	const data = 'M' + from.x + ',' + from.y + 'L' + to.x + ',' + to.y

	linkUI.attr("d", data)
})

function info(node) {
	const namespace = node.id.substring(18)
	const idV = node.id.substring(2, 18)

	return asElement(`
			<div class="id">
				<span class="rootname">${node.name || ""}</span> <span>${idV}</spanspan>
				<span>${namespace}</span>
			</div>
			Data:
			${toInspection(node.value)}`)
}

function asElement(txt) {
	const result = document.createElement('div')
	result.innerHTML = txt
	return result
}

function byteToHex(byte) {
	return ("0" + byte.toString(16)).substr(-2)
}

function byteToHtml(byte) {
	if (byte >= 32) {
		return `<span class='printable'>${String.fromCharCode(byte)}</span>`
	}
	return `<span class='nonprintable'>.</span>`
}

function toInspection(arrayBuffer) {
	const uintarray = new Uint8Array(arrayBuffer)
	const width = 8
	const lines = []
	let end = 0
	while (end < uintarray.byteLength) {
		const data = Array.from(uintarray.slice(end, end + width))
		const hex = (data.map(byteToHex).join("") + "--".repeat(width)).substring(0, width * 2)
		const chars = data.map(byteToHtml).join("")
		lines.push(`<div><span class="hex">${hex}</span> ${chars}</div>`)
		end = end + width
	}
	return lines.join("")
}
