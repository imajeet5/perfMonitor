// Socket.io server that will service both the node and react clients
// dependency: socket.io, socket.io-redis, farmhash

//Entry point for our cluster which we will make workers
// and the works will do the socket.io handling
//See https://github.com/elad/node-cluster-socket.io

const express = require("express");
const cluster = require("cluster");
const net = require("net");
const socketio = require("socket.io");
// const helmet = require('helmet')
const socketMain = require("./socketMain");
// const expressMain = require('./expressMain');

const port = 8181;
const num_processes = require("os").cpus().length;
// Brew breaks for me more than it solves a problem, so I
// installed redis from https://redis.io/topics/quickstart
// have to actually run redis via: $ redis-server (go to location of the binary)
// check to see if it's running -- redis-cli monitor
const io_redis = require("socket.io-redis");
const farmhash = require("farmhash");

// This will be checked first time the code is run. First time cluster.isMaster is true
// then will will create the worker based upon the number of cores the machine have

if (cluster.isMaster) {
  // we are storing all the worker in an array. So that we can reference them later

  let workers = [];

  // Helper function for spawning worker at index 'i'.
  let spawn = function(i) {
    workers[i] = cluster.fork();

    // Optional: Restart worker on exit
    workers[i].on("exit", function(code, signal) {
      // console.log('respawning worker', i);
      spawn(i);
    });
  };

  // Spawn workers.
  for (var i = 0; i < num_processes; i++) {
    spawn(i);
  }

  // Helper function for getting a worker index based on IP address.
  // This is a hot path so it should be really fast. The way it works
  // is by converting the IP address to a number by removing non numeric
  // characters, then compressing it to the number of slots we have.
  //
  // Compared against "real" hashing (from the sticky-session code) and
  // "real" IP number conversion, this function is on par in terms of
  // worker index distribution only much faster.
  const worker_index = function(ip, len) {
    return farmhash.fingerprint32(ip) % len; // Farmhash is the fastest and works with IPv6, too
  };

  // in this case, we are going to start up a tcp connection via the net
  // module INSTEAD OF the http module. Express will use http, but we need
  // an independent tcp port open for cluster to work. This is the port that
  // will face the internet
  const server = net.createServer({ pauseOnConnect: true }, connection => {
    // We received a connection and need to pass it to the appropriate
    // worker. Get the worker for this connection's source IP and pass
    // it the connection.
    let worker = workers[worker_index(connection.remoteAddress, num_processes)];
    worker.send("sticky-session:connection", connection);
  });
  server.listen(port);
  console.log(`Master listening on port ${port}`);
} else {
  // Note we don't use a port here because the master listens on it for us.
  let app = express();
  // app.use(express.static(__dirname + '/public'));
  // app.use(helmet());

  // Don't expose our internal server to the outside world.
  const server = app.listen(0, "localhost");
  // console.log("Worker listening...");
  const io = socketio(server);

  // Tell Socket.IO to use the redis adapter. By default, the redis
  // server is assumed to be on localhost:6379. You don't have to
  // specify them explicitly unless you want to change them.
  // redis-cli monitor
  io.adapter(io_redis({ host: "localhost", port: 6379 }));

  // Here you might use Socket.IO middleware for authorization etc.
  // on connection, send the socket over to our module with socket stuff
  io.on("connection", function(socket) {
    socketMain(io, socket);
    console.log(`connected to worker: ${cluster.worker.id}`);
  });

  // Listen to messages sent from the master. Ignore everything else.
  process.on("message", function(message, connection) {
    if (message !== "sticky-session:connection") {
      return;
    }

    // Emulate a connection event on the server by emitting the
    // event with the connection the master sent us.
    server.emit("connection", connection);

    connection.resume();
  });
}

// Hello Robert, in the worker_index() function which uses farmhash to design which ip goes to which worker, you commented that "This is a hot path so it should be really fast." I don't know what hot path means. I googled it, and came across this post: https://medium.com/@seebrock3r/a-hot-path-is-a-code-path-that-is-perf-critical-either-because-its-something-that-is-really-85ee62fe68f6. It said "A “hot path” is a code path that is perf-critical, either because it’s something that is really perf-intensive, or because it’s latency-sensitive."

// Okay, I think I kinda understand it a bit. But how do we distinguish it is a hot path, and should make it as fast as possible?

// Thank you very much for your help in advance. :D
