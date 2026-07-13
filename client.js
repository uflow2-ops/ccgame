// Socket.io 연결 (HTTPS/WSS 강제 설정)
const socket = io({
    transports: ['websocket', 'polling'],
    secure: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});

// 연결 상태 모니터링
socket.on('connect', () => {
    console.log('Socket 연결 성공:', socket.id);
});

socket.on('connect_error', (error) => {
    console.error('Socket 연결 실패:', error);
    showPopup('서버 연결에 실패했습니다. 네트워크를 확인해주세요.');
});

socket.on('disconnect', (reason) => {
    console.log('Socket 연결 끊김:', reason);
});

// 게임 상태
let gameState = {
    playerId: null,
    playerName: null,
    gameId: null,
    currentScreen: 'start',
    role: null, // 'spy' or 'citizen'
    location: null,
    hasWritten: false,
    gameTimeMinutes: 0,
    timeEndTime: null,
    timerInterval: null,
    descriptions: {},
    locations: []
};

// ==================== 장소 목록 로드 ====================
async function loadLobbyLocations() {
    try {
        const response = await fetch('/api/locations');
        const locations = await response.json();
        renderLobbyLocations(locations);
    } catch (error) {
        console.error('장소 목록 로드 실패:', error);
    }
}

// 로비용 장소 목록 렌더링
function renderLobbyLocations(locations) {
    const container = document.getElementById('lobby-locations-container');
    
    if (locations.length === 0) {
        container.innerHTML = `
            <div class="empty-lobby-locations" style="grid-column: 1 / -1; text-align: center; color: #95a5a6; padding: 20px;">
                등록된 장소가 없습니다.
            </div>
        `;
        return;
    }
    
    container.innerHTML = locations.map(location => `
        <div class="lobby-location-card" style="background: #f8f9fa; border-radius: 8px; padding: 10px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
            ${location.image 
                ? `<img src="${location.image}" alt="${location.name}" style="width: 100%; height: 80px; object-fit: cover; border-radius: 6px; margin-bottom: 5px;">`
                : `<div style="width: 100%; height: 80px; display: flex; align-items: center; justify-content: center; font-size: 30px; background: #dfe6e9; border-radius: 6px; margin-bottom: 5px;">${location.emoji || '📍'}</div>`
            }
            <div style="font-size: 0.85rem; font-weight: bold; color: #2c3e50; margin-bottom: 3px;">${location.emoji || '📍'} ${location.name}</div>
            <div style="font-size: 0.7rem; color: #7f8c8d; line-height: 1.3;">${location.description.length > 30 ? location.description.substring(0, 30) + '...' : location.description}</div>
        </div>
    `).join('');
}

// ==================== 화면 관리 ====================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
    gameState.currentScreen = screenId;
}

// ==================== 로컬스토리지 관리 ====================
function saveGameInfo() {
    if (gameState.gameId && gameState.playerName) {
        localStorage.setItem('spyGameInfo', JSON.stringify({
            gameId: gameState.gameId,
            playerName: gameState.playerName
        }));
    }
}

function loadGameInfo() {
    const saved = localStorage.getItem('spyGameInfo');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            return null;
        }
    }
    return null;
}

function clearGameInfo() {
    localStorage.removeItem('spyGameInfo');
}

// ==================== 로비 입장 ====================
function enterLobby() {
    const playerName = document.getElementById('lobby-player-name').value.trim();
    
    if (!playerName) {
        showPopup('이름을 입력해주세요!');
        return;
    }
    
    gameState.playerName = playerName;
    socket.emit('joinLobby', playerName);
    
    // 장소 목록 미리 로드
    loadLobbyLocations();
}

// ==================== 게임 시작 ====================
function startGame() {
    socket.emit('startGame');
}

// ==================== 역할 확인 후 다음으로 ====================
function proceedToWrite() {
    // 라이브 피드 초기화
    const feed = document.getElementById('live-feed');
    feed.innerHTML = '<div class="empty-feed" style="text-align:center; color:#95a5a6; padding:20px;">아직 제출된 설명이 없습니다. 친구들이 작성하면 여기에 채팅처럼 표시됩니다!</div>';
    document.getElementById('write-status').textContent = '';
    document.getElementById('submit-desc-btn').disabled = false;
    showScreen('write-screen');
}

