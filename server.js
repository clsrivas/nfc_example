const WebSocket = require('ws');
const { NFC } = require('nfc-pcsc');

const wss = new WebSocket.Server({ port: 3000 });
const nfc = new NFC();

// Constants for NTAG215
const PAGE_SIZE = 4; // 4 bytes per page
const START_PAGE = 4; // User memory starts at page 4
const END_PAGE = 129; // Last user memory page
const TOTAL_USER_MEMORY = (END_PAGE - START_PAGE + 1) * PAGE_SIZE; // 504 bytes

const clients = new Set();

// Función para limpiar la memoria de la tarjeta
async function clearCardMemory(reader) {
    const emptyPage = Buffer.alloc(PAGE_SIZE, 0); // Crea un buffer de 4 bytes lleno de ceros
    
    // Limpia página por página
    for (let page = START_PAGE; page <= END_PAGE; page++) {
        try {
            await reader.write(page, emptyPage);
        } catch (error) {
            throw new Error(`Error clearing page ${page}: ${error.message}`);
        }
    }
}

nfc.on('reader', reader => {
    console.log(`${reader.reader.name} device attached`);

    reader.on('card', async card => {
        console.log(`Card detected: ${card.uid}`);
        
        try {
            // Read all user memory pages
            const data = await reader.read(START_PAGE, TOTAL_USER_MEMORY);
            // Convert to string and remove null bytes
            const textData = data.toString().replace(/\0/g, '');
            
            const message = JSON.stringify({
                type: 'read',
                uid: card.uid,
                data: textData
            });
            
            clients.forEach(client => client.send(message));
        } catch (error) {
            console.error('Error reading card:', error);
            clients.forEach(client => client.send(JSON.stringify({
                type: 'read',
                uid: card.uid,
                data: 'Error al leer datos'
            })));
        }
    });

    reader.on('error', err => {
        console.error(`Reader error: ${err}`);
    });

    // Handle NFC write requests
    wss.on('connection', ws => {
        clients.add(ws);
        console.log('New client connected');

        ws.on('message', async message => {
            try {
                const data = JSON.parse(message);
                
                if (data.type === 'write') {
                    try {
                        // Primero, limpiar toda la memoria
                        await clearCardMemory(reader);
                        console.log('Card memory cleared successfully');

                        const textData = Buffer.from(data.data);
                        
                        // Calculate how many pages we need
                        const dataLength = textData.length;
                        const pagesNeeded = Math.ceil(dataLength / PAGE_SIZE);
                        
                        // Write data in chunks of 4 bytes (1 page)
                        for (let i = 0; i < pagesNeeded; i++) {
                            const start = i * PAGE_SIZE;
                            let chunk = textData.slice(start, start + PAGE_SIZE);
                            
                            // Pad the last chunk with zeros if needed
                            if (chunk.length < PAGE_SIZE) {
                                const padding = Buffer.alloc(PAGE_SIZE - chunk.length);
                                chunk = Buffer.concat([chunk, padding]);
                            }
                            
                            // Write each page
                            await reader.write(START_PAGE + i, chunk);
                        }
                        
                        ws.send(JSON.stringify({
                            success: true,
                            written: data.data
                        }));
                    } catch (error) {
                        ws.send(JSON.stringify({
                            success: false,
                            error: 'Error writing to card: ' + error.message
                        }));
                    }
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        });

        ws.on('close', () => {
            clients.delete(ws);
            console.log('Client disconnected');
        });
    });
});

nfc.on('error', err => {
    console.error('NFC error:', err);
});

console.log('NFC Server started on port 3000');