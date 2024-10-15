const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const http = require('http');
var fs = require('fs');

//Express app
const app = express();
//const hostname = '192.168.2.209'; // daham
const hostname = '10.13.243.238'; // htl
const port = 3000;

// HTTP-Server erstellen und sowohl für Express als auch für WebSocket verwenden
const server = http.createServer(app);

// WebSocket-Server an den HTTP-Server binden
const wss = new WebSocket.Server({ server });

// Static Files (HTML, JS, CSS) aus dem 'public'-Ordner
app.use(express.static(path.join(__dirname, 'public')));

// Optionale Route für '/'
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

//Json dateien einbinden
const path_content = './content.json'; // Pfad zur JSON-Datei
const path_devices = './devices.json'; // Pfad zur JSON-Datei

//daten aus json strings
var data_content;
var data_device;

//Set (Array) für clients - keine zwei gleichen elemente möglich
var connectedClients = new Map();

//VAriablen für diashow
var imageIndex = 0;
var currentData;
var intervalId;

// JSON-Datei für Content asynchron lesen
fs.readFile(path_content, 'utf8', (err, data) => {
    if (err) {
        console.error('Fehler beim Lesen der Datei:', err);
        return;
    }
    
    try {
        data_content = JSON.parse(data); // JSON parsen
    } catch (err) {
        console.error('Fehler beim Parsen von JSON:', err);
    }
});

// JSON-Datei für Content asynchron lesen
fs.readFile(path_devices, 'utf8', (err, data) => {
    if (err) {
        console.error('Fehler beim Lesen der Datei:', err);
        return;
    }
    
    try {
        data_device = JSON.parse(data); // JSON parsen
    } catch (err) {
        console.error('Fehler beim Parsen von JSON:', err);
    }
});


//funktion zum übergeben der Daten an einen client
function dia() {
    let imageSRC = currentData.images[imageIndex].name;
    console.log(imageSRC);

    const diaMessage = {
        action: 'showDia',
        currentImage: imageSRC
    };

    /*an alle clients, welche angegeben sind schicken
    currentData.devices.forEach((client) => {
        console.log(client.id);
        if (connectedClients.has(client.id) && client.readyState === WebSocket.OPEN){
            console.log("send info ");
            client.id.send(JSON.stringify(diaMessage));
        } else {
            connectedClients.delete(client);
        }
    });*/


    //alle angengebenen clients: 
    currentData.devices.forEach((client) => {
        let id = String(client.id);
        
        console.log(id);


        if (connectedClients.has(id)){
            let webs = connectedClients.get(id);
            if(webs.readyState === WebSocket.OPEN){
                console.log("send info ");
                webs.send(JSON.stringify(diaMessage));
            }
        } else {
            console.log("error");
            connectedClients.delete(id);
        }
    });


    //index für nächstes Bild
    imageIndex = (imageIndex + 1) % currentData.images.length;

    //1 mal durchlaufn dann abbrechen
    if(imageIndex >= currentData.images.length){
        console.log("Clear interval");

        clearInterval(intervalId);
    }
   
}

//Diashow starten 
function startDia(imageChangeInterval){
    console.log ("slideshow start ... ");

    //prüfen ob dia eine Funktion ist (hat probleme aufgeworfen)
    console.log("Callback function: ", dia);
    if (typeof dia === "function") {
         const intervalId = setInterval(dia, imageChangeInterval);  // Make sure 'dia' is a valid function
    } else {
        console.error("Error: 'dia' is not a function.");
    }
}

//video starten und übergeben
function startVideo(){
    console.log("play video");
    const vidMessage = {
        action: 'showVideo',
        video: currentData.name
    };

    //an alle angegebenen clients schicken
    currentData.devices.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(diaMessage));
        }
    });
}


//NEUER CLIENT CONNECTED
wss.on('connection', function connection(ws) {

    var clientID;

    const welcomeMessage = {
        sender: 'Server',
        text: 'Ein neuer Client hat sich verbunden.',
    };
    ws.send(JSON.stringify(welcomeMessage));

    //nachricht erhalten
    ws.on('message', function incoming(message) {
        console.log('Erhalten: %s', message);

        //parse JSON String von message
        try {
            var parsedMessage = JSON.parse(message);
        } catch (error) {
            console.error('Fehler beim Parsen der Nachricht:', error);
            return;
        }

        // Client ID abspeichern 
        clientID = parsedMessage.clientID;

        console.log(clientID);

        //Neue clientid in connected clients einfügen , fehlermeldung, wenn schon vorhanden
        if (connectedClients.has(clientID)) {
            ws.send(JSON.stringify({ status: 'error', message: 'ClientID schon vergeben' }));
        } else {
            connectedClients.set(clientID, ws);
            ws.send(JSON.stringify({ status: 'success', clientID: clientID, message: 'ClientID OK' }));
        }


        console.log(`Client ${clientID} verbunden`);

        //probe für diashow 
        currentData = data_content.content[0];
        startDia(1000);


        /*/For each um gesammtes contentarray durchzugehen
        data_content.content.forEach(( c ) => {
            // unterscheidung zwischen slideshow und video
            switch (c.type) {
                case "slideshow":
                    console.log ("slideshow found ... ");
                    currentData = c;


                    setTimeout(() => {
                        console.log("This message is delayed by 2 seconds.");
                    }, 2000);


                    startDia(1000);
                    break;
                case "video":
                    console.log ("video found ... ");
                    currentData = c;
                    startVideo();
                    break;
    
                default:
                    console.log ("not supported");
            }
        });*/

        console.log("Close");
    });


    ws.on('close', function () {
        console.log(`Client ${clientID || 'Unbekannt'} hat die Verbindung getrennt.`);
        // Entferne den Client, wenn die Verbindung geschlossen wird
        connectedClients.delete(clientID);
    });
});

// Server-URL ausgeben
server.listen(port, hostname, () => {
    console.log(`Server läuft unter http://${hostname}:${port}/`);
});