// ==================== 설명 작성 ====================
function submitDescription() {
    const description = document.getElementById('description-input').value.trim();
    
    if (!description) {
        showPopup('설명을 작성해주세요!');
        return;
    }
    
    socket.emit('submitDescription', description);
    
    // 내 설명을 채팅에 추가
    addLiveFeedMessage(gameState.playerName, description, true);
    
    // 입력창 비우기 및 제출 비활성화
    document.getElementById('description-input').value = '';
    document.getElementById('submit-desc-btn').disabled = true;
    document.getElementById('write-status').textContent = '✅ 제출 완료! 다른 친구들을 기다리는 중...';
}

// 라이브 피드에 메시지 추가
function addLiveFeedMessage(playerName, description, isMine) {
    const feed = document.getElementById('live-feed');
    const emptyMsg = feed.querySelector('.empty-feed');
    if (emptyMsg) emptyMsg.remove();
    
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble' + (isMine ? ' mine' : '');
    bubble.innerHTML = `
        <div class="chat-author">${playerName}</div>
        <div class="chat-text">${description}</div>
    `;
    feed.appendChild(bubble);
    feed.scrollTop = feed.scrollHeight;
}

// ==================== 투표 ====================
function submitVote(votedPlayerId) {
    socket.emit('submitVote', votedPlayerId);
}

// ==================== 로비로 돌아가기 ====================
function returnToLobby() {
    clearGameInfo();
    socket.emit('returnToLobby');
}

function goToStart() {
    clearGameInfo();
    location.reload();
}

// ==================== 타이머 관리 ====================
function startGameTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
    
    if (gameState.gameTimeMinutes > 0 && gameState.timeEndTime) {
        gameState.timerInterval = setInterval(() => {
            const now = Date.now();
            const remaining = gameState.timeEndTime - now;
            
            if (remaining <= 0) {
                clearInterval(gameState.timerInterval);
                gameState.timerInterval = null;
                // 시간이 끝났을 때는 이미 서버에서 처리됨
            } else {
                const minutes = Math.floor(remaining / 60000);
                const seconds = Math.floor((remaining % 60000) / 1000);
                const timerEl = document.getElementById('game-timer');
                if (timerEl) {
                    timerEl.textContent = `⏱️ 남은 시간: ${minutes}:${seconds.toString().padStart(2, '0')}`;
                }
            }
        }, 1000);
    }
}

function stopGameTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
}

// ==================== 유틸리티 ====================
function copyGameId() {
    const gameId = document.getElementById('game-id').textContent;
    navigator.clipboard.writeText(gameId).then(() => {
        showPopup('게임 코드가 복사되었습니다!');
    }).catch(() => {
        showPopup('게임 코드: ' + gameId);
    });
}

// ==================== 팝업 ====================
function showPopup(message) {
    const popup = document.getElementById('popup');
    document.getElementById('popup-message').textContent = message;
    popup.style.display = 'flex';
}

function closePopup() {
    document.getElementById('popup').style.display = 'none';
}

// ==================== Socket 이벤트 핸들러 ====================

// 로비 입장됨
socket.on('joinedLobby', (data) => {
    gameState.playerId = data.playerId;
    showScreen('lobby-screen');
});

// 로비 업데이트 (참가자 목록)
socket.on('lobbyUpdate', (players) => {
    const container = document.getElementById('lobby-players-container');
    container.innerHTML = '';
    
    if (players.length === 0) {
        container.innerHTML = '<div class="empty-lobby">아직 참가자가 없습니다.</div>';
        document.getElementById('lobby-player-count').textContent = '현재 0명';
        return;
    }
    
    players.forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        playerItem.innerHTML = `
            <span class="player-emoji">👤</span>
            <span>${player.name}</span>
        `;
        container.appendChild(playerItem);
    });
    
    document.getElementById('lobby-player-count').textContent = `현재 ${players.length}명`;
});

