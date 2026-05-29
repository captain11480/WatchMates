// Socket.IO and room logic for WatchMates

class WatchMatesClient {
    constructor() {
        this.socket = null;
        this.roomCode = null;
        this.roomName = null;
        this.nickname = null;
        this.isConnected = false;
        
        this.initializeEventListeners();
        this.connectToServer();
        this.optimizeForMobile();
        this.initializeSharing(); // ADDED: Sharing functionality
    }

    initializeEventListeners() {
        console.log("🔄 Initializing event listeners");
        
        // Join room form
        const joinForm = document.getElementById('joinRoomForm');
        if (joinForm) {
            console.log("✅ Join room form found");
            joinForm.addEventListener('submit', (e) => this.handleJoinRoom(e));
            
            const roomCodeInput = document.getElementById('roomCode');
            if (roomCodeInput) {
                roomCodeInput.addEventListener('input', (e) => {
                    e.target.value = e.target.value.toUpperCase();
                });
            }
        } else {
            console.log("❌ Join room form NOT found");
        }

        // Create room form
        const createForm = document.getElementById('createRoomForm');
        if (createForm) {
            console.log("✅ Create room form found");
            createForm.addEventListener('submit', (e) => this.handleCreateRoom(e));
        } else {
            console.log("❌ Create room form NOT found");
        }

        // Video controls (only in watchroom)
        const playBtn = document.getElementById('playBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const syncBtn = document.getElementById('syncBtn');
        const videoPlayer = document.getElementById('videoPlayer');
        const uploadBtn = document.getElementById('uploadBtn');
        const videoUpload = document.getElementById('videoUpload');

        if (playBtn) playBtn.addEventListener('click', () => this.sendPlayCommand());
        if (pauseBtn) pauseBtn.addEventListener('click', () => this.sendPauseCommand());
        if (syncBtn) syncBtn.addEventListener('click', () => this.sendSyncCommand());
        if (videoPlayer) {
            videoPlayer.addEventListener('play', () => this.sendPlayCommand());
            videoPlayer.addEventListener('pause', () => this.sendPauseCommand());
            videoPlayer.addEventListener('seeked', () => this.sendSyncCommand());
        }
        if (uploadBtn && videoUpload) {
            uploadBtn.addEventListener('click', () => videoUpload.click());
            videoUpload.addEventListener('change', (e) => this.handleVideoUpload(e));
        }

        // Chat form (only in watchroom)
        const chatForm = document.getElementById('chatForm');
        if (chatForm) {
            chatForm.addEventListener('submit', (e) => this.handleChatMessage(e));
        }

        // Chat toggle (only in watchroom)
        const chatToggle = document.getElementById('chatToggle');
        if (chatToggle) {
            chatToggle.addEventListener('click', () => this.toggleChat());
        }

        // Get room info from URL parameters
        this.getRoomInfoFromURL();
        
        // Initialize room display if in watchroom
        this.initializeRoomDisplay();
    }

    // Mobile optimization methods
    optimizeForMobile() {
        const videoPlayer = document.getElementById('videoPlayer');
        if (!videoPlayer) return;
        
        // Better mobile video controls
        videoPlayer.controls = true;
        
        // Enable inline playback for iOS
        videoPlayer.setAttribute('playsinline', 'true');
        videoPlayer.setAttribute('webkit-playsinline', 'true');
        
        // Handle orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                if (videoPlayer.videoWidth > 0 && videoPlayer.videoHeight > 0) {
                    this.adjustVideoSize();
                }
            }, 300);
        });
        
        // Handle resize
        window.addEventListener('resize', () => {
            this.adjustVideoSize();
        });
    }

    adjustVideoSize() {
        const videoPlayer = document.getElementById('videoPlayer');
        const videoContainer = document.querySelector('.video-player');
        
        if (!videoPlayer || !videoContainer) return;
        
        // Adjust based on screen size
        if (window.innerWidth <= 768) {
            videoContainer.style.height = '50vh';
        } else {
            videoContainer.style.height = '70%';
        }
    }

    // NEW: Sharing functionality methods
    initializeSharing() {
        const roomCodeElement = document.getElementById('roomCodeDisplay');
        const roomCodeHighlight = document.querySelector('.room-code-highlight');
        
        if (roomCodeElement) {
            roomCodeElement.classList.add('shareable');
            roomCodeElement.addEventListener('click', () => this.showShareOptions(roomCodeElement));
        }
        
        if (roomCodeHighlight) {
            roomCodeHighlight.classList.add('shareable');
            roomCodeHighlight.addEventListener('click', () => this.showShareOptions(roomCodeHighlight));
        }
    }

    showShareOptions(element) {
        // Remove existing share options
        const existingShare = document.querySelector('.share-options');
        if (existingShare) {
            existingShare.remove();
        }

        const roomCode = this.roomCode;
        if (!roomCode) return;

        const roomName = this.roomName || 'WatchMates Room';
        const shareText = `Join my WatchMates room "${roomName}"! Room Code: ${roomCode}\n\nWatch videos together in sync!`;
        const shareUrl = window.location.href.split('?')[0] + `?room=${roomCode}`;

        const shareOptions = document.createElement('div');
        shareOptions.className = 'share-options';
        shareOptions.innerHTML = `
            <div class="share-title">Share Room Code</div>
            <div class="share-buttons">
                <a href="https://wa.me/?text=${encodeURIComponent(shareText)}" target="_blank" class="share-btn whatsapp">
                    <i class="fab fa-whatsapp"></i>
                    WhatsApp
                </a>
                <a href="https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}" target="_blank" class="share-btn telegram">
                    <i class="fab fa-telegram"></i>
                    Telegram
                </a>
                <a href="https://www.facebook.com/dialog/send?link=${encodeURIComponent(shareUrl)}&app_id=YOUR_APP_ID&redirect_uri=${encodeURIComponent(shareUrl)}" target="_blank" class="share-btn messenger">
                    <i class="fab fa-facebook-messenger"></i>
                    Messenger
                </a>
                <button class="share-btn copy" onclick="watchMatesClient.copyRoomCode('${roomCode}')">
                    <i class="fas fa-copy"></i>
                    Copy Code
                </button>
            </div>
            <div class="share-instruction">
                <i class="fas fa-mobile-alt"></i>
                Tap anywhere to close
            </div>
        `;

        element.appendChild(shareOptions);

        // Show with animation
        setTimeout(() => {
            shareOptions.classList.add('show');
        }, 10);

        // Close when clicking outside
        const closeHandler = (e) => {
            if (!shareOptions.contains(e.target) && e.target !== element) {
                shareOptions.classList.remove('show');
                setTimeout(() => {
                    shareOptions.remove();
                }, 300);
                document.removeEventListener('click', closeHandler);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', closeHandler);
        }, 100);
    }

    copyRoomCode(roomCode) {
        navigator.clipboard.writeText(roomCode).then(() => {
            const copyBtn = document.querySelector('.share-btn.copy');
            if (copyBtn) {
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                copyBtn.classList.add('copied');
                
                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                    copyBtn.classList.remove('copied');
                }, 2000);
            }
            
            // Show success message
            this.showCopySuccess();
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = roomCode;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showCopySuccess();
        });
    }

    showCopySuccess() {
        const successDiv = document.createElement('div');
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #10B981;
            color: white;
            padding: 12px 20px;
            border-radius: 10px;
            z-index: 10000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            font-weight: 500;
        `;
        successDiv.innerHTML = '<i class="fas fa-check-circle"></i> Room code copied to clipboard!';
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }

    connectToServer() {
        try {
            console.log("🔄 Connecting to server...");
            
            // Socket.IO automatically connects to the same server
            this.socket = io();
            
            this.socket.on('connect', () => {
                console.log('✅ Connected to Socket.IO server');
                this.isConnected = true;
                this.updateConnectionStatus(true);
                
                // If we're in a watch room and have room info, join it
                if (this.roomCode && this.nickname) {
                    console.log(`🔄 Rejoining room: ${this.roomCode} as ${this.nickname}`);
                    this.joinRoom(this.roomCode, this.nickname);
                }
            });

            // Handle server events
            this.socket.on('roomCreated', (data) => {
                console.log('📨 Received roomCreated event:', data);
                this.handleRoomCreated(data);
            });
            
            this.socket.on('roomJoined', (data) => {
                console.log('📨 Received roomJoined event:', data);
                this.handleRoomJoined(data);
            });
            
            this.socket.on('roomNotFound', () => {
                console.log('📨 Received roomNotFound event');
                this.showRoomNotFound();
            });
            
            this.socket.on('userJoined', (data) => {
                console.log('📨 Received userJoined event:', data);
                this.handleUserJoined(data);
            });
            
            this.socket.on('userLeft', (data) => {
                console.log('📨 Received userLeft event:', data);
                this.handleUserLeft(data);
            });
            
            this.socket.on('videoPlayed', (data) => {
                console.log('📨 Received videoPlayed event:', data);
                this.handlePlayCommand(data);
            });
            
            this.socket.on('videoPaused', (data) => {
                console.log('📨 Received videoPaused event:', data);
                this.handlePauseCommand(data);
            });
            
            this.socket.on('videoSynced', (data) => {
                console.log('📨 Received videoSynced event:', data);
                this.handleSyncCommand(data);
            });
            
            this.socket.on('chatMessageReceived', (data) => {
                console.log('📨 Received chatMessageReceived event:', data);
                this.handleIncomingChatMessage(data);
            });
            
            this.socket.on('videoChanged', (data) => {
                console.log('📨 Received videoChanged event:', data);
                this.handleVideoChange(data);
            });
            
            this.socket.on('error', (data) => {
                console.log('📨 Received error event:', data);
                this.showError(data.message);
            });

            this.socket.on('disconnect', () => {
                console.log('❌ Disconnected from server');
                this.isConnected = false;
                this.updateConnectionStatus(false);
            });

        } catch (error) {
            console.error('Failed to connect to server:', error);
            this.updateConnectionStatus(false);
        }
    }

    updateConnectionStatus(connected) {
        let statusElement = document.getElementById('connectionStatus');
        
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = 'connectionStatus';
            statusElement.className = 'connection-status';
            document.body.appendChild(statusElement);
        }
        
        if (connected) {
            statusElement.textContent = '🟢 Connected';
            statusElement.className = 'connection-status connected';
        } else {
            statusElement.textContent = '🔴 Disconnected';
            statusElement.className = 'connection-status disconnected';
        }
    }

    getRoomInfoFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomParam = urlParams.get('room');
        const nameParam = urlParams.get('name');
        
        if (roomParam && nameParam) {
            this.roomCode = roomParam;
            this.nickname = decodeURIComponent(nameParam);
            console.log(`📋 Got room info from URL: ${this.roomCode} as ${this.nickname}`);
        } else {
            console.log("📋 No room info in URL");
        }
    }

    initializeRoomDisplay() {
        console.log("🔄 Initializing room display");
        // Only run this in watchroom.html
        const roomCodeDisplay = document.getElementById('roomCodeDisplay');
        const roomNameDisplay = document.getElementById('roomNameDisplay');
        const currentUserNickname = document.getElementById('currentUserNickname');
        
        if (roomCodeDisplay && this.roomCode) {
            roomCodeDisplay.textContent = this.roomCode;
            console.log(`✅ Set room code display to: ${this.roomCode}`);
        }
        
        if (roomNameDisplay && this.roomName) {
            roomNameDisplay.textContent = this.roomName;
        } else if (roomNameDisplay) {
            roomNameDisplay.textContent = 'Loading Room...';
        }
        
        if (currentUserNickname && this.nickname) {
            currentUserNickname.textContent = this.nickname;
        }
    }

    handleCreateRoom(e) {
        e.preventDefault();
        console.log("🔄 handleCreateRoom called");
        
        const roomName = document.getElementById('roomName').value.trim();
        const nickname = document.getElementById('createNickname').value.trim();
        
        console.log(`📝 Form data - Room: ${roomName}, Nickname: ${nickname}`);
        
        if (!roomName || !nickname) {
            this.showError('Please fill in all fields');
            return;
        }

        if (roomName.length < 2) {
            this.showError('Room name must be at least 2 characters');
            return;
        }

        if (nickname.length < 2) {
            this.showError('Nickname must be at least 2 characters');
            return;
        }

        this.nickname = nickname;
        
        console.log('🚀 Emitting createRoom event to server');
        this.socket.emit('createRoom', {
            roomName: roomName,
            nickname: nickname
        });
        
        // Show loading state
        const createBtn = document.getElementById('createRoomBtn');
        createBtn.disabled = true;
        createBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    }

    handleJoinRoom(e) {
        e.preventDefault();
        console.log("🔄 handleJoinRoom called");
        
        const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();
        const nickname = document.getElementById('joinNickname').value.trim();
        
        console.log(`📝 Form data - Room Code: ${roomCode}, Nickname: ${nickname}`);
        
        if (!roomCode || !nickname) {
            this.showError('Please fill in all fields');
            return;
        }

        if (roomCode.length !== 6) {
            this.showError('Room code must be 6 characters');
            return;
        }

        if (nickname.length < 2) {
            this.showError('Nickname must be at least 2 characters');
            return;
        }

        this.nickname = nickname;
        this.roomCode = roomCode;
        
        console.log('🚀 Emitting joinRoom event to server');
        this.socket.emit('joinRoom', {
            roomCode: roomCode,
            nickname: nickname
        });
        
        // Show loading state
        const joinBtn = e.target.querySelector('button[type="submit"]');
        joinBtn.disabled = true;
        joinBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Joining...';
    }

    joinRoom(roomCode, nickname) {
        this.socket.emit('joinRoom', {
            roomCode: roomCode,
            nickname: nickname
        });
    }

    handleRoomCreated(data) {
        console.log('🎉 Room created successfully:', data);
        
        // Show room code and redirect
        const roomCodeDisplay = document.getElementById('roomCodeDisplay');
        const generatedRoomCode = document.getElementById('generatedRoomCode');
        const createRoomBtn = document.getElementById('createRoomBtn');
        
        if (roomCodeDisplay && generatedRoomCode) {
            roomCodeDisplay.style.display = 'block';
            generatedRoomCode.textContent = data.roomCode;
            if (createRoomBtn) createRoomBtn.style.display = 'none';
            
            // Store room code for redirect
            this.roomCode = data.roomCode;
            
            console.log('🔄 Redirecting to watchroom in 2 seconds...');
            // Redirect after 2 seconds
            setTimeout(() => {
                console.log(`📍 Redirecting to: watchroom.html?room=${data.roomCode}&name=${encodeURIComponent(this.nickname)}`);
                window.location.href = `watchroom.html?room=${data.roomCode}&name=${encodeURIComponent(this.nickname)}`;
            }, 2000);
        } else {
            // If elements don't exist, redirect immediately
            console.log('🔄 Immediate redirect to watchroom...');
            setTimeout(() => {
                window.location.href = `watchroom.html?room=${data.roomCode}&name=${encodeURIComponent(this.nickname)}`;
            }, 1000);
        }
    }

    handleRoomJoined(data) {
        console.log('🎉 Room joined successfully:', data);
        this.roomCode = data.roomCode;
        this.roomName = data.roomName;
        
        // FIX: Check if we're already in watchroom
        const isInWatchroom = window.location.pathname.includes('watchroom.html');
        
        if (!isInWatchroom) {
            console.log('🔄 Redirecting to watchroom immediately...');
            // Redirect immediately to watchroom
            window.location.href = `watchroom.html?room=${data.roomCode}&name=${encodeURIComponent(this.nickname)}`;
            return; // Stop execution here to prevent further processing
        }
        
        // Only run this if we're already in watchroom (reconnection case)
        console.log('🔄 Already in watchroom, updating display...');
        this.updateRoomDisplay(data.roomName, data.roomCode, data.userCount);
        
        // Update current user nickname
        const currentUserNickname = document.getElementById('currentUserNickname');
        if (currentUserNickname) {
            currentUserNickname.textContent = this.nickname;
        }
        
        // Add system message
        this.addChatMessage('System', `You joined the room "${data.roomName}"`, true);
        this.addChatMessage('System', `Share this code with friends: <strong>${data.roomCode}</strong>`, true);
        
        // Show connection success
        this.updateConnectionStatus(true);
    }

    updateRoomDisplay(roomName, roomCode, userCount) {
        const roomNameDisplay = document.getElementById('roomNameDisplay');
        const roomCodeDisplay = document.getElementById('roomCodeDisplay');
        const roomTitle = document.getElementById('roomTitle');
        const userCountElement = document.getElementById('userCount');
        
        if (roomNameDisplay) roomNameDisplay.textContent = roomName;
        if (roomCodeDisplay) roomCodeDisplay.textContent = roomCode;
        if (roomTitle) {
            roomTitle.innerHTML = `🎬 ${roomName} — Code: <span class="room-code-highlight">${roomCode}</span>`;
        }
        if (userCountElement) userCountElement.textContent = userCount;
    }

    showRoomNotFound() {
        console.log('❌ Room not found');
        const alertDiv = document.getElementById('joinAlert');
        if (alertDiv) {
            alertDiv.style.display = 'flex';
            setTimeout(() => {
                alertDiv.style.display = 'none';
            }, 5000);
        }
        
        // Re-enable join button
        const joinBtn = document.querySelector('#joinRoomForm button[type="submit"]');
        if (joinBtn) {
            joinBtn.disabled = false;
            joinBtn.innerHTML = 'Join Room';
        }
        
        this.showError('Room not found. Please check the code.');
    }

    showError(message) {
        console.log('❌ Error:', message);
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #ef4444;
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            z-index: 10000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            font-weight: 500;
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
        
        // Re-enable buttons
        const createBtn = document.getElementById('createRoomBtn');
        const joinBtn = document.querySelector('#joinRoomForm button[type="submit"]');
        
        if (createBtn) {
            createBtn.disabled = false;
            createBtn.innerHTML = 'Create Room';
        }
        if (joinBtn) {
            joinBtn.disabled = false;
            joinBtn.innerHTML = 'Join Room';
        }
    }

    handleUserJoined(data) {
        this.addChatMessage('System', `${data.nickname} joined the room`, true, 'user-joined');
        
        const userCount = document.getElementById('userCount');
        if (userCount) {
            userCount.textContent = data.userCount;
        }
    }

    handleUserLeft(data) {
        this.addChatMessage('System', `${data.nickname} left the room`, true, 'user-left');
        
        const userCount = document.getElementById('userCount');
        if (userCount) {
            userCount.textContent = data.userCount;
        }
    }

    sendPlayCommand() {
        const videoPlayer = document.getElementById('videoPlayer');
        if (videoPlayer) videoPlayer.play();
        
        this.socket.emit('videoPlay', {
            roomCode: this.roomCode,
            timestamp: Date.now()
        });
    }

    sendPauseCommand() {
        const videoPlayer = document.getElementById('videoPlayer');
        if (videoPlayer) videoPlayer.pause();
        
        this.socket.emit('videoPause', {
            roomCode: this.roomCode,
            timestamp: Date.now()
        });
    }

    sendSyncCommand() {
        const videoPlayer = document.getElementById('videoPlayer');
        if (videoPlayer) {
            this.socket.emit('videoSync', {
                roomCode: this.roomCode,
                currentTime: videoPlayer.currentTime,
                timestamp: Date.now()
            });
        }
    }

    handlePlayCommand(data) {
        const videoPlayer = document.getElementById('videoPlayer');
        if (videoPlayer && videoPlayer.paused) {
            videoPlayer.play();
        }
    }

    handlePauseCommand(data) {
        const videoPlayer = document.getElementById('videoPlayer');
        if (videoPlayer && !videoPlayer.paused) {
            videoPlayer.pause();
        }
    }

    handleSyncCommand(data) {
        const videoPlayer = document.getElementById('videoPlayer');
        if (videoPlayer && Math.abs(videoPlayer.currentTime - data.currentTime) > 2) {
            videoPlayer.currentTime = data.currentTime;
        }
    }

    handleChatMessage(e) {
        e.preventDefault();
        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();
        
        if (!message) return;
        
        this.socket.emit('chatMessage', {
            roomCode: this.roomCode,
            nickname: this.nickname,
            message: message,
            timestamp: Date.now()
        });
        
        // Add message to chat immediately (optimistic update)
        this.addChatMessage(this.nickname, message);
        chatInput.value = '';
    }

    handleIncomingChatMessage(data) {
        this.addChatMessage(data.nickname, data.message);
    }

    addChatMessage(sender, message, isSystem = false, messageClass = '') {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isSystem ? 'system-message' : ''} ${messageClass}`;
        
        const senderDiv = document.createElement('div');
        senderDiv.className = 'message-sender';
        senderDiv.textContent = sender;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = message;
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageDiv.appendChild(senderDiv);
        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(timeDiv);
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    handleVideoUpload(e) {
        const file = e.target.files[0];
        if (file) {
            const videoPlayer = document.getElementById('videoPlayer');
            if (videoPlayer) {
                const videoURL = URL.createObjectURL(file);
                videoPlayer.src = videoURL;
                
                // Notify other users about the video change
                this.addChatMessage('System', `${this.nickname} uploaded a new video: ${file.name}`, true);
                
                // Broadcast video change to room
                this.socket.emit('videoUploaded', {
                    roomCode: this.roomCode,
                    nickname: this.nickname,
                    fileName: file.name,
                    timestamp: Date.now()
                });
            }
        }
    }

    handleVideoChange(data) {
        this.addChatMessage('System', `${data.nickname} changed the video to: ${data.fileName}`, true);
    }

    toggleChat() {
        const chatContainer = document.querySelector('.chat-container');
        const chatMessages = document.getElementById('chatMessages');
        const chatInput = document.querySelector('.chat-input');
        const chatToggle = document.getElementById('chatToggle');
        const icon = chatToggle.querySelector('i');
        
        if (chatMessages.style.display === 'none') {
            // Show chat
            chatMessages.style.display = 'block';
            chatInput.style.display = 'block';
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        } else {
            // Hide chat
            chatMessages.style.display = 'none';
            chatInput.style.display = 'none';
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        }
    }
}

// Initialize the client when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 DOM loaded, initializing WatchMatesClient");
    window.watchMatesClient = new WatchMatesClient();
    
    // Update current time in system message
    const currentTimeElement = document.getElementById('currentTime');
    if (currentTimeElement) {
        currentTimeElement.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
});