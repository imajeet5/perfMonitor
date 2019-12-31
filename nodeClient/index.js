// The node program that captures local performance data and send it to socket io
// dependency: farmhash, socket.io-client

// Cpu load testing command
// yes > /dev/null & yes > /dev/null & yes > /dev/null & yes > /dev/null &

const os = require("os");
const io = require("socket.io-client");
const socket = io("http://127.0.0.1:8181");

socket.on("connect", () => {
  console.log("Connected to socket server", socket.id);
  // we need a way to identify this maching to whomever concerned
  // We will identify this maching by it ip address
  const nI = os.networkInterfaces();
  let macA;
  let address;

  // loop through all the nI for this machine and find the non-internal one
  // Mac Address will only come if you are connected to the internet
  //!  Change this to not equal, this is temp as we are not connected to the internet
  for (let key in nI) {
    if (nI[key][0].internal) {
      //!For testing
      macA = Math.floor(Math.random() * 3) + 1;
      console.log(macA);
      break;
      //! For testing
      // if ((nI[key][0] = "00:00:00:00:00" || nI[key][0] === undefined)) {
      //   macA = Math.random()
      //     .toString(36)
      //     .substring(2, 15);
      //   address = nI[key][0].address;
      // } else {
      macA = nI[key][0].mac;
      address = nI[key][0].address;
      // }
      break;
    }
  }

  // client auth with single key value
  socket.emit("clientAuth", "sdfoj309dsfnvnxcn53i");

  performanceData().then(pdata => {
    // Sending initial performance data to be store in the database
    // we can instead send the macA at the connect also
    pdata.macA = macA;
    pdata.address = address;
    socket.emit("initPrefData", pdata);
  });

  //start sending data over interval
  //? I dont' know why we are not sending macA and address data with the performance data
  //? as it will simplify the process.
  let prefDataInterval = setInterval(() => {
    performanceData().then(pdata => {
      pdata.macA = macA;
      pdata.address = address;
      // console.log(pdata);
      socket.emit("prefData", pdata);
    });
  }, 1000);

  socket.on("disconnect", () => {
    // socket.close();
    // Instead of closing the socket we are clearing the interval set by the the setInterval
    console.log("Disconnected");
    clearInterval(prefDataInterval);
  });
});

// we cannot return CPU load from this function so we have to use async

function performanceData() {
  return new Promise(async (resolve, reject) => {
    const cpus = os.cpus();

    //? what do we need to know from node about performance
    // -CPU load(current)
    // -Memory usage
    //      -free
    const freeMem = os.freemem();
    // console.log(freeMem / 1024);
    //       total
    const totalMem = os.totalmem();
    // console.log(totalMem / 1024);
    const usedMem = totalMem - freeMem;

    const memUsage = Math.floor((usedMem / totalMem) * 100) / 100;

    // -OS type
    const osType = os.type();
    // console.log(osType);
    // - uptime
    const upTime = os.uptime();
    // console.log(upTime / 60);
    // -CPU info

    //      Type: Intel Core(TM) i7-8850M CPU @ 2.60GHz
    const cpuModel = cpus[0].model;

    //      Number of Cores: 6
    const numCores = cpus.length;

    //      Clock SPeed: 2600
    const cpuSpeed = cpus[0].speed;

    //      CPU average
    const cpuLoad = await getCpuLoad();
    // to change the state of the machine
    const isActive = true;
    resolve({
      freeMem,
      totalMem,
      usedMem,
      memUsage,
      osType,
      upTime,
      cpuModel,
      numCores,
      cpuSpeed,
      cpuLoad,
      isActive
    });
  });
}

// cpus is all cores. We need the average of all the cores which will gives us the cpu average
function cpuAverage() {
  const cpus = os.cpus();
  // get ms in each mode, But this number is since reboot
  // so get it now, and then get it again in 100ms then compare
  //   times: { user: 14923700, nice: 13800, sys: 3527600, idle: 71377500, irq: 0 }
  let idleMs = 0;
  let totalMs = 0;
  // loop through each core
  cpus.forEach(core => {
    // loop through each property of the current core
    for (type in core.times) {
      totalMs += core.times[type];
    }
    idleMs += core.times.idle;
  });
  // it will return the average total of all the cores
  return {
    idle: idleMs / cpus.length,
    total: totalMs / cpus.length
  };
}

// because the time property is time since boot, we will get
// now times, and 100ms from now times. Compare them that will give us current load

function getCpuLoad() {
  return new Promise((resolve, reject) => {
    const start = cpuAverage();
    setTimeout(() => {
      const end = cpuAverage();
      const idleDifference = end.idle - start.idle;
      const totalDifference = end.total - start.total;
      // const percentageLoad = Math.floor(
      //   ((totalDifference - idleDifference) / totalDifference) * 100
      // );
      const percentageCpu =
        100 - Math.floor((100 * idleDifference) / totalDifference);
      resolve(percentageCpu);
    }, 100);
  });
}
