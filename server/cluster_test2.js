const express = require("express");
const cluster = require("cluster");
const net = require("net");
const socketio = require("socket.io");
// const helmet = require('helmet')
// const socketMain = require("./socketMain");
// const expressMain = require('./expressMain');

const port = 3000;
const num_processes = require("os").cpus().length;

const io_redis = require("socket.io-redis");
const farmhash = require("farmhash");

if (cluster.isMaster) {
  // we are storing all the worker in an array. So that we can reference them later
  console.log("Inside Master");

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
    console.log(farmhash.fingerprint32(ip));
    const index = farmhash.fingerprint32(ip) % len;
    console.log(`${ip} is the IP`);
    console.log("Value of index from finger print");
    console.log(index);
    return index; // Farmhash is the fastest and works with IPv6, too
  };

  // in this case, we are going to start up a tcp connection via the net
  // module INSTEAD OF the http module. Express will use http, but we need
  // an independent tcp port open for cluster to work. This is the port that
  // will face the internet
  const server = net.createServer({ pauseOnConnect: true }, connection => {
    // We received a connection and need to pass it to the appropriate
    // worker. Get the worker for this connection's source IP and pass
    // it the connection.
    console.log("Someone connected to the server");
    console.log("Connection information");
    // console.log(connection);
    console.log("------------------------------");
    // here we are getting the worker for this connection IP
    let worker = workers[worker_index(connection.remoteAddress, num_processes)];
    console.log(`${connection.remoteAddress} is the connection remote address`);
    console.log("Worker information");

    worker.send("sticky-session:connection", connection);
    console.log(`${worker.id} id of the worker to which message will be send`);
  });

  server.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
    console.log(`Master ${process.pid} is running`);
  });
} else {
  let app = express();
  app.use(express.static(__dirname + "/public"));
  // Created an express server for each worker
  const server = app.listen(0, "localhost");
  console.log(`Worker ${process.pid} started`);
  // Adding event listner to all the workers
  // Listen to messages sent from the master. Ignore everything else.
  process.on("message", function(message, connection) {
    console.log("Message from the master to the workers");
    console.log(
      `${cluster.worker.id} is the id of the worker recieving the message`
    );
    console.log(message);
    if (message !== "sticky-session:connection") {
      return;
    }

    // Emulate a connection event on the server by emitting the
    // event with the connection the master sent us.
    // Now here express server will emit an event and pass the connection object
    server.emit("connection", connection);

    connection.resume();
  });
}

// setInterval(() => {
//   const x = Math.floor(Math.random() * 100);

//   const workerIndex = x % 8;
//   console.log(workerIndex);
//   }, 500)
