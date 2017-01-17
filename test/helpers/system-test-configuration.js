const fs = require('fs')
const path = require('path')
require('./debug')

const pemSplitRegex = /-----BEGIN ([^-]+)-----\n([^-]+)\n-----END ([^-]+)-----/mg

function loadPem(filePath) {
	const result = {}
	const contents = fs.readFileSync(filePath)
	let match = null
	while ((match = pemSplitRegex.exec(contents)) !== null) {
		if (match[1] !== match[3]) {
			throw new Error(`Begin and end tags did not match: begin=${match[1]} end=${match[3]}`)
		}
		result[match[1]] = match[2]
	}
	return result
}

let clientKeyPath = path.join(__dirname, ".", "user1.pem")
if (process.env.GOSHAWKDB_DEFAULT_CLIENT_KEYPAIR) {
	clientKeyPath = process.env.GOSHAWKDB_DEFAULT_CLIENT_KEYPAIR
}

let clusterHosts = process.env.GOSHAWKDB_DEFAULT_CLUSTER_HOSTS || "localhost:7894;"
const firstHost = clusterHosts.substring(0, clusterHosts.indexOf(':'))

const pemFile = loadPem(clientKeyPath)

module.exports = {
	host: firstHost,
	wssPort: 9999,
	rejectUnauthorized: false,
	cert: `-----BEGIN CERTIFICATE-----\n${pemFile["CERTIFICATE"]}\n-----END CERTIFICATE-----`,
	key: `-----BEGIN EC PRIVATE KEY-----\n${pemFile["EC PRIVATE KEY"]}\n-----END EC PRIVATE KEY-----`
}

console.log("Using client configuration from", clientKeyPath, ":", module.exports)

