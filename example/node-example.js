/*
 * This example connects to a goshawk wssPort running on localhost:7895 and reads the value of the 'myRoot' root.
 * Then it overwrites the value on the 'myRoot' root to 'Boo!'.
 */
const goshawkdb = require('..')

// The cert and key should be taken from the .pem file for the user you wish to connect as.
// The user should also have a root called 'myRoot' for the rest of the test to work.  You can
// see the example/env folder for an example configuration.
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

goshawkdb.connect("wss://localhost:7895/ws", connectionOptions).then((connection) => {
	return connection.transact((txn) => {
		const myRootRef = txn.roots['myRoot']
		const root = txn.read(myRootRef)
		console.log("myRoot contains", root.value, root.refs)
		txn.write(myRootRef, Buffer.from("Boo!"), root.refs)
	}).then(
		() => {
			console.log('transaction committed')
			connection.close()
		}, (e) => {
			console.log('transaction failed because', e)
			connection.close()
		}
	)
}).then(() => console.log('done'), (err) => {console.error('connection problem', err)})
