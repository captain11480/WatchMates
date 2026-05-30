const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// ====================
// EXPRESS CONFIGURATION
// ====================
app.use(express.static(path.join(__dirname)));
// Serve static files from current directory
app.use(express.static(path.join(__dirname)));

// Route handlers for HTML pages
const serveHTML = (filename) => (req, res) => {
    res.sendFile(path.join(__dirname, filename));
};

app.get('/', serveHTML('index.html'));
app.get('/joinroom.html', serveHTML('joinroom.html'));
app.get('/watchroom.html', serveHTML('watchroom.html'));

// ====================
// DATA STORES
// ====================

const rooms = new Map();           // roomCode -> room object
const connectedUsers = new Map();  // socket.id -> roomCode

// ====================
// UTILITY FUNCTIONS
// ====================

/**
 * Generate a unique 6-character room code
 * @returns {string} Room code in format: A1B2C3
 */
function generateRoomCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    for (let i = 0; i < 6; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters.charAt(randomIndex);
    }
    
    // Ensure uniqueness
    while (rooms.has(result)) {
        result = generateRoomCode();
    }
    
    return result;
}

/**
 * Check if nickname is already taken in a room (case-insensitive)
 * @param {Map} users - Room users map
 * @param {string} nickname - Nickname to check
 * @returns {boolean} True if nickname exists
 */
function isNicknameTaken(users, nickname) {
    const existingNicknames = Array.from(users.values())
        .map(user => user.nickname.toLowerCase());
    return existingNicknames.includes(nickname.toLowerCase());
}

// ====================
// SOCKET.IO EVENT HANDLERS
// ====================

