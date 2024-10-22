const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const http = require('http');
var fs = require('fs');
const mime = require('mime-types');

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
function startDia(imageData){
    console.log ("slideshow start ... ");
    
    if(intervalId < 0){
        intervalId = setInterval(()=>{
            //auf pfad zugreifen      console.log(imageSRC);

            const imagePath = path.join(__dirname, imageData.images[imageIndex].name);

            fs.readFile(imagePath, (err, data) => {
                if (err) {
                    console.error('Fehler beim Lesen der Datei:', err);
                    return;
                }
            
                // Bild in Base64 umwandeln
                const base64Image = data.toString('base64');

                // Dateityp dynamisch ermitteln
                const mimeType = mime.lookup(imagePath);
        
                //Message an den client
                const diaMessage = {
                    action: 'showDia',
                    currentImage: imageData.images[imageIndex].name,
                    fileType: mimeType,
                    data: base64Image
                };
        
                //alle angengebenen clients: 
                imageData.devices.forEach((client) => {
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
            });
            
            //index für nächstes Bild
            imageIndex ++;
        
            //1 mal durchlaufn dann abbrechen
            if(imageIndex >= imageData.images.length){
                console.log("Clear interval");
                clearInterval(intervalId);
                imageIndex = 0;
                intervalId = -1;
            }
        
        }, imageData.interval*1000);
    }
}

//video starten und übergeben
function startVideo(videoData){
    //videoSRC
    let videoSRC = videoData.name;

    const videoPath = path.join(__dirname, videoSRC);

    fs.readFile(videoPath, (err, data) => {
        if (err) {
            console.error('Fehler beim Lesen der Datei:', err);
            return;
        }
    
        // Bild in Base64 umwandeln
        const base64Video = data.toString('base64');

        // Dateityp dynamisch ermitteln
        const mimeType = mime.lookup(videoPath);
    
        //message an client
        const vidMessage = {
            action: 'showVideo',
            video: videoSRC,
            fileType: mimeType,
            data: base64Video
        };

        //alle angengebenen clients: 
        videoData.devices.forEach((client) => {
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
    });
}


//NEUER CLIENT CONNECTED
wss.on('connection', function connection(ws) {

    var clientID;
    var index = 0;

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
            device = { 
                status: 'success',
                clientID: clientID, 
                message: 'ClientID OK' 
            };
            data_device.forEach((d) => {
                if(d.id == clientID)
                    device+=d;
            });
            ws.send(JSON.stringify());
        }


        function runThroughArray(array) {
            const startTime = Date.now(); // Capture the current time
            let delay = 0;
            let index = 0; // Initialize the index
        
            function iterate() {
                const currentTime = Date.now(); // Get the current time
        
                // delay zeit vergangen? 
                if (currentTime - startTime >= delay ) {

                    if(array[index].type == "slideshow"){
                        startDia(array[index]);
                        delay += array[index].interval * (array[index].images.length +1) * 1000;
                    }
                    else if(array[index].type == "video"){
                        startVideo(array[index]);
                        delay += array[index].duration * 1000;
                    }
                    else{
                        console.log("Error - Type not supported");
                    }
                    console.log(array[index]); // Log the current element
                    index++; 
                    
                    // mehr array elemente?
                    if (index < array.length) {
                        iterate(); // rekursiver aufruf
                    }
                } else {        //noch nicht vergangen -> kurz warten -> wieder versuchen 
                    setTimeout(iterate, 50); // oft wieder versuchen
                }
            }
        
            iterate(); // Start the iteration
        }

        runThroughArray(data_content.content, 10000);

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

function trace(message, color = 'black') {
    const now = new Date(); // Get the current system time
    const timestamp = now.toISOString(); // Format the time as ISO string

    // Create a styled message
    const styledMessage = `%c${timestamp} - ${message}`;
    
    // Log the styled message to the console with the specified color
    console.log(styledMessage, `color: ${color}`);
}