// 게임 시작됨
socket.on('gameStarted', (data) => {
    gameState.gameId = data.gameId;
    gameState.gameTimeMinutes = data.gameTimeMinutes || 0;
    
    if (data.gameTimeMinutes > 0) {
        gameState.timeEndTime = Date.now() + (data.gameTimeMinutes * 60 * 1000);
        startGameTimer();
    }
    
    showPopup('게임이 시작되었습니다!');
});

// 스파이 역할
socket.on('spyRole', (data) => {
    gameState.role = 'spy';
    gameState.gameId = data.gameId;
    saveGameInfo();
    
    document.getElementById('role-emoji').textContent = '🕵️';
    document.getElementById('role-title').textContent = '당신은 스파이입니다!';
    document.getElementById('role-message').textContent = data.message;
    document.getElementById('location-card').style.display = 'none';
    showScreen('role-screen');
});

// 시민 역할
socket.on('citizenRole', (data) => {
    gameState.role = 'citizen';
    gameState.location = data.location;
    gameState.gameId = data.gameId;
    saveGameInfo();
    
    document.getElementById('role-emoji').textContent = '🕵️‍♂️';
    document.getElementById('role-title').textContent = '당신은 시민입니다!';
    document.getElementById('role-message').textContent = data.message;
    
    document.getElementById('location-emoji').textContent = data.location.emoji;
    document.getElementById('location-name').textContent = data.location.name;
    document.getElementById('location-card').style.display = 'block';
    
    showScreen('role-screen');
});

// 설명 제출됨 - 실시간 리뷰 화면으로 이동
socket.on('descriptionSubmitted', () => {
    showPopup('설명이 제출되었습니다! 다른 플레이어의 설명이 실시간으로 표시됩니다.');
    showScreen('review-screen');
});

// 설명 작성 진행 상황
socket.on('waitingForDescriptions', (data) => {
    document.getElementById('write-progress').textContent = 
        `${data.writtenCount}/${data.totalCount} 작성 완료`;
});

// 실시간 설명 업데이트
socket.on('newDescription', (data) => {
    // 작성 화면의 라이브 피드에도 추가 (채팅 형식)
    if (gameState.currentScreen === 'write-screen') {
        addLiveFeedMessage(data.playerName, data.description, false);
    }
    
    const descriptionsContainer = document.getElementById('descriptions-list');
    
    // "아직 제출된 설명이 없습니다" 메시지 제거
    const emptyMsg = descriptionsContainer.querySelector('.empty-descriptions');
    if (emptyMsg) emptyMsg.remove();
    
    // 이미 같은 플레이어의 카드가 있는지 확인
    const existingCard = descriptionsContainer.querySelector(`[data-player-id="${data.playerId}"]`);
    if (existingCard) {
        existingCard.querySelector('.description-text').textContent = data.description;
        return;
    }
    
    // 새 카드 추가
    const card = document.createElement('div');
    card.className = 'description-card';
    card.setAttribute('data-player-id', data.playerId);
    card.innerHTML = `
        <div class="description-header">
            <span class="description-author">${data.playerName}</span>
        </div>
        <p class="description-text">${data.description}</p>
    `;
    descriptionsContainer.appendChild(card);
    
    // 자동 스크롤
    descriptionsContainer.scrollTop = descriptionsContainer.scrollHeight;
});

// 모든 설명 제출 완료
socket.on('allDescriptionsSubmitted', (descriptionsList) => {
    const descriptionsContainer = document.getElementById('descriptions-list');
    descriptionsContainer.innerHTML = '';
    
    descriptionsList.forEach(desc => {
        const card = document.createElement('div');
        card.className = 'description-card';
        card.innerHTML = `
            <div class="description-header">
                <span class="description-author">${desc.playerName}</span>
            </div>
            <p class="description-text">${desc.description}</p>
        `;
        descriptionsContainer.appendChild(card);
    });
    
    showScreen('review-screen');
});

