
document.addEventListener('DOMContentLoaded', function() {
    // WebSocket-Verbindung herstellen
    //const socket = new WebSocket('ws://192.168.2.209:3000'); // daham
    const socket = new WebSocket('ws://10.13.243.238:3000'); // daham


    socket.onopen = () => {
        console.log('Connected to the WebSocket server');
    };

    socket.onerror = function(error) {
        console.log('WebSocket-Fehler: ' + error);
    };

    socket.onmessage = function(e) {
        let message = e.data;
        let content = document.getElementById("sugardaddy");


        if (message.action === 'showVideo') {
            const videoElement = document.createElement('video');
            const videoSource = document.createElement('source');

            // Video-Quelle
            videoSource.src = message.video;

            display.appendChild(videoElement);
            videoElement.appendChild(videoSource);

            // Video laden und abspielen
            videoElement.load();
            videoElement.play();

            console.log(`Videoqulle: ${message.video}`);

            // Video sichtbar machen
            video.id = 'vid';
            video.style.display = 'block';
        }

        if (message.action === 'showDia') {
            display.remove();

            let image = document.create('img');
            console.log('Diashow Bild:', message.currentImage);

            // Bild sichtbar machen und setzen
            image.id = 'imageDisplay';
            image.style.display = 'block';
            image.src = message.currentImage;
            
            display.appendChild(image);
        }

        // Nachrichten im Chat anzeigen
        if (message.sender && message.text) {
            document.getElementById('messages').innerHTML += `<li>${message.sender}: ${message.text}</li>`;
        }
    };

    document.getElementById('sendButton').onclick = function() {
        const message = {
            sender: document.getElementById('ClientID').value,
            text: document.getElementById('message').value
        };
        socket.send(JSON.stringify(message));
    };
});