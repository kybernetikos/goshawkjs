# goshawkjs

GoshawkJS is a javascript client for goshawk.

## Getting Started

Run a goshawk server with the config found in `example/env`.

Make sure your browser has the certificates.  You can test this by going to https://localhost:9999/ws.  
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