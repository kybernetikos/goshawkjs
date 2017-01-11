# goshawkjs

GoshawkJS is a javascript client for goshawkdb.

## Notes for getting Started

Run a goshawkdb server with the config found in `example/env`.  See the [goshawkdb documentation](https://goshawkdb.io/documentation.html).

When running in the browser, you'll need to import the certificates for your user.  You can 
test that you've done this correctly by going to [https://localhost:9999/ws](https://localhost:9999/).  
If it's working, it will say 'GoshawkDB Server version dev. Websocket available at /ws'.

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

// These will need to be for a user that your goshawkdb configuration allows.
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

    // this is where your goshawkjs code goes

})
```

### In the browser

The configuration of keys and certificates must be done in whatever way your browser
and operating system support.

Check that it has worked by navigating to [https://localhost:9999/ws](https://localhost:9999/ws).
If it's working, it will say 'GoshawkDB Server version dev. Websocket available at /ws'.

Include the client:

```html
<script type="text/javascript" src="goshawkdb.browser.js"></script>
```

The file `goshawkdb.browser.js` is located in the dist subfolder of this module.
It is regenerated on an `npm build`.

Now include your code, e.g.

```js
goshawkjs.connect("wss://localhost:9999/ws").then((connection) => {
  
    // this is where your goshawkjs code goes

})
```

### Connection API

A connection allows you to submit transactions.  Only one transaction is ever active at a time, calling `transact` while
another transaction is active will cause your new transaction to be queued.

```js
const promiseOfSomething = connection.transact((txn) => {

	// transaction code

    return something
})
```

### Transaction API

**NOTE**: code submitted to `.transact` may be run by the system multiple times. Avoid making side effecting changes
from inside a transaction.  The goshawkjs library uses exceptions to stop execution when there is a cache miss and it
needs to request values from the server.  If you use try catch around transaction methods and you want this behaviour
to work, you will need to rethrow any exceptions with a name of `TransactionRetryNeeded` that you inadvertantly catch.

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

If you want to be notified when something changes, you can create a transaction that reads the values you're interested
in and then calls `txn.retry()`.  This will cause the transaction to stop processing until the values change, at which
point the transaction will be run again.

If you want to check that references point to the same object, you can do this with `if (ref.sameReferent(otherRef))`.