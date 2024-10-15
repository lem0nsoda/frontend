const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const http = require('http');
var fs = require('fs');

const path_content = './content.json'; // Pfad zur JSON-Datei
const path_devices = './devices.json'; // Pfad zur JSON-Datei

var data_content;

// JSON-Datei asynchron lesen
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

fs.readFile(path_devices, 'utf8', (err, data) => {
    if (err) {
        console.error('Fehler beim Lesen der Datei:', err);
        return;
    }
    
    try {
        const data_device = JSON.parse(data); // JSON parsen
    } catch (err) {
        console.error('Fehler beim Parsen von JSON:', err);
    }
});

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

var currentImageIndex = 0;


function dia(currentData) {

    const diaMessage = {
        action: 'showDia',
        currentImage: currentData.images[currentImageIndex].name
    };

    

    //an alle clients schicken
    currentData.devices.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(diaMessage));
        }
    });

    currentImageIndex = (currentImageIndex + 1) % ImageSRC.length;
}

function startDia(currentData, imageChangeInterval){
    var id = setInterval(dia(currentData), imageChangeInterval);
}

function startVideo(currentData){

        const vidMessage = {
        action: 'showVideo',
        currentImage: currentData.name
    };

    //an alle clients schicken
    currentData.devices.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(diaMessage));
        }
    });
}



wss.on('connection', function connection(ws) {

    let clientId;

    const welcomeMessage = {
        sender: 'Server',
        text: 'Ein neuer Client hat sich verbunden.',
    };
    ws.send(JSON.stringify(welcomeMessage));

    console.log(`Client ${clientId} verbunden`);

    data_content.content.forEach(( c ) => {
        
        switch (c.type) {
            case "slideshow":
                console.log ("slideshow found ... ");
                break;


            default:
                console.log ("not supported");

        }

    });

    ws.on('close', function () {
        console.log(`Client ${clientId || 'Unbekannt'} hat die Verbindung getrennt.`);
        // Entferne den Client, wenn die Verbindung geschlossen wird
        diaClients.delete(ws);
    });
});

// Server-URL ausgeben
server.listen(port, hostname, () => {
    console.log(`Server läuft unter http://${hostname}:${port}/`);
});