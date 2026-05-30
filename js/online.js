// YouTube room creation page

document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    
    const form = document.getElementById('createYoutubeRoomForm');
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const roomName = document.getElementById('roomName').value.trim();
        const nickname = document.getElementById('nickname').value.trim();
        let youtubeUrl = document.getElementById('youtubeUrl').value.trim();
        
        if (!roomName || !nickname || !youtubeUrl) {
            alert('Please fill all fields');
            return;
        }
        
        // Extract YouTube video ID
        const videoId = extractYouTubeId(youtubeUrl);
        if (!videoId) {
            alert('Invalid YouTube URL');
            return;
        }
        
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        submitBtn.disabled = true;
        
        socket.emit('createYoutubeRoom', {
            roomName: roomName,
            nickname: nickname,
            youtubeId: videoId
        });
        
        socket.once('youtubeRoomCreated', (data) => {
            window.location.href = `youtube-room.html?room=${data.roomCode}&name=${encodeURIComponent(nickname)}&video=${data.youtubeId}`;
        });
        
        setTimeout(() => {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }, 3000);
    });
    
    function extractYouTubeId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=)([^&]+)/,
            /(?:youtu\.be\/)([^?]+)/,
            /(?:youtube\.com\/embed\/)([^?]+)/
        ];
        for (let pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
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
});