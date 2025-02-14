const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const http = require('http');
const fs = require('fs');
const mime = require('mime-types');

const app = express();
const hostname = '10.51.0.53';
const port = 3000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const apiurl = "https://digital-signage.htl-futurezone.at/api/index.php";

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

wss.on('connection', async function connection(ws) {

    //CLIENTID
    ws.on('message', async function incoming(message) {
        try {
            let parsedMessage = JSON.parse(message);
            let clientID_new = parsedMessage.clientID_new;

            // API-Aufruf zur Überprüfung der ClientID
            const response = await fetch(`${apiurl}/client/getThis?id=${clientID_new}`);
            if (!response.ok) throw new Error("API-Fehler ClientID");
            const data = await response.json();

            if (!data || data.length === 0) {
                ws.send(JSON.stringify({ status: 'error', message: 'ClientID existiert nicht' }));
                return;
            }

            const clientStatus = data[0].status;
            const clientID = data[0].id;

            //console.log(clientStatus);
            //console.log("id  " + clientID);

            if (clientStatus == 1) {
                ws.send(JSON.stringify({ status: 'error', message: 'Neue Client ID eingeben, diese ist schon vergeben' }));
                return;
            }

            //console.log(JSON.stringify({ id: clientID, status: 1 }));

            // Client als online in der API markieren
            const responseUpdate = await fetch(`${apiurl}/client/update`, {
                method: 'POST',
                headers: { 'Client-Status': 'application/json' },
                body: JSON.stringify({ 'id': clientID, 'status': 1 })
            });

            if (!responseUpdate.ok) throw new Error("API-Fehler ClientID");
            const dataUpdate = await responseUpdate.json();

            //console.log(dataUpdate);

            // API-Aufruf zur Überprüfung der ClientID
            const responsenew = await fetch(`${apiurl}/client/getThis?id=${clientID_new}`);
            if (!responsenew.ok) throw new Error("API-Fehler ClientID");
            const datanew = await responsenew.json();

            //console.log(datanew[0].status);


            ws.send(JSON.stringify({ status: 'success', clientID: clientID_new }));
            console.log(`Client ${clientID_new} verbunden.`);

            sendPlaylist(ws);
        } catch (error) {
            console.error("Fehler:", error);
            ws.send(JSON.stringify({ status: 'error', message: 'Serverfehler' }));
        }
    });

    ws.on('close', async () => {
        console.log("Client getrennt, Status offline");
        try {
            await fetch(`${apiurl}/client/update`, {
                method: 'POST',
                headers: { 'Client-Status': 'application/json' },
                body: JSON.stringify({ 'id': clientID, 'status': 0 })
            });
        } catch (error) {
            console.error("Fehler beim Aktualisieren des Status:", error);
        }
    });
});

//ZEITPLAN

async function fetchSchedule(id) {
    //console.log("ahhh");

    try {
        //alle schedules holen
        const responseSched = await fetch(`${apiurl}/playlist/get?table=play_playlist&limit=30`);
        const dataSched = await responseSched.json();

        console.log(dataSched);
        return data[0];
    } catch (error) {
        console.error('Error fetching data:', error);
    }

    //zeitpläne auf welcher der aktuelleste ist (startzeitpunkt)

    // aus nächsten zeitplan mit startzeitpunkt die playlist & clients holen

    //kontrolle zeit, starten der playlist
    //sendPlaylist();   //in dieser funktion bei api lokale variable mit playlistid aus zeitplan

    //wenn zeitplan 7 tage abgelaufen - zeitplan aus datenbank löschen
}


// PLAYLIST
async function sendPlaylist(ws) {
    try {
        const response = await fetch(`${apiurl}/playlist/getBy?table=playlist_contains&is=25&where=playlist_ID`);
        if (!response.ok) throw new Error("Fehler beim Abrufen der Playlist");
        const playlist = await response.json();

        console.log(playlist);

        if (!playlist || playlist.length == 0) {
            console.error("KeinePlaylist gefunden");
            return;
        }

        let index = 0;

        function loop() {

            if(index < playlist.length){
                const duration = 0;

                let play = playlist[index];

                    //console.log(play.content_ID);
                    
                    const content_ID = play.content_ID;
                    
                    fetchContent(content_ID).then(content => {
                        //console.log("oben", content.duration);


                        if (!content || content == null) {
                            console.error("Kein COntent gefunden");
                            return;
                        }
                        //console.log("ahhh");

                        let duration = content.duration;

                        console.log("Dur" + duration);

                        //nachricht an script zur anzeige  
                        let contentAnzeigen = {
                            action: 'showContent',
                            contentData: content
                        };

                        wss.clients.forEach(function each(ws) {
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(JSON.stringify(contentAnzeigen));
                            }
                        });

                    }); 

                    index ++;
                    
                setTimeout(loop, duration); 

            }
        }
        loop();
    } catch (error) {
        console.error('Fehler beim Abrufen der Playlist:', error);
    }
}
async function fetchContent(id) {
    //console.log("ahhh");

    try {
        const response = await fetch(`${apiurl}/content/getThis?id=` + id);
        const data = await response.json();
        //console.log(data);
        return data[0];
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

server.listen(port, hostname, () => {
    console.log(`Server läuft unter http://${hostname}:${port}/`);
});
