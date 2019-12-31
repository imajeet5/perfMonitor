// const mongoose = require("mongoose");
// mongoose.connect(
//   "mongodb://localhost:27017/socketioData",
//   {
//     useNewUrlParser: true,
//     useUnifiedTopology: true
//   },
//   () => {
//     console.log("Mongo DB server connected");
//   }
// );
const Machine = require("./models/Machine");

function socketMain(io, socket) {
  let macA, address;
  //   console.log("A socket connected!", socket.id);
  console.log("Someone called the socket main", socket.id);

  socket.on("clientAuth", key => {
    if (key === "sdfoj309dsfnvnxcn53i") {
      // valid node client has connected, join him to room for clients
      socket.join("clients");
    } else if (key === "sadcvs0fg9093434off") {
      // a vaild react client has connected, join him to ui
      socket.join("ui");
      console.log("A react client has joined");
      // After the react client has joined we will send it all the machines data
      // from the database with machine isActive status set to false
      Machine.find({}, (error, docs) => {
        docs.forEach(machine => {
          // on load assume that all machines are offline
          machine.isActive = false;
          io.to("ui").emit("data", machine);
        });
      });
    } else {
      // an invalid client has joined. Kick him out
      socket.disconnect(true);
    }
  });

  socket.on("disconnect", () => {
    // get the doc corresponding the the socket and send the the react client isActive = false
    Machine.find({ macA: macA }, (err, doc) => {
      if (doc.length > 0) {
        doc[0].isActive = false;
        io.to("ui").emit("data", doc[0]);
      }
    });
  });

  // a machine has connected, check to see if it is a new
  // if it is, add it
  socket.on("initPrefData", async data => {
    // update our socket connect function scoped variable
    macA = data.macA;
    address = data.address;
    // check the mongo database
    const mongooseResponse = await addToDatabase(data);
    console.log(mongooseResponse);
  });

  // get pref Data from the client
  socket.on("prefData", pData => {
    // console.log(pData);
    // Emitted data to the react clients connected to the the room 'ui
    io.to("ui").emit("data", pData);
  });

  io.clients((error, clients) => {
    console.log(`Number of clients: ${clients.length}`);
  });
}

module.exports = socketMain;

// we can also do this by using async and await, instead of creating a new promise

function addToDatabase(data) {
  //Instead of defining this function as async, we will make a promise
  return new Promise((resolve, reject) => {
    Machine.findOne({ macA: data.macA }, (err, doc) => {
      if (err) reject(err);
      if (doc === null) {
        // the record is not in the database, so add it
        let machine = new Machine(data);
        machine.save(); // this will save it to the database
        resolve("added to the dbs");
      } else {
        // record is in the db
        resolve("Already in database");
      }
    });
  });
}

/****
 * We will add mongo, because in addition to just storing presistant data we want to know
 * everytime a maching logs in has it been here before .
 * If it hasn't been here before, then we are going to add it.
 * If it has been here before, we don't need to do anything at this point but when we make react part
 * we will be able to connect it with the appropriate widget because we want to know which maching is
 * connected at this moment and which is not
 */
