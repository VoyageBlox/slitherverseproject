const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const MAP_SIZE = 3000;
let players = {};
let foods = [];

// Seed Initial Food
for (let i = 0; i < 300; i++) {
    spawnFood();
}

function spawnFood() {
    const colors = ['#ff0055', '#00ffcc', '#ffcc00', '#ff00ff', '#00ff00', '#0077ff'];
    foods.push({
        id: Math.random().toString(36).substring(2, 9),
        x: Math.random() * MAP_SIZE,
        y: Math.random() * MAP_SIZE,
        radius: Math.random() * 3 + 4,
        color: colors[Math.floor(Math.random() * colors.length)]
    });
}

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('joinGame', (data) => {
        const colors = ['#ff3366', '#33ccff', '#33ff99', '#ff9933', '#cc33ff'];
        
        // Spawn Snake configurations
        let startX = Math.random() * (MAP_SIZE - 200) + 100;
        let startY = Math.random() * (MAP_SIZE - 200) + 100;
        
        players[socket.id] = {
            id: socket.id,
            name: data.name,
            x: startX,
            y: startY,
            angle: 0,
            speed: 3,
            radius: 12,
            score: 10,
            color: colors[Math.floor(Math.random() * colors.length)],
            segments: []
        };

        // Initialize segments array layout positions
        for(let i=0; i<15; i++) {
            players[socket.id].segments.push({x: startX, y: startY});
        }
    });

    socket.on('updateAngle', (angle) => {
        if (players[socket.id]) {
            players[socket.id].angle = angle;
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        console.log(`User disconnected: ${socket.id}`);
    });
});

// Primary Game Server Loop Calculations (Run at 60Hz)
setInterval(() => {
    Object.values(players).forEach(player => {
        // Move Snake Head location
        player.x += Math.cos(player.angle) * player.speed;
        player.y += Math.sin(player.angle) * player.speed;

        // Boundary checks constraints
        if (player.x < 0) player.x = 0;
        if (player.x > MAP_SIZE) player.x = MAP_SIZE;
        if (player.y < 0) player.y = 0;
        if (player.y > MAP_SIZE) player.y = MAP_SIZE;

        // Shift Snake Body segment array nodes
        player.segments.push({ x: player.x, y: player.y });
        
        // Dynamic Segment sizing relative to growing score scale
        let targetLength = 15 + Math.floor(player.score / 5);
        while (player.segments.length > targetLength) {
            player.segments.shift();
        }

        // Food Intake Collisions Check
        for (let i = foods.length - 1; i >= 0; i--) {
            let food = foods[i];
            let dist = Math.hypot(player.x - food.x, player.y - food.y);
            if (dist < player.radius + food.radius) {
                player.score += food.radius * 0.5;
                player.radius = 12 + (player.score * 0.05); // Smooth scaling thickness
                foods.splice(i, 1);
                spawnFood();
            }
        }
    });

    // Broadcast update states payload to clients
    io.emit('gameUpdate', { players, foods });
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Game backend active on port ${PORT}`);
});