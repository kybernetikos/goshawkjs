# goshawkjs

GoshawkJS is a javascript client for goshawk.

## Notes for getting Started

Run a goshawk server with the config found in `example/env`.  See the [goshawk documentation](https://goshawkdb.io/documentation.html).

When running in the browser, you'll need to import the certificates for your user.  You can 
test that you've done this correctly by going to [https://localhost:9999/ws](https://localhost:9999/ws).  
If it's working, it will say 'Bad Request' and you'll see that a connection occurred in the
goshawk console.

To see the web example

```
npm run start
```

And navigate to http://localhost:8080/example/

The specific example code assumes that your database has a root object
with two references to other objects.

To see the node example

```
node example/node-example.js
```

## Setup

### In Node

Import goshawkjs

```bash
npm install --save kybernetikos/goshawkjs
```

When running in node, I suggest the following in your code:

```js
// Doesn't log at debug level as it's pretty noisy.  I'll need a proper logging solution soon...
global.console.debug = () => {}
// global.console.debug = global.console.log

// Make console.log of objects use colours.  Pretty
if (process.stdout.isTTY) {
	require('util').inspect.defaultOptions.colors = true
}
```

Get a goshawkjs reference and open a connection:

```js
const goshawkjs = require('goshawkjs')

// These will need to be for a user that your goshawk configuration allows.
// Check the .pem file you created for that user.
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

goshawkjs.connect("wss://localhost:9999/ws", connectionOptions).then((connection) => {

    // this is where your goshawk code goes

})
```

### In the browser

The configuration of keys and certificates must be done in whatever way your browser
and operating system support.

Check that it has worked by navigating to [https://localhost:9999/ws](https://localhost:9999/ws).
If it's working, it will say 'Bad Request' and you'll see that a connection occurred in the
goshawk console.

Include the client:

```html
<script type="text/javascript" src="goshawkdb.browser.js"></script>
```

The file `goshawkdb.browser.js` is located in the dist subfolder of this module.
It is regenerated on an `npm build`.

Now include your code, e.g.

```js
goshawkjs.connect("wss://localhost:9999/ws").then((connection) => {
  
    // this is where your goshawk code goes

})
```

### Connection API

A connection allows you to submit transactions.

```js
connection.transact((txn) => {

	// transaction code

})
```

### Transaction API

Inside a transaction you can access references to the configured root objects:

```js
const rootRef = txn.roots['myRoot']
```

You can read the value and references of an object via a reference to that object.

```js
const {value, refs} = txn.read(rootRef)
```

Values are ArrayBuffers while `refs` is an array of Reference ojects.

To write to an object you call `txn.write`.  This example code loads the first reference from
the root object (assuming it refers to some object), then sets the value and adds a reference back to the root object.

```js
const otherObjRef = refs[0]
const otherRefs = txn.read(otherObjRef).refs
txn.write(otherObjRef, Buffer.from("hello"), otherRefs.concat(rootRef))
```

Values can be buffers (in node), typed arrays or arraybuffers.

You can create an object too with

```js
const newRef = txn.create(Buffer.from("thing"), [])
```

Make sure you add the reference to an object before the end of the transaction or you won't 
be able to access it in the future.