// 투표 단계 - 설명도 함께 전달됨
socket.on('votingPhase', (data) => {
    const voteOptions = document.getElementById('vote-options');
    voteOptions.innerHTML = '';
    
    // 설명이 있으면 저장
    if (data.descriptions) {
        gameState.descriptions = data.descriptions;
    }
    
    // 플레이어 이름과 설명을 함께 표시
    data.players.forEach(player => {
        const button = document.createElement('button');
        button.className = 'vote-option';
        
        // 설명이 있으면 함께 표시
        const description = data.descriptions && data.descriptions[player.id] 
            ? data.descriptions[player.id] 
            : '';
        
        // 설명이 길면 줄여서 표시
        const shortDesc = description.length > 30 
            ? description.substring(0, 30) + '...' 
            : description;
        
        button.innerHTML = `
            <div class="vote-player-name">${player.name}</div>
            ${shortDesc ? `<div class="vote-player-desc">${shortDesc}</div>` : ''}
        `;
        button.onclick = () => submitVote(player.id);
        voteOptions.appendChild(button);
    });
    
    showScreen('vote-screen');
});

// 투표 제출됨
socket.on('voteSubmitted', () => {
    showPopup('투표가 완료되었습니다! 다른 플레이어를 기다려주세요.');
    showScreen('waiting-vote-screen');
});

// 투표 진행 상황
socket.on('waitingForVotes', (data) => {
    document.getElementById('vote-progress').textContent = 
        `${data.voteCount}/${data.totalCount} 투표 완료`;
});

// 게임 종료
socket.on('gameEnded', (data) => {
    stopGameTimer();
    
    const resultTitle = document.getElementById('result-title');
    const resultEmoji = document.getElementById('result-emoji');
    const resultMessage = document.getElementById('result-message');
    const resultDetails = document.getElementById('result-details');
    
    if (data.winningTeam === 'citizens') {
        resultTitle.textContent = '시민 승리!';
        resultEmoji.textContent = '🎉';
        resultMessage.textContent = '스파이를 잡았습니다!';
    } else {
        resultTitle.textContent = '스파이 승리!';
        resultEmoji.textContent = '🕵️';
        resultMessage.textContent = '스파이가 들키지 않았습니다!';
    }
    
    // 투표 결과 표시
    let voteDetails = `스파이: ${data.spyName}\n`;
    voteDetails += `지목당한 사람: ${data.accusedName}\n\n`;
    voteDetails += '투표 결과:\n';
    Object.entries(data.voteCount).forEach(([playerId, count]) => {
        const player = data.players?.find(p => p.id === playerId);
        if (player) {
            voteDetails += `${player.name}: ${count}표\n`;
        }
    });
    
    // 1등 추가
    if (data.fastestPlayer) {
        voteDetails += `\n🏆 1등: ${data.fastestPlayer.name} (가장 빨리 완료!)`;
    }
    
    resultDetails.textContent = voteDetails;
    
    // 축하 효과 추가
    if (data.fastestPlayer) {
        celebrateWinner();
    }
    
    showScreen('result-screen');
});

// 승리 축하 효과
function celebrateWinner() {
    const colors = ['🎉', '⭐', '🏆', '🎊', '✨', '🌟'];
    const resultScreen = document.getElementById('result-screen');
    
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.style.position = 'fixed';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.top = '-50px';
            confetti.style.fontSize = (Math.random() * 30 + 20) + 'px';
            confetti.style.zIndex = '9999';
            confetti.style.pointerEvents = 'none';
            confetti.style.animation = `fall ${Math.random() * 3 + 2}s linear`;
            confetti.textContent = colors[Math.floor(Math.random() * colors.length)];
            
            document.body.appendChild(confetti);
            
            setTimeout(() => {
                confetti.remove();
            }, 5000);
        }, i * 100);
    }
}

// 로비로 복귀됨
socket.on('returnedToLobby', () => {
    showScreen('lobby-screen');
    // 장소 목록 다시 로드
    loadLobbyLocations();
    showPopup('로비로 돌아왔습니다! 새로운 게임을 기다려주세요.');
});

// 플레이어 퇴장
socket.on('playerLeft', (data) => {
    showPopup(`${data.playerName}님이 게임을 나갔습니다.`);
});

// 플레이어 연결 끊김 (재접속 가능)
socket.on('playerDisconnected', (data) => {
    showPopup(`${data.playerName}님이 연결을 끊었습니다. 5분 이내에 재접속하면 게임을 이어서 플레이할 수 있습니다.`);
});