io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.id}`);
    
    // ====================
    // ROOM CREATION
    // ====================
    socket.on('createRoom', (data) => {
        const { roomName, nickname } = data;
        
        // Validate input
        if (!roomName || !nickname) {
            socket.emit('error', { 
                message: 'Room name and nickname are required' 
            });
            return;
        }
        
        // Generate unique room code
        const roomCode = generateRoomCode();
        
        // Create room object
        const room = {
            code: roomCode,
            name: roomName.trim(),
            users: new Map(),
            createdAt: new Date(),
            currentVideo: null,
            playbackState: {
                isPlaying: false,
                currentTime: 0,
                lastUpdate: null
            }
        };
        
        // Add creator as first user
        room.users.set(socket.id, {
            nickname: nickname.trim(),
            joinedAt: new Date(),
            socketId: socket.id
        });
        
        // Store room and user connections
        rooms.set(roomCode, room);
        socket.join(roomCode);
        connectedUsers.set(socket.id, roomCode);
        
        console.log(`🏠 Room ${roomCode} created by ${nickname}`);
        
        // Send success response
        socket.emit('roomCreated', {
            roomCode,
            roomName: room.name,
            nickname: nickname.trim()
        });
    });
    
    // ====================
    // ROOM JOINING
    // ====================
    socket.on('joinRoom', (data) => {
        const { roomCode, nickname } = data;
        
        // Validate input
        if (!roomCode || !nickname) {
            socket.emit('error', { 
                message: 'Room code and nickname are required' 
            });
            return;
        }
        
        const formattedRoomCode = roomCode.toUpperCase();
        const room = rooms.get(formattedRoomCode);
        
        // Check if room exists
        if (!room) {
            socket.emit('roomNotFound', { 
                message: 'Room not found. Please check the code.' 
            });
            return;
        }
        
        // Check for duplicate nickname
        if (isNicknameTaken(room.users, nickname)) {
            socket.emit('error', { 
                message: 'Nickname already taken in this room' 
            });
            return;
        }
        
        // Add user to room
        const userData = {
            nickname: nickname.trim(),
            joinedAt: new Date(),
            socketId: socket.id
        };
        
        room.users.set(socket.id, userData);
        socket.join(formattedRoomCode);
        connectedUsers.set(socket.id, formattedRoomCode);
        
        console.log(`👤 ${nickname} joined room ${formattedRoomCode} (${room.users.size} users)`);
        
        // Notify joining user
        socket.emit('roomJoined', {
            roomCode: room.code,
            roomName: room.name,
            nickname: userData.nickname,
            users: Array.from(room.users.values()),
            userCount: room.users.size
        });
        
        // Notify other users in room
        socket.to(formattedRoomCode).emit('userJoined', {
            nickname: userData.nickname,
            userId: socket.id,
            users: Array.from(room.users.values()),
            userCount: room.users.size
        });
    });
    
    // ====================
    // VIDEO CONTROL EVENTS
    // ====================
    socket.on('videoPlay', (data) => {
        const roomCode = connectedUsers.get(socket.id);
        if (roomCode) {
            socket.to(roomCode).emit('videoPlayed', data);
        }
    });
    
    socket.on('videoPause', (data) => {
        const roomCode = connectedUsers.get(socket.id);
        if (roomCode) {
            socket.to(roomCode).emit('videoPaused', data);
        }
    });
    
    socket.on('videoSync', (data) => {
        const roomCode = connectedUsers.get(socket.id);
        if (roomCode) {
            socket.to(roomCode).emit('videoSynced', data);
        }
    });
    
    // ====================
    // CHAT & MEDIA EVENTS
    // ====================
    socket.on('chatMessage', (data) => {
        const roomCode = connectedUsers.get(socket.id);
        if (roomCode) {
            // Broadcast to everyone in room including sender
            io.to(roomCode).emit('chatMessageReceived', {
                ...data,
                timestamp: Date.now()
            });
        }
    });
    
    socket.on('videoUploaded', (data) => {
        const roomCode = connectedUsers.get(socket.id);
        if (roomCode) {
            socket.to(roomCode).emit('videoChanged', data);
        }
    });
    
    // ====================
    // DISCONNECTION HANDLING
    // ====================
    socket.on('disconnect', () => {
        console.log(`❌ User disconnected: ${socket.id}`);
        
        const roomCode = connectedUsers.get(socket.id);
        if (!roomCode) return;
        
        const room = rooms.get(roomCode);
        if (!room) return;
        
        const user = room.users.get(socket.id);
        
        // Remove user from room
        room.users.delete(socket.id);
        connectedUsers.delete(socket.id);
        
        // Notify other users
        if (user) {
            socket.to(roomCode).emit('userLeft', {
                nickname: user.nickname,
                userId: socket.id,
                userCount: room.users.size
            });
        }
        
        // Clean up empty rooms after delay
        if (room.users.size === 0) {
            setTimeout(() => {
                if (rooms.get(roomCode)?.users.size === 0) {
                    rooms.delete(roomCode);
                    console.log(`🗑️  Room ${roomCode} deleted (empty)`);
                }
            }, 30000); // 30 seconds delay
        }
    });
});
// ====================
// YOUTUBE ROOM SUPPORT
// ====================
    // ====================
    // YOUTUBE ROOM SUPPORT
    // ====================
    
    socket.on('createYoutubeRoom', (data) => {
        const { roomName, nickname, youtubeId } = data;
        
        if (!roomName || !nickname || !youtubeId) {
            socket.emit('error', { message: 'All fields are required' });
            return;
        }
        
        const roomCode = generateRoomCode();
        
        const room = {
            code: roomCode,
            name: roomName.trim(),
            youtubeId: youtubeId,
            users: new Map(),
            createdAt: new Date()
        };
        
        room.users.set(socket.id, { nickname: nickname.trim(), socketId: socket.id });
        
        // Store in separate Map for YouTube rooms
        if (!global.youtubeRooms) global.youtubeRooms = new Map();
        global.youtubeRooms.set(roomCode, room);
        
        socket.join(`youtube_${roomCode}`);
        connectedUsers.set(socket.id, `youtube_${roomCode}`);
        
        socket.emit('youtubeRoomCreated', {
            roomCode: roomCode,
            youtubeId: youtubeId
        });
        
        console.log(`🎬 YouTube room ${roomCode} created with video ${youtubeId}`);
    });
    
    socket.on('joinYoutubeRoom', (data) => {
        const { roomCode, nickname } = data;
        
        if (!global.youtubeRooms) global.youtubeRooms = new Map();
        const room = global.youtubeRooms.get(roomCode);
        
        if (!room) {
            socket.emit('roomNotFound', { message: 'Room not found' });
            return;
        }
        
        room.users.set(socket.id, { nickname: nickname.trim(), socketId: socket.id });
        socket.join(`youtube_${roomCode}`);
        connectedUsers.set(socket.id, `youtube_${roomCode}`);
        
        socket.emit('youtubeRoomJoined', {
            roomCode: room.code,
            roomName: room.name,
            youtubeId: room.youtubeId,
            nickname: nickname.trim()
        });
        
        socket.to(`youtube_${roomCode}`).emit('userJoined', {
            nickname: nickname.trim(),
            userCount: room.users.size
        });
        
        console.log(`👤 ${nickname} joined YouTube room ${roomCode}`);
    });
    
    socket.on('youtubePlay', (data) => {
        const { roomCode } = data;
        socket.to(`youtube_${roomCode}`).emit('youtubePlayed');
    });
    
    socket.on('youtubePause', (data) => {
        const { roomCode } = data;
        socket.to(`youtube_${roomCode}`).emit('youtubePaused');
    });
    
    socket.on('youtubeSync', (data) => {
        const { roomCode, currentTime } = data;
        socket.to(`youtube_${roomCode}`).emit('youtubeSynced', { currentTime });
    });


// ====================
// SERVER STARTUP
// ====================
// ====================
// SERVER STARTUP
// ====================

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`🚀 VibeMates server running on port ${PORT}`);
    console.log(`🔌 Socket.IO server ready for connections`);
    console.log(`🌐 Local: http://localhost:${PORT}`);
    console.log(`📱 Network: http://${getLocalIP()}:${PORT}`);
});

/**
 * Get local IP address for network access
 * @returns {string} Local IP address
 */
function getLocalIP() {
    const interfaces = require('os').networkInterfaces();
    
    for (const interfaceName in interfaces) {
        for (const iface of interfaces[interfaceName]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    
    return 'localhost';
}
