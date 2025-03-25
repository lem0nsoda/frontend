const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const http = require('http');
const fs = require('fs');

const app = express();
const hostname = '192.168.2.209';
const port = 3000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const apiurl = "https://digital-signage.htl-futurezone.at/api/index.php";

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

var playClients = [];

var savedContent = [];
var contentDuration = [];

var nextPlay = null;

var playlistData = null;

wss.on('connection', async function connection(ws) {

    //CLIENTID
    let clientID = null;
    let clientName = null;
    let clientStatus = null;

    ws.on('message', async function incoming(message) {
        try {
            let parsedMessage = JSON.parse(message);
            let clientName_new = parsedMessage.clientName_new;

            const response = await fetch(`${apiurl}/client/getBy?table=client&where=name&is=${clientName_new}`);
            if (!response.ok) throw new Error("API-Fehler ClientName");
            const data = await response.json();

            if (!data.length) {
                ws.send(JSON.stringify({ status: 'error', message: 'ClientName existiert nicht' }));
                return;
            }

            for(let i = 0; i < data.length; i++){
                clientID = data[i].id;
                clientName = data[i].name;
                clientStatus = data[i].client_status;

                if (clientStatus == 0) {
                    break;
                }
            }

            //console.log("id:" + clientID + ", name:" + clientName + ", status:" + clientStatus);

            let file =  JSON.stringify({ id: clientID, client_status: 2314 });
            //console.log(file);

            //status update
            const response2 = await fetch(`${apiurl}/client/updateStatus`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: file
            });
            if (!response2.ok) throw new Error("API-Fehler status update");
            const data2 = await response2.json();
            //console.log(data2);

            ws.send(JSON.stringify({ status: 'success', clientName: clientName_new, clientID: clientID }));
            console.log(`Client ${clientName_new} verbunden.`);

            setup();

        } catch (error) {
            console.error("Fehler:", error);
            ws.send(JSON.stringify({ status: 'error', message: 'Serverfehler' }));
        }
    });


    ws.on('close', async () => {
        if (clientID) {
            console.log(`Client ${clientName} getrennt, Status offline`);
            try {
                await fetch(`${apiurl}/client/updateStatus`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: clientID, status: 0 })
                });
            } catch (error) {
                console.error("Fehler beim Aktualisieren des Status:", error);
            }
        }
    });
});


//alle unteren funktionen so aufrufen, dass sie zusammen funktionieren
//vorbereitungen zum starten der playlist
function setup(){
    fetchPlayData().then(next =>{
        nextPlay = next;
        wss.clients.forEach(function each(ws) {
            ws.send(JSON.stringify({
                action: 'info',
                nextStart: nextPlay.start
            }));
        });

        fetchPlaylistData();
        fetchClientsData();

        fetchContainsData(nextPlay.playlist_ID).then(contains =>{
            saveContent(contains).then(success=>{
                if(success){
                    sendPlaylist();
                }
            });
        });
    });
}

//sendet playlist daten an clients wenn startzeit erreicht
async function sendPlaylist() {
    let index = 0;

    //überprüfung wie lange gewartet wird
    const targetTime = new Date(nextPlay.start).getTime();
    const delay = targetTime - Date.now();

    if (delay <= 0) {
        console.log("Zeitpunkt bereits erreicht!");
        callback();
    } else {
        console.log(`Warten für ${delay / 1000} Sekunden...`);
        //warten bis zeitpunkt erreicht
        setTimeout(loop, delay);
    }

    function loop() {
        if(index < savedContent.length){

            console.log("why so serious");

            let content = savedContent[index];
            let duration = contentDuration[index] * 1000;

            if (!content || content == null) {
                console.error("Kein COntent gefunden");
                return;
            }

            sendContentOnClients(content);

            index ++;

            setTimeout(loop, duration);
        }
        else{
            reset();
        }
    }
}

//holt daten auf welchen clients die playlist angezeigt wird und speichert diese in array
function fetchClientsData(){
    req = apiurl + "/playlist/getBy?table=plays_on&where=play_ID&is=" + nextPlay.id;

    fetch(req)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            for(let i = 0; i < data.length; i++){
                playClients[i] = data[i].client_ID;
            }
        })
        .catch(error => console.error('Error fetching data:', error));
}

//holt playlist daten und speichert diese in playlistData
function fetchPlaylistData() {
    let req = apiurl + "/playlist/getThis?table=playlist&id=" + nextPlay.playlist_ID;

    fetch(req)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                playlistData = data[0];

                wss.clients.forEach(function each(ws) {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            action: 'info',
                            playlistName: playlistData.name,
                        }));
                    }
                });


            })
            .catch(error => console.error('Error fetching data:', error));
}

//zugriff auf PlayPlaylist daten per API und setzten von nextplay auf nächte NICHT abgelaufene Startzeit
async function fetchPlayData() {
    const time = Date.now();
    const req = apiurl + "/playlist/get?table=play_playlist&by=start&limit=100";

    try {
        const response = await fetch(req);
        const data = await response.json();
        let next = null;
        //console.log(data);

        data.map(play =>{
            if(!next){
                const dateString = play.start;
                const timestamp = new Date(dateString).getTime();

                const isExpired = time > timestamp;

                if(!isExpired)
                    next=play;
                console.log(isExpired ? "Abgelaufen" : "Noch gültig");
            }
        });
        return next;
    } catch (error) {
        console.error('Error fetching Contains data:', error);
    }
}

//holt informationen welchen content die playlist enthält geordnet nach 'arrangement' (übergabe: playlist id)
async function fetchContainsData(id){
    try {
        const response = await fetch(`${apiurl}/playlist/getByOrder?table=playlist_contains&by=arrangement&where=playlist_ID&is=${id}`);
        const data = await response.json();
        //console.log(data);
        return data;
    } catch (error) {
        console.error('Error fetching Contains data:', error);
    }
}

//speichert die contentdaten in ein globales Array, speichert angegebene duration in array
async function saveContent(contains) {
    for(let i = 0; i < contains.length; i++){
        await fetchContentData(contains[i].content_ID).then(content =>{
            savedContent[i] = content;
            contentDuration[i] = contains[i].duration;
        })
    }

    //console.log("content ", savedContent);
    console.log("dur ", contentDuration);

    return true;
}

//holt content datetn pre api und liefert per return zurück (übergabe: content id)
async function fetchContentData(id) {
    try {
        const response = await fetch(`${apiurl}/content/getThis?id=` + id);
        const data = await response.json();
        //console.log(data);
        return data[0];
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

//schickt die contentdaten an die clients (übergabe: content)
function sendContentOnClients(content){
    //nachricht an script zur anzeige
    let contentAnzeigen = {
        action: 'showContent',
        contentData: content,
        clients: playClients
    };

    wss.clients.forEach(function each(ws) {

        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(contentAnzeigen));
        }
    });
}

//setzt alles zurück und schickt aufforerung auf reset zu client
function reset(){
    console.log("reset");

    playClients = [];

    savedContent = [];
    contentDuration = [];

    nextPlay = null;

    playlistData = null;

    let resetMessage = {
        action: 'reset'
    };

    wss.clients.forEach(function each(ws) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(resetMessage));
        }
    });

    setup();
}

server.listen(port, hostname, () => {
    console.log(`Server läuft unter http://${hostname}:${port}/`);
});