// 플레이어 재접속
socket.on('playerRejoined', (data) => {
    showPopup(`${data.playerName}님이 게임에 다시 들어왔습니다.`);
});

// ==================== 재접속 처리 ====================

// 재접속 성공
socket.on('rejoinSuccess', (data) => {
    gameState.gameId = data.gameId;
    gameState.playerName = data.playerName;
    gameState.role = data.role;
    gameState.location = data.location;
    gameState.hasWritten = data.hasWritten || false;
    
    // 게임 상태에 따라 적절한 화면으로 복구
    if (data.gameStatus === 'playing') {
        // 아직 설명을 작성하지 않았다면 역할 화면으로 이동
        if (!data.hasWritten) {
            if (data.role === 'spy') {
                document.getElementById('role-emoji').textContent = '🕵️';
                document.getElementById('role-title').textContent = '당신은 스파이입니다!';
                document.getElementById('role-message').textContent = '당신은 스파이입니다! 다른 플레이어들이 어떤 장소를 받았는지 추리해보세요.';
                document.getElementById('location-card').style.display = 'none';
            } else {
                document.getElementById('role-emoji').textContent = '🕵️‍♂️';
                document.getElementById('role-title').textContent = '당신은 시민입니다!';
                document.getElementById('role-message').textContent = `당신의 장소는 ${data.location.emoji} ${data.location.name}입니다. 이 장소에 대한 설명을 작성해주세요.`;
                document.getElementById('location-emoji').textContent = data.location.emoji;
                document.getElementById('location-name').textContent = data.location.name;
                document.getElementById('location-card').style.display = 'block';
            }
            showScreen('role-screen');
        } else {
            // 이미 설명을 작성했다면 리뷰 화면으로 복구
            const descriptionsContainer = document.getElementById('descriptions-list');
            descriptionsContainer.innerHTML = '';
            
            // 기존 설명 복구
            data.players.forEach(player => {
                if (data.descriptions[player.id]) {
                    const card = document.createElement('div');
                    card.className = 'description-card';
                    card.innerHTML = `
                        <div class="description-header">
                            <span class="description-author">${player.name}</span>
                        </div>
                        <p class="description-text">${data.descriptions[player.id]}</p>
                    `;
                    descriptionsContainer.appendChild(card);
                }
            });
            
            showScreen('review-screen');
        }
    } else if (data.gameStatus === 'voting') {
        // 투표 단계라면 투표 화면으로
        const voteOptions = document.getElementById('vote-options');
        voteOptions.innerHTML = '';
        
        data.players.forEach(player => {
            const button = document.createElement('button');
            button.className = 'vote-option';
            
            // 설명이 있으면 함께 표시
            const description = data.descriptions && data.descriptions[player.id] 
                ? data.descriptions[player.id] 
                : '';
            
            const shortDesc = description.length > 30 
                ? description.substring(0, 30) + '...' 
                : description;
            
            button.innerHTML = `
                <div class="vote-player-name">${player.name}</div>
                ${shortDesc ? `<div class="vote-player-desc">${shortDesc}</div>` : ''}
            `;
            button.onclick = () => submitVote(player.id);
            voteOptions.appendChild(button);
        });
        
        showScreen('vote-screen');
    }
    
    showPopup('게임에 다시 연결되었습니다!');
});

// 재접속 실패
socket.on('rejoinFailed', (data) => {
    clearGameInfo();
    showPopup(data.message + ' 로비 화면으로 이동합니다.');
    showScreen('lobby-screen');
});

// ==================== 이벤트 리스너 ====================
document.addEventListener('DOMContentLoaded', function() {
    // 페이지 로드 시 재접속 시도
    const savedGameInfo = loadGameInfo();
    if (savedGameInfo && savedGameInfo.gameId && savedGameInfo.playerName) {
        // 소켓이 연결된 후 재접속 요청
        socket.on('connect', function() {
            socket.emit('rejoinGame', {
                gameId: savedGameInfo.gameId,
                playerName: savedGameInfo.playerName
            });
        });
    }
    
    // 엔터키로 로비 입장
    document.getElementById('lobby-player-name').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            enterLobby();
        }
    });
    
    // ESC 키로 팝업 닫기
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closePopup();
        }
    });
});