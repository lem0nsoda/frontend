const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const http = require('http');
const fs = require('fs');
const mime = require('mime-types');

const app = express();
const hostname = '10.13.243.25';
const port = 3000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });


const BASE_URL = 'http://10.13.243.25:3000';

const apiurl = "https://digital-signage.htl-futurezone.at/api/index.php";

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/timestamp', (req, res) => {
    res.json({ timestamp: Date.now() });
});

var playClients = [];

var nextPlay = null;
var playlistData = null;
var savedContent = [];
var contentDuration = [];
var isExtended = null;
var times_play = 0;
var times_play_count = 0;


var defaultPlay = null;
var defaultPlaylistData = null;
var playDefault = false;
var defaultContent = [];
var defaultContentDuration = [];

var isSending = false;
let timeoutId = null;
var index = 0;


wss.on('connection', async function connection(ws) {

    //CLIENTID
    let clientID = null;
    let clientName = null;
    let clientX = null;
    let clientY = null;

    ws.on('message', async function incoming(message) {
        try {
            let parsedMessage = JSON.parse(message);
            let clientName_new = parsedMessage.clientName_new;
            let client_height = parsedMessage.height;
            let client_width = parsedMessage.width;
            clientX = 0;
            clientY = 0;

            const response = await fetch(`${apiurl}/client/getBy?table=client&where=name&is=${clientName_new}`);
            if (!response.ok) throw new Error("API-Fehler ClientName");
            const data = await response.json();

            if (!data.length) {
                var client = JSON.stringify({ 
                    name: clientName_new, 
                    width: client_width, 
                    height: client_height,
                    xPosition: clientX,
                    yPosition: clientY
                });

                const responseAdd = await fetch(`${apiurl}/client/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: client
                });

                if (!responseAdd.ok) throw new Error("API-Fehler status update");
                const added = await responseAdd.json();

                clientID = added.newID;
                clientName = clientName_new;  
            }
            else{
                if(data[0].client_status === 0 || data[0].client_status == null){
                    clientID = data[0].id;
                    clientName = data[0].name;
                    clientX = data[0].xPosition;
                    clientY = data[0].yPosition;
                }
                else{
                    ws.send(JSON.stringify({ status: 'error', message: 'ClientName schon vergeben' }));
                    return;
                }
            }

            var updateWH = JSON.stringify({ 
                id: clientID, 
                width: client_width, 
                height: client_height 
            });

            const responseUpdate = await fetch(`${apiurl}/client/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: updateWH
            });

            if (!responseUpdate.ok) throw new Error("API-Fehler status update");
            const updated = await responseUpdate.json();

            console.log("id:" + clientID + ", name:" + clientName );

            let file =  JSON.stringify({ id: clientID, client_status: 1 });

            //status update
            const response2 = await fetch(`${apiurl}/client/updateStatus`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: file
            });
            if (!response2.ok) throw new Error("API-Fehler status update");
            const data2 = await response2.json();

            ws.send(JSON.stringify({ status: 'success', clientX: clientX, clientY: clientY, clientName: clientName_new, clientID: clientID}));
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
    fetchPlayData().then(next => {   //play playlist data => nächste zu spielende playlist

        nextPlay = next;
        isExtended = nextPlay.extended;
        times_play = nextPlay.how_often;
        playDefault = false;

        console.log("hieeerrrrrrrrr: " + times_play);


        // Timestamp-Request
        fetch(`${BASE_URL}/api/timestamp`)
            .then(response => response.json())
            .then(data => {
                const serverTime = data.timestamp;
                console.log("Server-Zeit: ", serverTime);

                const targetTime = new Date(nextPlay.start).getTime();
                const delay = targetTime - serverTime;

                // Wenn delay länger als 5min dauert -> default
                if(delay > 300000){
                    console.log("zu lange");
                    nextPlay = defaultPlay;
                    playDefault = true;
                    sendPlaylist();
                } else{
                    wss.clients.forEach(function each(ws) {
                        ws.send(JSON.stringify({ 
                            action: 'info', 
                            nextStart: nextPlay.start
                        }));
                    });
        
                    fetchPlaylistData();        //playlistdaten der ausgewählten playlist
                    fetchClientsData();         //clientdaten aus plays_on mit play_id von playplaylist
        
                    fetchContainsData(nextPlay.playlist_ID).then(contains =>{       //content aus playlistcontains
                        saveContent(contains, savedContent, contentDuration).then(success=>{                       //dann content aus content-table holen und in array speichern
                            if(success){
                                sendPlaylist();                                     //playlist senden (warten zum startzeitpunkt)
                            }
                        })
                    })
                }
                
            })
            .catch(error => console.error("Fehler beim Abrufen des Server-Timestamps:", error));
            
    });
}

//sendet playlist daten an clients wenn startzeit erreicht
async function sendPlaylist() {
    // Timestamp-Request
    const response = await fetch(`${BASE_URL}/api/timestamp`);
    const data = await response.json();
    const serverTime = Number(data.timestamp);

    if (isNaN(serverTime)) {
        console.error("Ungültiger Zeitstempel vom Server:", data.timestamp);
        return;
    }

    if (!nextPlay?.start || isNaN(new Date(nextPlay.start).getTime())) {
        console.error("Ungültige Startzeit:", nextPlay?.start);
        return;
    }

    // Überprüfung wie lange gewartet wird
    const targetTime = new Date(nextPlay.start).getTime();
    let delay = targetTime - serverTime;

    let playContent = savedContent;
    let playDuration = contentDuration;

    // Wenn defaultPlay gespielt wird -> 1/100 sec Verzögerung
    if(playDefault || nextPlay == defaultPlay || delay > (defaultPlaylistData.duration + 2) * 1000){
        console.log("default");
        playDefault = true;
        isExtended = 0;
        delay = 10;
        playContent = defaultContent;
        playDuration = defaultContentDuration;
        times_play = 1;
    }

    console.log("delay: " + delay);
    //differnz von 1/10 sec wird akzeptiert
    if (delay <= -100) {
        console.log("Zeitpunkt bereits erreicht!");
        reset();
    } else {
        //warten bis zeitpunkt erreicht
        isSending = true;
        index = 0;
        if (timeoutId) clearTimeout(timeoutId); // Bereinige vorherigen Timeout
        timeoutId = setTimeout(loop, delay);
    }

    function loop() {
        if (!isSending) return; // Verhindert, dass mehrere Instanzen starten

        if(times_play_count < times_play){
            if(index < playContent.length){
                //console.log("index: " + index + ": " + playDuration[index]);

                let content = playContent[index];
                let duration = playDuration[index] * 1000;

                if (!content || content == null) {
                    console.error("Kein Content gefunden");
                    return;
                }

                sendContentOnClients(content);
                
                index ++;

                if (timeoutId) clearTimeout(timeoutId); // Bereinige vorherigen Timeout
                timeoutId = setTimeout(loop, duration);
            } 
            else{
                times_play_count ++;
                console.log(times_play_count);

                index = 0;

                if (timeoutId) clearTimeout(timeoutId); // Bereinige vorherigen Timeout
                timeoutId = setTimeout(loop, 1);
            }
        }
        else {
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

        data.map(play =>{
            if(!next){
                const dateString = play.start;
                const timestamp = new Date(dateString).getTime();

                const isExpired = time > timestamp;
                const isOlderThan7Days = (time - timestamp) > 7 * 24 * 60 * 60 * 1000;


                //wenn älter als 7 tage -> löschen
                if(isOlderThan7Days){
                    console.log("older");
                    console.log(play.id + "is getting deleted");
                    
                    const reqDel = apiurl + "/playlist/delete";
                    const bodyDel = {
                        table: 'play_playlist',
                        id: play.id
                    };

                    fetch(reqDel, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(bodyDel)
                    })
                        .then(response => {
                            if (!response.ok) throw new Error('Network response was not ok');
                            return response.json();
                        })
                        .then(data => {
                            console.log(data);                            
                        })
                        .catch(error => console.error('Error fetching data:', error));
                }

                if(!isExpired)
                    next=play;

                console.log(isExpired ? play.id + " Abgelaufen" : play.id + " Noch gültig");
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
        return data;
    } catch (error) {
        console.error('Error fetching Contains data:', error);
    }
}

//speichert die contentdaten in ein globales Array, speichert angegebene duration in array
async function saveContent(contains, contentArray, durationArray) {
    for(let i = 0; i < contains.length; i++){
        await fetchContentData(contains[i].content_ID).then(content =>{
            contentArray[i] = content;
            durationArray[i] = contains[i].duration;
        })
    }

   // console.log("content ", contentArray);
   // console.log("durattion ", durationArray);

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
        default: playDefault,
        contentData: content,
        clients: playClients,
        extended: isExtended
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

    if (timeoutId) clearTimeout(timeoutId); // Bereinige aktiven Timeout
    timeoutId = null;

    playClients = [];

    savedContent = [];
    contentDuration = [];
    isExtended = 0;

    times_play = 0;
    times_play_count = 0;

    nextPlay = null;
    
    playlistData = null;

    isSending = false;
    index = 0;

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
    fetchDefault()
});

async function fetchDefault() {
    try {
        const response = await fetch(`${apiurl}/playlist/getThis?table=play_playlist&id=1`);
        const data = await response.json();
        //console.log(data);
        defaultPlay = data[0];

        fetchDefaultPlaylistData();
        fetchDefaultContentData();

    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

async function fetchDefaultPlaylistData() {
    let req = apiurl + "/playlist/getThis?table=playlist&id=" + defaultPlay.playlist_ID;

    const response = await fetch(req);
    if (!response.ok) throw new Error("API-Fehler ClientName");
    const data = await response.json();

    defaultPlaylistData = data[0];
}

function fetchDefaultContentData(){


    fetchContainsData(defaultPlay.playlist_ID).then(contains =>{       //content aus playlistcontains
        saveContent(contains, defaultContent, defaultContentDuration).then(success=>{                       //dann content aus content-table holen und in array speichern
            if(success){
                setup();                                   //playlist senden (warten zum startzeitpunkt)
            }
        });
    });

}