let socket;
let clientID = null;
let clientName = null;
let clientX = null;
let clientY = null;

let playlistName = null;
let nextStart = null;

let userInterfaceButton = document.querySelector("#userInterfaceButton");

document.addEventListener('DOMContentLoaded', function () {
    // WebSocket-Verbindung herstellen
    socket = new WebSocket('ws://192.168.100.44:3000');
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
            clientName = message.clientName;
            
            console.log('Client-Name registriert:', clientName);
            console.log('Message:', message.message);

            // Eingabefeld ausblenden
            document.getElementById("clientInput").style.display = "none";

            //setzen der variablen
            if(!clientID)
                clientID = message.clientID;
            if(!clientName)
                clientName = message.clientName;
            if(!clientX)
                clientX = message.clientX;
            if(!clientY)
                clientY = message.clientY;

            showClientInfo();

        } else if (message.status === 'error') {
            alert('clientName schon vergeben! Gib eine andere clientName ein!');
        }

        if (message.action === 'showContent') {
            if((message.clients.includes(clientID) || message.default == true) && clientID != null){
                userInterfaceButton.setAttribute("class", "hidden");
                console.log("play");
                if(message.contentData.type.includes("image")){
                    console.log("image");
                    showImage(message);
                } else if(message.contentData.type.includes("video")){

                    console.log("video");
                    showVideo(message);
                }
            }
        } else if (message.action === 'showClientInfo') {
            
            showClientInfo();           
        }  else if (message.action === 'info') {
            
            if(message.playlistName && !playlistName)
                playlistName = message.playlistName;
            if(message.nextStart && !nextStart)
                nextStart = message.nextStart;

            console.log("p: " + playlistName + " s : " +nextStart);

            showClientInfo();
        }else if(message.action === 'reset'){

            playlistName = null;
            nextStart = null;

            showClientInfo();
        }

    };

    document.getElementById('sendButton').onclick = function () {

        const enteredName = document.getElementById('name').value;

        console.log("Available Width: " + screen.availWidth);
        console.log("Available Height: " + screen.availHeight);

        if (!enteredName) {
            alert("Bitte einen ClientName eingeben!");
            return;
        }

        if (socket.readyState === WebSocket.OPEN) {
            const message = { 
                clientName_new: enteredName,
                width: screen.availWidth,
                height: screen.availHeight
             };
            socket.send(JSON.stringify(message));
            console.log("Client-Name gesendet:", enteredName);
        } else {
            console.error("WebSocket-Verbindung nicht geöffnet!");
        }
    };

    function showClientInfo() {
        userInterfaceButton.setAttribute("class", "btn btn-primary shown");

        let content = document.querySelector("#content");
        content.classList.remove("hidden");
        content.innerHTML = "";

        let infoDiv = document.createElement("div");
        infoDiv.classList.add("client-info");

        let clientIdText = document.createElement("p");
        clientIdText.innerText = "Client ID: " + clientID;

        let clientNameText = document.createElement("p");
        clientNameText.innerText = "Name: " + clientName;

        
        let clientPositionText = document.createElement("p");
        clientPositionText.innerText = "Position: " + clientX + " x " + clientY;

        if(playlistName && nextStart){
            let clientStartText = document.createElement("p");
            clientStartText.innerText = "Next Playlist " + playlistName + " Start: " + nextStart;

            infoDiv.appendChild(clientStartText);
        }
        infoDiv.appendChild(clientIdText);
        infoDiv.appendChild(clientNameText);
        infoDiv.appendChild(clientPositionText);
        content.appendChild(infoDiv);
    }

    function showImage(message) {

        let content = document.querySelector("#content");
        content.classList.remove("hidden");
        content.innerHTML = "";

        let img = document.createElement("img");
        img.src = message.contentData.data;
        img.alt = "Playlist-Inhalt";
        img.classList.add("img-fluid");
        img.classList.add("fullscreen-image");
        
        img.classList.add("varschieben");

        content.appendChild(img);
    }

    function showVideo(message) {
    
        let content = document.querySelector("#content");
        content.classList.remove("hidden");
        content.innerHTML = ""; // Vorherigen Inhalt löschen
    
        let video = document.createElement("video");
        video.src = message.contentData.data;
        video.autoplay = true; // Startet automatisch
        video.loop = true; // Optional: Wiederholt das Video
        video.classList.add("video-fluid");
    
        content.appendChild(video);
    }
});