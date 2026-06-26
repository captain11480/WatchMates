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

// Route handlers for HTML pages
const serveHTML = (filename) => (req, res) => {
    res.sendFile(path.join(__dirname, filename));
};

app.get('/', serveHTML('index.html'));
app.get('/joinroom.html', serveHTML('joinroom.html'));
app.get('/watchroom.html', serveHTML('watchroom.html'));
app.get('/online.html', serveHTML('online.html'));
app.get('/youtube-room.html', serveHTML('youtube-room.html'));

// ====================
// DATA STORES
// ====================

const rooms = new Map();
const youtubeRooms = new Map();
const connectedUsers = new Map();

// ====================
// UTILITY FUNCTIONS
// ====================

function generateRoomCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

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
    // CREATE ROOM
    // ====================
    socket.on('createRoom', (data) => {
        const { roomName, nickname } = data;
        
        console.log(`📥 Create room: ${nickname} -> ${roomName}`);
        
        if (!roomName || !nickname) {
            socket.emit('error', { message: 'Room name and nickname are required' });
            return;
        }
        
        let roomCode;
        let attempts = 0;
        do {
            roomCode = generateRoomCode();
            attempts++;
        } while (rooms.has(roomCode) && attempts < 100);
        
        const room = {
            code: roomCode,
            name: roomName.trim(),
            users: new Map(),
            createdAt: Date.now(),
            currentVideo: null
        };
        
        room.users.set(socket.id, { 
            nickname: nickname.trim(), 
            joinedAt: Date.now(), 
            socketId: socket.id 
        });
        
        rooms.set(roomCode, room);
        socket.join(roomCode);
        connectedUsers.set(socket.id, roomCode);
        
        console.log(`🏠 Room ${roomCode} created by ${nickname}`);
        console.log(`📊 Active rooms: ${rooms.size}`);
        console.log(`📊 Room codes: ${Array.from(rooms.keys()).join(', ')}`);
        
        socket.emit('roomCreated', { 
            roomCode, 
            roomName: room.name, 
            nickname: nickname.trim() 
        });
    });
    
    // ====================
    // JOIN ROOM
    // ====================
    socket.on('joinRoom', (data) => {
        const { roomCode, nickname } = data;
        
        console.log(`📥 Join request: ${nickname} -> ${roomCode}`);
        
        if (!roomCode || !nickname) {
            socket.emit('error', { message: 'Room code and nickname are required' });
            return;
        }
        
        const formattedRoomCode = roomCode.toUpperCase();
        const room = rooms.get(formattedRoomCode);
        
        console.log(`🔍 Looking for room: ${formattedRoomCode}, Found: ${!!room}`);
        console.log(`📊 All rooms: ${Array.from(rooms.keys()).join(', ')}`);
        
        if (!room) {
            console.log(`❌ Room not found: ${formattedRoomCode}`);
            socket.emit('roomNotFound', { message: 'Room not found. Please check the code.' });
            return;
        }
        
        if (isNicknameTaken(room.users, nickname)) {
            socket.emit('error', { message: 'Nickname already taken in this room' });
            return;
        }
        
        const userData = { 
            nickname: nickname.trim(), 
            joinedAt: Date.now(), 
            socketId: socket.id 
        };
        
        room.users.set(socket.id, userData);
        socket.join(formattedRoomCode);
        connectedUsers.set(socket.id, formattedRoomCode);
        
        console.log(`👤 ${nickname} joined room ${formattedRoomCode} (${room.users.size} users)`);
        
        // Send room data to joining user
        const userList = Array.from(room.users.values()).map(u => u.nickname);
        socket.emit('roomJoined', {
            roomCode: room.code,
            roomName: room.name,
            nickname: userData.nickname,
            users: userList,
            userCount: room.users.size
        });
        
        // Notify others
        socket.to(formattedRoomCode).emit('userJoined', {
            nickname: userData.nickname,
            userId: socket.id,
            userCount: room.users.size
        });
    });
    
    // ====================
    // VIDEO CONTROLS
    // ====================
    socket.on('videoPlay', (data) => {
        const roomCode = connectedUsers.get(socket.id);
        if (roomCode && rooms.has(roomCode)) {
            console.log(`▶️ Play in ${roomCode}`);
            socket.to(roomCode).emit('videoPlayed', data);
        }
    });
    
    socket.on('videoPause', (data) => {
        const roomCode = connectedUsers.get(socket.id);
        if (roomCode && rooms.has(roomCode)) {
            console.log(`⏸️ Pause in ${roomCode}`);
            socket.to(roomCode).emit('videoPaused', data);
        }
    });
    
    socket.on('videoSync', (data) => {
        const roomCode = connectedUsers.get(socket.id);
        if (roomCode && rooms.has(roomCode)) {
            console.log(`🔄 Sync in ${roomCode} to ${data.currentTime}`);
            socket.to(roomCode).emit('videoSynced', data);
        }
    });
    
    // ====================
    // CHAT
    // ====================
    socket.on('chatMessage', (data) => {
        const roomCode = connectedUsers.get(socket.id);
        console.log(`💬 Chat: ${data.nickname} in ${roomCode}: ${data.message}`);
        if (roomCode) {
            io.to(roomCode).emit('chatMessageReceived', { 
                ...data, 
                timestamp: Date.now() 
            });
        }
    });
    
    // ====================
    // YOUTUBE ROOMS
    // ====================
    socket.on('createYoutubeRoom', (data) => {
        const { roomName, nickname, youtubeId } = data;
        
        if (!roomName || !nickname || !youtubeId) {
            socket.emit('error', { message: 'All fields are required' });
            return;
        }
        
        let roomCode;
        let attempts = 0;
        do {
            roomCode = generateRoomCode();
            attempts++;
        } while (youtubeRooms.has(roomCode) && attempts < 100);
        
        const room = {
            code: roomCode,
            name: roomName.trim(),
            youtubeId: youtubeId,
            users: new Map(),
            createdAt: Date.now()
        };
        
        room.users.set(socket.id, { nickname: nickname.trim(), socketId: socket.id });
        youtubeRooms.set(roomCode, room);
        socket.join(`youtube_${roomCode}`);
        connectedUsers.set(socket.id, `youtube_${roomCode}`);
        
        socket.emit('youtubeRoomCreated', { roomCode, youtubeId });
        console.log(`🎬 YouTube room ${roomCode} created`);
    });
    
    socket.on('joinYoutubeRoom', (data) => {
        const { roomCode, nickname } = data;
        
        const room = youtubeRooms.get(roomCode);
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
    // DISCONNECT - ROOMS PERSIST
    // ====================
    socket.on('disconnect', () => {
        console.log(`❌ User disconnected: ${socket.id}`);
        
        const roomId = connectedUsers.get(socket.id);
        if (!roomId) return;
        
        // Handle YouTube room
        if (roomId.startsWith('youtube_')) {
            const roomCode = roomId.replace('youtube_', '');
            const room = youtubeRooms.get(roomCode);
            if (room) {
                const user = room.users.get(socket.id);
                room.users.delete(socket.id);
                if (user) {
                    socket.to(roomId).emit('userLeft', { 
                        nickname: user.nickname, 
                        userCount: room.users.size 
                    });
                }
                // Don't delete room - keep it for others
                console.log(`👤 ${user?.nickname} left YouTube room ${roomCode} (${room.users.size} users remain)`);
            }
        } else {
            // Handle regular room
            const room = rooms.get(roomId);
            if (room) {
                const user = room.users.get(socket.id);
                room.users.delete(socket.id);
                if (user) {
                    socket.to(roomId).emit('userLeft', { 
                        nickname: user.nickname, 
                        userCount: room.users.size 
                    });
                }
                console.log(`👤 ${user?.nickname} left room ${roomId} (${room.users.size} users remain)`);
                
                // Room stays alive even when empty - users can join later
                if (room.users.size === 0) {
                    console.log(`📭 Room ${roomId} is empty but still available for new users`);
                }
            }
        }
        
        connectedUsers.delete(socket.id);
    });
});

// ====================
// START SERVER
// ====================

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`🚀 VibeMates server running on port ${PORT}`);
    console.log(`🔌 Socket.IO server ready for connections`);
    console.log(`🌐 Local: http://localhost:${PORT}`);
});