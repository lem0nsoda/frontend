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

// um nur einen Interval starten zu können
var intervalId = -1;

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


//Diashow starten 
function startDia(imageChangeInterval){
    console.log ("slideshow start ... ");

    

    if(intervalId < 0){
        intervalId = setInterval(()=>{

            console.log(currentData);
                let imageSRC = currentData.images[imageIndex].name;
                console.log(imageSRC);
            
                //Message an den client
                const diaMessage = {
                    action: 'showDia',
                    currentImage: imageSRC
                };
            
                //alle angengebenen clients: 
                currentData.devices.forEach((client) => {
                    let id = String(client.id);
            
                    if (connectedClients.has(id)){
                        let webs = connectedClients.get(id);
                        if(webs.readyState === WebSocket.OPEN){
                            webs.send(JSON.stringify(diaMessage));
                        }
                    } else {
                        console.log(`Error - Client mit ID ${id} nicht verbunden!` );
                        connectedClients.delete(id);
                    }
                });
            
                //index für nächstes Bild
                imageIndex = (imageIndex + 1);
            
                //1 mal durchlaufn dann abbrechen
                if(imageIndex >= currentData.images.length){
                    console.log("Clear interval");
                    clearInterval(intervalId);
                    imageIndex = 0;
                    intervalId = -1;
                }
            
        }, imageChangeInterval);
    }
}

//video starten und übergeben
function startVideo(){
    console.log("play video");
    const vidMessage = {
        action: 'showVideo',
        video: currentData.name
    };


    //alle angengebenen clients: 
    currentData.devices.forEach((client) => {
        let id = String(client.id);

        if (connectedClients.has(id)){
            let webs = connectedClients.get(id);
            if(webs.readyState === WebSocket.OPEN){
                console.log("send info ");
                webs.send(JSON.stringify(vidMessage));
            }
        } else {
            console.log(`Error - Client mit ID ${id} nicht verbunden!` );
            connectedClients.delete(id);
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

        //Neue clientID in connectedClients einfügen , fehlermeldung, wenn ID schon vorhanden
        if (connectedClients.has(clientID)) {
            console.log(`Client ${clientID} verbunden`);
            ws.send(JSON.stringify({ status: 'error', message: 'ClientID schon vergeben' }));
        } else {
            connectedClients.set(clientID, ws);
            ws.send(JSON.stringify({ status: 'success', clientID: clientID, message: 'ClientID OK' }));
        }

        //ausführen je nach type von currentData
        currentData = data_content.content[0];

        if(currentData.type == "slideshow")
            startDia(3000);
        else if(currentData.type == "video")
            startVideo();
        else
            console.log("Error - Type not supported");




        /*/For each um gesammtes contentarray durchzugehen
        data_content.content.forEach(( c ) => {
            currentData = c;
            // unterscheidung zwischen slideshow und video
            switch (c.type) {
                case "slideshow":
                    console.log ("slideshow found ... ");
                    startDia(1000);
                    break;
                case "video":
                    console.log ("video found ... ");
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