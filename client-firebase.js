// Firebase SDK 로드 (CDN)
// <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js"></script>

// Firebase 구성
const firebaseConfig = {
    apiKey: "AIzaSyDC5B15uSbN28iHQ3i1H2yjZ0rE90f8obY",
    authDomain: "ccgame-1c18c.firebaseapp.com",
    databaseURL: "https://ccgame-1c18c-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ccgame-1c18c",
    storageBucket: "ccgame-1c18c.firebasestorage.app",
    messagingSenderId: "94656061801",
    appId: "1:94656061801:web:ca15e70644bc3c8a529df8"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// 게임 상태
let gameState = {
    playerId: null,
    playerName: null,
    gameId: null,
    currentScreen: 'start',
    role: null,
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
        const snapshot = await database.ref('locations').once('value');
        if (snapshot.exists()) {
            const locations = Array.isArray(snapshot.val()) ? snapshot.val() : Object.values(snapshot.val());
            renderLobbyLocations(locations);
        }
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
    const playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    gameState.playerId = playerId;
    
    // Firebase RTDB에 플레이어 추가
    database.ref('lobby/players/' + playerId).set({
        id: playerId,
        name: playerName,
        joinedAt: Date.now()
    });
    
    // 장소 목록 로드
    loadLobbyLocations();
    
    showScreen('lobby-screen');
}

// ==================== 유틸리티 ====================
function showPopup(message) {
    const popup = document.getElementById('popup');
    document.getElementById('popup-message').textContent = message;
    popup.style.display = 'flex';
}

function closePopup() {
    document.getElementById('popup').style.display = 'none';
}

// ==================== 이벤트 리스너 ====================
document.addEventListener('DOMContentLoaded', function() {
    // 장소 목록 로드
    loadLobbyLocations();
    
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

// ==================== RTDB 실시간 리스너 ====================

// 로비 플레이어 실시간 업데이트
function setupLobbyListener() {
    database.ref('lobby/players').on('value', (snapshot) => {
        if (snapshot.exists()) {
            const players = Object.values(snapshot.val());
            updateLobbyPlayers(players);
        } else {
            updateLobbyPlayers([]);
        }
    });
}

// 로비 플레이어 UI 업데이트
function updateLobbyPlayers(players) {
    const container = document.getElementById('lobby-players-container');
    if (!container) return;
    
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
}

// 게임 실시간 리스너 설정
function setupGameListener() {
    if (!gameState.gameId) return;
    
    const gameRef = database.ref('games/' + gameState.gameId);
    
    // 게임 상태 변경 감지
    gameRef.on('value', (snapshot) => {
        if (!snapshot.exists()) return;
        
        const game = snapshot.val();
        
        // 설명 실시간 업데이트
        if (game.descriptions) {
            updateDescriptions(game.descriptions, game.players);
        }
        
        // 투표 단계 감지
        if (game.status === 'voting' && gameState.currentScreen !== 'vote-screen') {
            showVotingPhase(game);
        }
        
        // 게임 종료 감지
        if (game.status === 'ended') {
            showGameResult(game);
        }
    });
}

// 설명 업데이트
function updateDescriptions(descriptions, players) {
    const feed = document.getElementById('live-feed');
    if (!feed) return;
    
    // 작성 화면의 라이브 피드에 추가
    if (gameState.currentScreen === 'write-screen') {
        Object.entries(descriptions).forEach(([playerId, desc]) => {
            if (desc && !document.querySelector(`[data-player-id="${playerId}"]`)) {
                const player = players.find(p => p.id === playerId);
                if (player && player.name !== gameState.playerName) {
                    addLiveFeedMessage(player.name, desc, false);
                }
            }
        });
    }
}

// 라이브 피드에 메시지 추가
function addLiveFeedMessage(playerName, description, isMine) {
    const feed = document.getElementById('live-feed');
    if (!feed) return;
    
    const emptyMsg = feed.querySelector('.empty-feed');
    if (emptyMsg) emptyMsg.remove();
    
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble' + (isMine ? ' mine' : '');
    bubble.setAttribute('data-player-id', playerName);
    bubble.innerHTML = `
        <div class="chat-author">${playerName}</div>
        <div class="chat-text">${description}</div>
    `;
    feed.appendChild(bubble);
    feed.scrollTop = feed.scrollHeight;
}

// 투표 단계 표시
function showVotingPhase(game) {
    const voteOptions = document.getElementById('vote-options');
    if (!voteOptions) return;
    
    voteOptions.innerHTML = '';
    
    game.players.forEach(player => {
        const button = document.createElement('button');
        button.className = 'vote-option';
        
        const description = game.descriptions && game.descriptions[player.id] 
            ? game.descriptions[player.id] 
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

// 게임 결과 표시
function showGameResult(game) {
    stopGameTimer();
    
    const resultTitle = document.getElementById('result-title');
    const resultEmoji = document.getElementById('result-emoji');
    const resultMessage = document.getElementById('result-message');
    const resultDetails = document.getElementById('result-details');
    
    const spyPlayer = game.players.find(p => p.isSpy);
    const accusedPlayer = game.votes ? Object.keys(game.votes).reduce((acc, id) => {
        const count = Object.values(game.votes).filter(v => v === id).length;
        return count > (acc.count || 0) ? { id, count } : acc;
    }, {}).id : null;
    
    const spyCaught = accusedPlayer === game.spyId;
    
    if (spyCaught) {
        resultTitle.textContent = '시민 승리!';
        resultEmoji.textContent = '🎉';
        resultMessage.textContent = '스파이를 잡았습니다!';
    } else {
        resultTitle.textContent = '스파이 승리!';
        resultEmoji.textContent = '🕵️';
        resultMessage.textContent = '스파이가 들키지 않았습니다!';
    }
    
    let voteDetails = `스파이: ${spyPlayer ? spyPlayer.name : '알 수 없음'}\n`;
    voteDetails += `지목당한 사람: ${accusedPlayer ? game.players.find(p => p.id === accusedPlayer)?.name : '없음'}\n\n`;
    voteDetails += '투표 결과:\n';
    
    if (game.votes) {
        const voteCount = {};
        game.players.forEach(p => {
            voteCount[p.id] = 0;
        });
        Object.values(game.votes).forEach(votedId => {
            voteCount[votedId]++;
        });
        Object.entries(voteCount).forEach(([playerId, count]) => {
            const player = game.players.find(p => p.id === playerId);
            if (player) {
                voteDetails += `${player.name}: ${count}표\n`;
            }
        });
    }
    
    resultDetails.textContent = voteDetails;
    
    if (gameState.currentScreen !== 'result-screen') {
        showScreen('result-screen');
    }
}

// ==================== 게임 액션 ====================

// 설명 제출
function submitDescription() {
    const description = document.getElementById('description-input').value.trim();
    
    if (!description) {
        showPopup('설명을 작성해주세요!');
        return;
    }
    
    // Firebase RTDB에 설명 저장
    database.ref('games/' + gameState.gameId + '/descriptions/' + gameState.playerId).set({
        playerId: gameState.playerId,
        playerName: gameState.playerName,
        description: description,
        timestamp: Date.now()
    });
    
    // 내 설명을 채팅에 추가
    addLiveFeedMessage(gameState.playerName, description, true);
    
    // 입력창 비우기 및 제출 비활성화
    document.getElementById('description-input').value = '';
    document.getElementById('submit-desc-btn').disabled = true;
    document.getElementById('write-status').textContent = '✅ 제출 완료! 다른 친구들을 기다리는 중...';
    
    gameState.hasWritten = true;
}

// 투표 제출
function submitVote(votedPlayerId) {
    database.ref('games/' + gameState.gameId + '/votes/' + gameState.playerId).set(votedPlayerId);
}

// 로비로 돌아가기
function returnToLobby() {
    clearGameInfo();
    
    // 게임에서 제거
    if (gameState.gameId) {
        database.ref('games/' + gameState.gameId + '/players/' + gameState.playerId).remove();
    }
    
    // 로비에 다시 추가
    database.ref('lobby/players/' + gameState.playerId).set({
        id: gameState.playerId,
        name: gameState.playerName,
        joinedAt: Date.now()
    });
    
    gameState.gameId = null;
    gameState.role = null;
    gameState.location = null;
    gameState.hasWritten = false;
    
    showScreen('lobby-screen');
    loadLobbyLocations();
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

// ==================== 교사용 함수 ====================

// 교사 세션 시작
function startTeacherSession() {
    const teacherName = document.getElementById('teacher-name-input').value.trim();
    
    if (!teacherName) {
        showMessage('교사 이름을 입력해주세요.', 'error');
        return;
    }
    
    // Firebase RTDB에 교사 세션 저장
    database.ref('teacher/session').set({
        teacherId: 'teacher_' + Date.now(),
        teacherName: teacherName,
        startedAt: Date.now()
    });
    
    document.getElementById('teacher-login-section').style.display = 'none';
    document.getElementById('teacher-dashboard').style.display = 'block';
    showMessage('세션이 시작되었습니다! 학생들이 로비에 입장할 때까지 기다려주세요.', 'success');
}

// 게임 시작
function startGame() {
    const gameTimeMinutes = window.gameTimeMinutes || 0;
    
    // Firebase RTDB에서 로비 플레이어 가져와서 게임 생성
    database.ref('lobby/players').once('value').then(snapshot => {
        if (!snapshot.exists() || Object.keys(snapshot.val()).length < 2) {
            showMessage('최소 2명의 플레이어가 필요합니다.', 'error');
            return;
        }
        
        const players = Object.values(snapshot.val());
        const shuffled = [...players].sort(() => Math.random() - 0.5);
        
        // 방으로 분할 (최대 5명씩)
        const rooms = [];
        for (let i = 0; i < shuffled.length; i += MAX_PLAYERS_PER_ROOM) {
            rooms.push(shuffled.slice(i, i + MAX_PLAYERS_PER_ROOM));
        }
        
        // 장소 목록 가져오기
        return database.ref('locations').once('value').then(locSnapshot => {
            const locations = locSnapshot.exists() 
                ? (Array.isArray(locSnapshot.val()) ? locSnapshot.val() : Object.values(locSnapshot.val()))
                : defaultChuncheonLocations;
            
            const createdGameIds = [];
            
            rooms.forEach((roomPlayers) => {
                const gameId = Math.floor(100000 + Math.random() * 900000).toString();
                createdGameIds.push(gameId);
                
                // 스파이 선택
                const spyIndex = Math.floor(Math.random() * roomPlayers.length);
                
                // 장소 할당
                const shuffledLocations = [...locations].sort(() => Math.random() - 0.5);
                const assignedLocation = shuffledLocations[0];
                
                const gameData = {
                    id: gameId,
                    players: roomPlayers.map((p, idx) => ({
                        id: p.id,
                        name: p.name,
                        location: idx === spyIndex ? null : assignedLocation,
                        isSpy: idx === spyIndex,
                        hasWritten: false
                    })),
                    status: 'playing',
                    spyId: roomPlayers[spyIndex].id,
                    assignedLocation: assignedLocation,
                    descriptions: {},
                    votes: {},
                    hostId: 'teacher_' + Date.now(),
                    gameTimeMinutes: gameTimeMinutes,
                    timeEndTime: gameTimeMinutes > 0 ? Date.now() + (gameTimeMinutes * 60 * 1000) : null
                };
                
                database.ref('games/' + gameId).set(gameData);
            });
            
            // 로비 플레이어 제거
            database.ref('lobby/players').remove();
            
            // 게임 시작 알림
            showMessage(`🎮 게임이 시작되었습니다! (${rooms.length}개 방)`, 'success');
        });
    });
}

// 교사용 메시지 표시
function showMessage(message, type) {
    const msgEl = document.getElementById('teacher-message');
    if (msgEl) {
        msgEl.textContent = message;
        msgEl.className = 'teacher-message ' + type;
        msgEl.style.display = 'block';
        
        setTimeout(() => {
            msgEl.style.display = 'none';
        }, 5000);
    }
}