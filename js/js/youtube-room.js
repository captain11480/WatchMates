// YouTube room synchronization with Socket.IO

let player;
let roomCode;
let nickname;
let videoId;

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
roomCode = urlParams.get('room');
nickname = decodeURIComponent(urlParams.get('name') || 'Guest');
videoId = urlParams.get('video');

// Connect Socket.IO
const socket = io();

// Display room info
document.getElementById('roomCodeDisplay').textContent = roomCode;
document.getElementById('roomNameDisplay').innerHTML = `🎬 YouTube Room - ${roomCode}`;
document.getElementById('currentUserNickname').textContent = nickname;

// Join room
socket.emit('joinYoutubeRoom', {
    roomCode: roomCode,
    nickname: nickname
});

// Socket event handlers
socket.on('youtubeRoomJoined', (data) => {
    console.log('Joined YouTube room:', data);
    addChatMessage('System', `Welcome to ${data.roomName}!`, true);
    addChatMessage('System', `Share code: ${data.roomCode}`, true);
});

socket.on('userJoined', (data) => {
    addChatMessage('System', `${data.nickname} joined the room`, true);
    updateUserCount(1);
});

socket.on('userLeft', (data) => {
    addChatMessage('System', `${data.nickname} left the room`, true);
    updateUserCount(-1);
});

socket.on('youtubePlayed', () => {
    if (player) player.playVideo();
});

socket.on('youtubePaused', () => {
    if (player) player.pauseVideo();
});

socket.on('youtubeSynced', (data) => {
    if (player && Math.abs(player.getCurrentTime() - data.currentTime) > 2) {
        player.seekTo(data.currentTime);
    }
});

socket.on('chatMessageReceived', (data) => {
    addChatMessage(data.nickname, data.message);
});

// YouTube Player API
function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtubePlayer', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange
        }
    });
}

function onPlayerReady(event) {
    console.log('YouTube player ready');
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        socket.emit('youtubePlay', { roomCode: roomCode });
    } else if (event.data === YT.PlayerState.PAUSED) {
        socket.emit('youtubePause', { roomCode: roomCode });
    }
}

// UI Controls
document.getElementById('playBtn').onclick = () => {
    if (player) player.playVideo();
};

document.getElementById('pauseBtn').onclick = () => {
    if (player) player.pauseVideo();
};

document.getElementById('syncBtn').onclick = () => {
    if (player) {
        socket.emit('youtubeSync', {
            roomCode: roomCode,
            currentTime: player.getCurrentTime()
        });
        addChatMessage('System', `${nickname} synced the video`, true);
    }
};

// Chat functions
document.getElementById('chatForm').onsubmit = (e) => {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (message) {
        socket.emit('chatMessage', {
            roomCode: roomCode,
            nickname: nickname,
            message: message
        });
        addChatMessage(nickname, message);
        input.value = '';
    }
};

function addChatMessage(sender, message, isSystem = false) {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `message ${isSystem ? 'system-message' : ''}`;
    div.innerHTML = `
        <div class="message-sender">${sender}</div>
        <div class="message-content">${message}</div>
        <div class="message-time">${new Date().toLocaleTimeString()}</div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function updateUserCount(change) {
    const countSpan = document.getElementById('userCount');
    let current = parseInt(countSpan.textContent);
    current = isNaN(current) ? 1 : current + change;
    countSpan.textContent = current;
}

// Theme toggle
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
    const themeIcon = themeToggle.querySelector('i');
    const currentTheme = localStorage.getItem('theme') || 'light';
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
    }
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        if (document.body.classList.contains('dark-mode')) {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
            localStorage.setItem('theme', 'dark');
        } else {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
            localStorage.setItem('theme', 'light');
        }
    });
}