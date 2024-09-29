const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { MongoClient } = require('mongodb');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const mongoUrl = 'mongodb+srv://yazanaljundi05:Espace2008.@cluster0.zxnvj.mongodb.net/gameDB?retryWrites=true&w=majority&tls=true&appName=Cluster0';
const dbName = 'gameDB';
let db;

// Connect to MongoDB
async function connectToDatabase() {
    try {
        const client = await MongoClient.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
        db = client.db(dbName);
        console.log('Connected to database');
    } catch (err) {
        console.error('Error connecting to MongoDB:', err);
        process.exit(1); // Exit the process if connection fails
    }
}

// Serve static files (your HTML and JS files)
app.use(express.static(__dirname));

// Cache player data in memory
let players = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join', async ({playerId, playerColor, playerName}) => {
        if (!players[playerId]) {
            players[playerId] = { playerId, x: 20, y: 20, socketID: socket.id, color: playerColor, name:playerName}; // Default position
        }

        socket.emit('init', players[playerId]);
        console.log(`${playerId} joined!`);

        // Broadcast the updated list of all players
        io.emit('updateAllPlayers', players);
    });

    // Handle player movement
    socket.on('move', (data) => {
        const player = players[data.playerId];
        if (player) {
            // Update player position based on the direction
            if (data.direction === 'right') player.x += 2.5;
            else if (data.direction === 'left') player.x -= 2.5;
            else if (data.direction === 'up') player.y -= 2.5;
            else if (data.direction === 'down') player.y += 2.5;

            // Broadcast updated player to all clients
            io.emit('updateAllPlayers', players);
        }
    });

    socket.on('disconnect', () => {
        for (let playerId in players) {
            if (players[playerId].socketID === socket.id) {
                delete players[playerId];
                io.emit('updateAllPlayers', players);
                break;
            }
        }
    });

    socket.on('leave', (playerId) => {
        delete players[playerId];
        io.emit('updateAllPlayers', players);
    });
});

// Periodically save player positions to the database
setInterval(async () => {
    if (db && Object.keys(players).length > 0) {
        const bulkOps = Object.values(players).map((player) => ({
            updateOne: {
                filter: { playerId: player.playerId },
                update: { $set: { x: player.x, y: player.y } },
                upsert: true,
            },
        }));
        await db.collection('players').bulkWrite(bulkOps);
        console.log('Player positions saved to database');
    }
}, 10000); // Save every 10 seconds

// Start the server
connectToDatabase().then(() => {
    server.listen(3000, () => {
        console.log('Server is running on port 3000');
    });
});
