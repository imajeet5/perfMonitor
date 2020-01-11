# perfMonitor
This app monitor the performace of the various machines connected. Each machine will have a node client which will send data to socket server. Socket Server will send data to React client. React client is in seperate repo as not upload correctly

Folders: <br>
server: Only two files are relevent, socketMain.js and server.js <br>
  Socket main is the main socket server of the app. <br>
  This recieves the performace data send from the node Clients running on the machines. <br>
  This server then emit the machine performance data to the React Client in the real time <br>
  I am also using the Cluster module of node js to distribute the incomming load among all the thread of the cpu there by
  utlizing the multithreading in nodejs. <b>
  To make the socket work with distrubuted server, I am making the sure that each client after disconnection, on reconnect 
  will the assign to the same thread it was previously assigned based on client Ip address <br>
  I am using Redis (Pub/Sub) model to use socket with cluster module. <br> 
 
nodeClient: Send the performance data of the machine it was running to the socket client. Performance data are CPU current load, 
RAM useage, OS model , CPU Model, etc. <br>

reactClient: It recieves all machine data send by the soceket server. And display it one HTML canvas. 
https://github.com/dev-ajeet/react_ClientSocketIO


 
