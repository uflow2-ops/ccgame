// Firebase 초기화 (index.html에서 설정한 firebaseConfig 사용)
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
    locations: [],
    isTeacher: false
};

// Firebase 참조
let lobbyRef = null;
let gameRef = null;
let locationsRef = null;

// ==================== Firebase 초기화 ====================
function initFirebase() {
    // 로비 참조
    lobbyRef = database.ref('lobby');
    // 장소 참조
    locationsRef = database.ref('locations');
}

// ==================== 장소 목록 로드 ====================
function loadLobbyLocations() {
    locationsRef.once('value').then(snapshot => {
        const locations = snapshot.val() || [];
        renderLobbyLocations(locations);
    }).catch(error => {
        console.error('장소 목록 로드 실패:', error);
    });
}

// 로비용 장소 목록 렌더링
function renderLobbyLocations(locations) {
    const container = document.getElementById('lobby-locations-container');
    
    if (!locations || Object.keys(locations).length === 0) {
        container.innerHTML = `
            <div class="empty-lobby-locations" style="grid-column: 1 / -1; text-align: center; color: #95a5a6; padding: 20px;">
                등록된 장소가 없습니다.
            </div>
        `;
        return;
    }
    
    const locationsList = Object.values(locations);
    container.innerHTML = locationsList.map(location => `
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
            playerName: gameState.playerName,
            isTeacher: gameState.isTeacher
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
    gameState.playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    
    // Firebase에 플레이어 추가
    lobbyRef.child(gameState.playerId).set({
        name: playerName,
        joinedAt: Date.now()
    });
    
    // 로비 화면으로 이동
    showScreen('lobby-screen');
    
    // 장소 목록 미리 로드
    loadLobbyLocations();
}

// ==================== 교사 세션 시작 ====================
function startTeacherSession() {
    const teacherName = document.getElementById('lobby-player-name').value.trim();
    
    if (!teacherName) {
        showPopup('교사 이름을 입력해주세요!');
        return;
    }
    
    gameState.playerName = teacherName;
    gameState.playerId = 'teacher_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    gameState.isTeacher = true;
    
    // 교사 세션 생성
    database.ref('teacher').set({
        teacherId: gameState.playerId,
        teacherName: teacherName,
        startedAt: Date.now()
    });
    
    // 로비에 교사도 표시
    lobbyRef.child(gameState.playerId).set({
        name: teacherName + ' (교사)',
        joinedAt: Date.now(),
        isTeacher: true
    });
}

// ==================== 게임 시작 (교사) ====================
function startGame() {
    if (!gameState.isTeacher) return;
    
    // 로비 플레이어들 가져오기
    lobbyRef.once('value').then(snapshot => {
        const players = snapshot.val() || {};
        const playerList = Object.entries(players).filter(([id, p]) => !p.isTeacher);
        
        if (playerList.length < 2) {
            showPopup('최소 2명의 플레이어가 필요합니다.');
            return;
        }
        
        // 방으로 분할 (최대 5명씩)
        const MAX_PLAYERS_PER_ROOM = 5;
        const rooms = [];
        for (let i = 0; i < playerList.length; i += MAX_PLAYERS_PER_ROOM) {
            rooms.push(playerList.slice(i, i + MAX_PLAYERS_PER_ROOM));
        }
        
        // 장소 가져오기
        return locationsRef.once('value').then(locSnapshot => {
            const locations = locSnapshot.val() || {};
            const locationsList = Object.values(locations);
            
            if (locationsList.length === 0) {
                showPopup('등록된 장소가 없습니다.');
                return;
            }
            
            // 방 생성 및 게임 시작
            rooms.forEach(roomPlayers => {
                const gameId = Math.floor(100000 + Math.random() * 900000).toString();
                
                // 스파이 선택
                const spyIndex = Math.floor(Math.random() * roomPlayers.length);
                const spyId = roomPlayers[spyIndex][0];
                
                // 장소 할당
                const shuffledLocations = [...locationsList].sort(() => Math.random() - 0.5);
                const assignedLocation = shuffledLocations[0];
                
                // 게임 데이터 생성
                const gameData = {
                    status: 'playing',
                    spyId: spyId,
                    assignedLocation: assignedLocation,
                    players: {},
                    descriptions: {},
                    votes: {},
                    createdAt: Date.now()
                };
                
                // 플레이어 데이터 추가
                roomPlayers.forEach(([playerId, player]) => {
                    gameData.players[playerId] = {
                        id: playerId,
                        name: player.name,
                        isSpy: playerId === spyId,
                        hasWritten: false
                    };
                });
                
                // Firebase에 게임 저장
                database.ref('games/' + gameId).set(gameData);
                
                // 로비에서 제거
                roomPlayers.forEach(([playerId]) => {
                    lobbyRef.child(playerId).remove();
                });
            });
            
            showPopup('게임이 시작되었습니다!');
        });
    });
}

// ==================== 설명 작성 ====================
function submitDescription() {
    if (!gameState.gameId) return;
    
    const description = document.getElementById('description-input').value.trim();
    
    if (!description) {
        showPopup('설명을 작성해주세요!');
        return;
    }
    
    // Firebase에 설명 저장
    database.ref('games/' + gameState.gameId + '/descriptions/' + gameState.playerId).set({
        text: description,
        submittedAt: Date.now()
    });
    
    // 작성 완료 표시
    database.ref('games/' + gameState.gameId + '/players/' + gameState.playerId + '/hasWritten').set(true);
    
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
    if (!gameState.gameId) return;
    
    // Firebase에 투표 저장
    database.ref('games/' + gameState.gameId + '/votes/' + gameState.playerId).set({
        votedPlayerId: votedPlayerId,
        votedAt: Date.now()
    });
    
    showPopup('투표가 완료되었습니다! 다른 플레이어를 기다려주세요.');
    showScreen('waiting-vote-screen');
}

// ==================== 로비로 돌아가기 ====================
function returnToLobby() {
    if (gameState.gameId) {
        // 게임에서 제거
        database.ref('games/' + gameState.gameId + '/players/' + gameState.playerId).remove();
    }
    
    clearGameInfo();
    location.reload();
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

// ==================== Firebase 실시간 리스너 ====================

// 로비 업데이트 (참가자 목록)
function setupLobbyListener() {
    lobbyRef.on('value', snapshot => {
        const players = snapshot.val() || {};
        const container = document.getElementById('lobby-players-container');
        container.innerHTML = '';
        
        const playerList = Object.entries(players).filter(([id, p]) => !p.isTeacher);
        
        if (playerList.length === 0) {
            container.innerHTML = '<div class="empty-lobby">아직 참가자가 없습니다.</div>';
            document.getElementById('lobby-player-count').textContent = '현재 0명';
            return;
        }
        
        playerList.forEach(([id, player]) => {
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';
            playerItem.innerHTML = `
                <span class="player-emoji">👤</span>
                <span>${player.name}</span>
            `;
            container.appendChild(playerItem);
        });
        
        document.getElementById('lobby-player-count').textContent = `현재 ${playerList.length}명`;
    });
}

// 게임 상태 리스너
function setupGameListener() {
    if (!gameState.gameId) return;
    
    gameRef = database.ref('games/' + gameState.gameId);
    
    // 게임 상태 변경 감지
    gameRef.on('value', snapshot => {
        const game = snapshot.val();
        if (!game) return;
        
        // 내 플레이어 정보 확인
        const myPlayer = game.players && game.players[gameState.playerId];
        if (myPlayer) {
            gameState.role = myPlayer.isSpy ? 'spy' : 'citizen';
            gameState.hasWritten = myPlayer.hasWritten || false;
            
            // 역할 화면으로 이동 (아직 이동하지 않았다면)
            if (gameState.currentScreen === 'start' && !sessionStorage.getItem('roleShown')) {
                showRoleScreen(game, myPlayer);
                sessionStorage.setItem('roleShown', 'true');
            }
        }
        
        // 설명 실시간 업데이트
        if (game.descriptions) {
            updateDescriptions(game.descriptions, game.players);
        }
        
        // 투표 단계 감지
        if (game.status === 'voting' && !sessionStorage.getItem('votingStarted')) {
            showVotingPhase(game);
            sessionStorage.setItem('votingStarted', 'true');
        }
        
        // 게임 종료 감지
        if (game.status === 'ended' && !sessionStorage.getItem('gameEnded')) {
            showGameResult(game);
            sessionStorage.setItem('gameEnded', 'true');
        }
    });
}

// 역할 화면 표시
function showRoleScreen(game, myPlayer) {
    if (myPlayer.isSpy) {
        gameState.role = 'spy';
        document.getElementById('role-emoji').textContent = '🕵️';
        document.getElementById('role-title').textContent = '당신은 스파이입니다!';
        document.getElementById('role-message').textContent = '당신은 스파이입니다! 다른 플레이어들이 어떤 장소를 받았는지 추리해보세요.';
        document.getElementById('location-card').style.display = 'none';
    } else {
        gameState.role = 'citizen';
        gameState.location = game.assignedLocation;
        document.getElementById('role-emoji').textContent = '🕵️‍♂️';
        document.getElementById('role-title').textContent = '당신은 시민입니다!';
        document.getElementById('role-message').textContent = `당신의 장소는 ${game.assignedLocation.emoji} ${game.assignedLocation.name}입니다. 이 장소에 대한 설명을 작성해주세요.`;
        
        document.getElementById('location-emoji').textContent = game.assignedLocation.emoji;
        document.getElementById('location-name').textContent = game.assignedLocation.name;
        document.getElementById('location-card').style.display = 'block';
    }
    
    showScreen('role-screen');
}

// 설명 업데이트
function updateDescriptions(descriptions, players) {
    const allWritten = players && Object.values(players).every(p => p.hasWritten);
    
    if (allWritten && !sessionStorage.getItem('allWritten')) {
        // 모든 설명 제출 완료 - 투표 단계로
        sessionStorage.setItem('allWritten', 'true');
        showVotingPhaseFromDescriptions(descriptions, players);
    } else if (gameState.currentScreen === 'write-screen') {
        // 실시간으로 설명 업데이트
        Object.entries(descriptions).forEach(([playerId, desc]) => {
            if (desc.text && !document.querySelector(`[data-player-id="${playerId}"]`)) {
                const player = players[playerId];
                if (player) {
                    addLiveFeedMessage(player.name, desc.text, playerId === gameState.playerId);
                }
            }
        });
        
        // 진행 상황 업데이트
        const writtenCount = Object.keys(descriptions).length;
        const totalCount = players ? Object.keys(players).length : 0;
        document.getElementById('write-progress').textContent = `${writtenCount}/${totalCount} 작성 완료`;
    }
}

// 투표 화면 표시
function showVotingPhase(game) {
    const voteOptions = document.getElementById('vote-options');
    voteOptions.innerHTML = '';
    
    if (!game.players) return;
    
    Object.entries(game.players).forEach(([playerId, player]) => {
        const button = document.createElement('button');
        button.className = 'vote-option';
        
        const description = game.descriptions && game.descriptions[playerId] 
            ? game.descriptions[playerId].text 
            : '';
        
        const shortDesc = description.length > 30 
            ? description.substring(0, 30) + '...' 
            : description;
        
        button.innerHTML = `
            <div class="vote-player-name">${player.name}</div>
            ${shortDesc ? `<div class="vote-player-desc">${shortDesc}</div>` : ''}
        `;
        button.onclick = () => submitVote(playerId);
        voteOptions.appendChild(button);
    });
    
    showScreen('vote-screen');
}

// 설명 기반 투표 화면
function showVotingPhaseFromDescriptions(descriptions, players) {
    const voteOptions = document.getElementById('vote-options');
    voteOptions.innerHTML = '';
    
    Object.entries(players).forEach(([playerId, player]) => {
        const button = document.createElement('button');
        button.className = 'vote-option';
        
        const description = descriptions[playerId] 
            ? descriptions[playerId].text 
            : '';
        
        const shortDesc = description.length > 30 
            ? description.substring(0, 30) + '...' 
            : description;
        
        button.innerHTML = `
            <div class="vote-player-name">${player.name}</div>
            ${shortDesc ? `<div class="vote-player-desc">${shortDesc}</div>` : ''}
        `;
        button.onclick = () => submitVote(playerId);
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
    
    // 투표 결과 계산
    const voteCount = {};
    if (game.votes) {
        Object.values(game.votes).forEach(vote => {
            voteCount[vote.votedPlayerId] = (voteCount[vote.votedPlayerId] || 0) + 1;
        });
    }
    
    let maxVotes = 0;
    let accusedPlayerId = null;
    Object.entries(voteCount).forEach(([playerId, count]) => {
        if (count > maxVotes) {
            maxVotes = count;
            accusedPlayerId = playerId;
        }
    });
    
    const spyPlayer = game.players && Object.values(game.players).find(p => p.isSpy);
    const accusedPlayer = game.players && game.players[accusedPlayerId];
    
    const spyCaught = accusedPlayerId === game.spyId;
    
    if (spyCaught) {
        resultTitle.textContent = '시민 승리!';
        resultEmoji.textContent = '🎉';
        resultMessage.textContent = '스파이를 잡았습니다!';
    } else {
        resultTitle.textContent = '스파이 승리!';
        resultEmoji.textContent = '🕵️';
        resultMessage.textContent = '스파이가 들키지 않았습니다!';
    }
    
    // 투표 결과 표시
    let voteDetails = `스파이: ${spyPlayer ? spyPlayer.name : '?'}\n`;
    voteDetails += `지목당한 사람: ${accusedPlayer ? accusedPlayer.name : '?'}\n\n`;
    voteDetails += '투표 결과:\n';
    
    if (game.players) {
        Object.entries(game.players).forEach(([playerId, player]) => {
            voteDetails += `${player.name}: ${voteCount[playerId] || 0}표\n`;
        });
    }
    
    resultDetails.textContent = voteDetails;
    
    showScreen('result-screen');
}

// ==================== 이벤트 리스너 ====================
document.addEventListener('DOMContentLoaded', function() {
    // Firebase 초기화
    initFirebase();
    
    // 페이지 로드 시 재접속 시도
    const savedGameInfo = loadGameInfo();
    if (savedGameInfo && savedGameInfo.gameId && savedGameInfo.playerName) {
        gameState.gameId = savedGameInfo.gameId;
        gameState.playerName = savedGameInfo.playerName;
        gameState.isTeacher = savedGameInfo.isTeacher || false;
        
        // 게임 리스너 설정
        setupGameListener();
    }
    
    // 로비 리스너 설정
    setupLobbyListener();
    
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