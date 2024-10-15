
document.addEventListener('DOMContentLoaded', function() {
    // WebSocket-Verbindung herstellen
    //const socket = new WebSocket('ws://192.168.2.209:3000'); // daham
    const socket = new WebSocket('ws://10.13.243.238:3000'); // schui
    var clientID = null;

    socket.onopen = () => {
        console.log('Connected to the WebSocket server');
    };

    socket.onerror = function(error) {
        console.log('WebSocket-Fehler: ' + error);
    };

    socket.onmessage = function(e) {
        let message = JSON.parse(e.data);

        console.log(message);

        if (message.status === 'success') {
            clientID = message.clientID;
            console.log('ClientID: ' + clientID);

            // Eingabefeld für die ClientID ausblenden, nachdem eine ID registriert wurde
            document.getElementById('ClientIDInput').style.display = 'none';
        } else if (message.status === 'error') {
            console.log('ClientID schon vergeben! Gib eine andere ClientID ein!');
        }

        if (message.action === 'showVideo') {
            console.log(`Videoqulle: ${message.video}`);
            
            let content = document.querySelector("#content");

            // Einblenden
            content.classList.remove("hidden");
            content.classList.add("shown");
            //alle inhalte von content löschen(überschreiben)
            content.innerHTML = "";

            // Bild erzeugen
            let vid = document.createElement("video");
            let source = document.createElement("source");
            source.src = message.video;

            //an content einbinden
            vid.appendChild ( source );
            content.appendChild ( vid );

            //Video laden und abspielen
            vid.load();
            vid.play();

            document.querySelector("#inputs").classList.remove("shown");
            document.querySelector("#inputs").classList.add("hidden");
        }

        if (message.action === 'showDia') {
            console.log('Diashow Bild:', message.currentImage);

            let content = document.querySelector("#content");

            // Einblenden
            content.classList.remove("hidden");
            content.classList.add("shown");
            content.innerHTML = "";

            // Bild erzeugen
            let img = document.createElement("img");
            img.src = message.currentImage;
            content.appendChild ( img );

            document.querySelector("#inputs").classList.remove("shown");
            document.querySelector("#inputs").classList.add("hidden");
        }
    };

    document.getElementById('sendButton').onclick = function() {
        const enteredID = document.getElementById('ClientIDInput').value;
        const text = document.getElementById('message').value;

        // Client-ID senden, wenn noch keine vorhanden ist
        if (!clientID && enteredID) {
            const message = {
                clientID: enteredID,
                text: text
            };
            socket.send(JSON.stringify(message));
            document.getElementById('message').value = ''; // Nachrichteneingabe leeren
        }
        // Nachricht mit der bereits registrierten Client-ID senden
        else if (clientID) {
            const message = {
                clientID: clientID,
                text: text
            };
            socket.send(JSON.stringify(message));
            document.getElementById('message').value = ''; // Nachrichteneingabe leeren
        }
    };
});