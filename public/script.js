
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
        let message = e.data;

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
            const videoElement = document.getElementById('videoElement');
            const videoSource = document.getElementById('videoSource');

            // Video-Quelle
            videoSource.src = message.video;

            // Video laden und abspielen
            videoElement.load();
            videoElement.play();

            console.log(`Videoqulle: ${message.video}`);
            document.getElementById('videoElement').style.display = 'block';
        }

        if (message.action === 'showDia') {
            const img = document.getElementById('image');
            console.log('Diashow Bild:', message.currentImage);

            // Bild sichtbar machen und setzen
            img.style.display = 'block';
            img.src = message.currentImage;
        }

        // Nachrichten im Chat anzeigen
        if (message.sender && message.text) {
            document.getElementById('messages').innerHTML += `<li>${message.sender}: ${message.text}</li>`;
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