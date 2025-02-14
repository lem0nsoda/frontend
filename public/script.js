let socket;
let clientID = null;

document.addEventListener('DOMContentLoaded', function () {
    // WebSocket-Verbindung herstellen
    socket = new WebSocket('ws://10.51.0.53:3000');
    socket.onopen = () => {
        console.log('Connected to the WebSocket server');
    };

    socket.onerror = function (error) {
        console.log('WebSocket-Fehler: ' + error);
    };

    socket.onmessage = function (e) {
        let message = JSON.parse(e.data);
        console.log(message);

        if (message.status === 'success') {
            clientID = message.clientID;
            console.log('ClientID registriert:', clientID);

            // Eingabefeld ausblenden
            document.querySelector("#clientInput").classList.add("hidden");

        } else if (message.status === 'error') {
            alert('ClientID schon vergeben! Gib eine andere ClientID ein!');
        }

        if (message.action === 'showContent') {
            showPlaylist(message);
        }

    };

    document.getElementById('sendButton').onclick = function () {
        const enteredID = document.getElementById('name').value;

        if (!enteredID) {
            alert("Bitte eine ClientID eingeben!");
            return;
        }

        if (socket.readyState === WebSocket.OPEN) {
            const message = { clientID_new: enteredID };
            socket.send(JSON.stringify(message));
            console.log("Client-ID gesendet:", enteredID);
        } else {
            console.error("WebSocket-Verbindung nicht geöffnet!");
        }
    };
});

function showPlaylist(message) {

    console.log("pidl", message.contentData);
    
    let content = document.querySelector("#content");
    content.classList.remove("hidden");
    content.innerHTML = "";

    // Content sichtbar machen und setzen
    content.style.display = 'block';
    content.src = message.currentContent;

}