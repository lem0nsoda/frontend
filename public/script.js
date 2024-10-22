
let socket;

document.addEventListener('DOMContentLoaded', function() {
    // WebSocket-Verbindung herstellen
    //const socket = new WebSocket('ws://192.168.2.209:3000'); // daham
    socket = new WebSocket('ws://10.13.243.238:3000'); // schui
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
            document.querySelector("#inputs").classList.remove("shown");
            document.querySelector("#inputs").classList.add("hidden");

            //style setzen 
            
        } else if (message.status === 'error') {
            console.log('ClientID schon vergeben! Gib eine andere ClientID ein!');
        }

        if (message.action === 'showVideo') {
            console.log(`Videoqulle: ${message.video}`);

            //dateipfad für <img> mit base64 
            const videoSrc = `data:${message.fileType};base64,${message.data}`;
            
            let content = document.querySelector("#content");

            // Einblenden
            content.classList.remove("hidden");
            content.classList.add("shown");
            //alle inhalte von content löschen(überschreiben)
            content.innerHTML = "";

            // Bild erzeugen
            let vid = document.createElement("video");
            let source = document.createElement("source");
            source.src = videoSrc;

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
            //source in console ausgeben
            console.log('Diashow Bild:', message.currentImage);

            //dateipfad für <img> mit base64 
            const imageSrc = `data:${message.fileType};base64,${message.data}`;

            let content = document.querySelector("#content");

            // Einblenden
            content.classList.remove("hidden");
            content.classList.add("shown");
            content.innerHTML = "";

            // Bild erzeugen
            let img = document.createElement("img");
            img.src = imageSrc;
            content.appendChild ( img );

            //inputfelder von ID entfernen
            document.querySelector("#inputs").classList.remove("shown");
            document.querySelector("#inputs").classList.add("hidden");
        }
    };

    document.getElementById('sendButton').onclick = function() {
        const enteredID = document.getElementById('ClientIDInput').value;

        // Client-ID senden, wenn noch keine vorhanden ist
        if (!clientID && enteredID) {
            const message = {
                clientID: enteredID
            };
            socket.send(JSON.stringify(message));
        }
        // Nachricht mit der bereits registrierten Client-ID senden
        else if (clientID) {
            const message = {
                clientID: clientID
            };

            socket.send(JSON.stringify(message));
        }
    };
});