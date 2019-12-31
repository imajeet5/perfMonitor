const express = require("express");
const net = require("net");
var eventEmitter = require("events");
const port = 3000;

const server = net.createServer({ pauseOnConnect: true }, connection => {
  console.log("Someone connected to the server");

  connectionToExpress(connection);

  console.log(`${connection.remoteAddress} is the connection remote address`);
});

server.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});

let app = express();
app.use(express.static(__dirname + "/public"));
const expressServer = app.listen(0, "localhost");
