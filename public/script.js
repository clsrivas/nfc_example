const nfcOutput = document.getElementById("nfc-output");
const writeButton = document.getElementById("write-button");
const nfcDataInput = document.getElementById("nfc-data");

let isConnected = false;
const socket = new WebSocket("ws://localhost:3000");

socket.onmessage = (event) => {
    try {
        const message = JSON.parse(event.data);

        if (message.type === "read") {
            nfcOutput.innerHTML = `Tarjeta detectada:<br>
                                 UID: ${message.uid}<br>
                                 Datos: ${message.data || 'No hay datos'}`;
            console.log("UID recibido:", message.uid);
            console.log("Datos leídos:", message.data);
        } else if (message.success) {
            nfcOutput.textContent = `Datos escritos correctamente: ${message.written}`;
            console.log("Escritura NFC exitosa:", message);
        } else if (message.error) {
            nfcOutput.textContent = `Error: ${message.error}`;
            console.error("Error NFC:", message.error);
        }
    } catch (error) {
        console.error("Error processing message:", error);
    }
};

socket.onopen = () => {
    console.log("Conectado al servidor NFC");
    isConnected = true;
    nfcOutput.textContent = "Lector NFC conectado";
};

socket.onclose = () => {
    console.log("Desconectado del servidor NFC");
    isConnected = false;
    nfcOutput.textContent = "Desconectado del lector NFC";
};

socket.onerror = (error) => {
    console.error("Error en WebSocket:", error);
    nfcOutput.textContent = "Error de conexión";
};

writeButton.addEventListener("click", () => {
    if (!isConnected) {
        alert("No hay conexión con el servidor NFC. Intente nuevamente.");
        return;
    }

    const textToWrite = nfcDataInput.value.trim();
    
    if (!textToWrite) {
        alert("Ingresa un texto para escribir en la tarjeta.");
        return;
    }

    if (textToWrite.length > 500) {
        alert("El texto debe tener máximo 500 caracteres.");
        return;
    }

    try {
        socket.send(JSON.stringify({ type: "write", data: textToWrite }));
        nfcOutput.textContent = "Acerque una tarjeta para escribir...";
    } catch (error) {
        console.error("Error al enviar datos:", error);
        nfcOutput.textContent = "Error al enviar datos al servidor";
    }
});