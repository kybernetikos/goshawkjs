global.console.debug = global.console.log

const Goshawk = require('./index.js')
const {binaryToHex} = require('./src/utils')

const connectionOptions = {
	rejectUnauthorized: false,
	cert: `-----BEGIN CERTIFICATE-----
MIIBszCCAVmgAwIBAgIIUHgu22HZLJkwCgYIKoZIzj0EAwIwOjESMBAGA1UEChMJ
R29zaGF3a0RCMSQwIgYDVQQDExtDbHVzdGVyIENBIFJvb3QgQ2VydGlmaWNhdGUw
IBcNMTYxMjE5MTEwMTE4WhgPMjIxNjEyMTkxMTAxMThaMBQxEjAQBgNVBAoTCUdv
c2hhd2tEQjBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABEBLPJry7JgUU4UFyycU
ho0Lut+/eHgo5pBrXP0gsdC52DX3A+dETyRSmilagFrnxxdEUFxEHVF/dMmX4liv
14GjbTBrMA4GA1UdDwEB/wQEAwIHgDATBgNVHSUEDDAKBggrBgEFBQcDAjAMBgNV
HRMBAf8EAjAAMBkGA1UdDgQSBBCbGXFg2f4Hu4302AGGnOs+MBsGA1UdIwQUMBKA
EI4ItnwgV5AGs2bJdVP5os4wCgYIKoZIzj0EAwIDSAAwRQIhANBON8j48On2jd/+
sCzxhdFur/tJqc0CyKQIFXy3zgGmAiBr0VBtKK+OGBxA/QSlqGZGed+udOQ0qHYi
kBqGTwQfvQ==
-----END CERTIFICATE-----`,
	key: `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIF3aJdsPnKsMxpPPa2RFx0R4oFGF4gXYHLsuL62v6L7+oAoGCCqGSM49
AwEHoUQDQgAEQEs8mvLsmBRThQXLJxSGjQu63794eCjmkGtc/SCx0LnYNfcD50RP
JFKaKVqAWufHF0RQXEQdUX90yZfiWK/XgQ==
-----END EC PRIVATE KEY-----`
}

Goshawk.connect("wss://localhost:9999/ws", connectionOptions).then((connection) => {
	connection.transact((txn) => {
		const myRootRef = txn.roots['myRoot']
		const root = txn.read(myRootRef)
		const otherRef = root.refs[1]
		const other = txn.read(otherRef)

		console.log('other', binaryToHex(other.value))
	}).then(
		(x) => console.log('transaction committed', x), (e) => console.log('transaction failed', e)
	)
})
