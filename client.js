    // Socket.io 연결
const socket = io();

// 게임 상태
let gameState = {
    gameId: null,
    playerId: null,
    playerName: null,
    currentScreen: 'start',
    role: null, // 'spy' or 'citizen'
    location: null,
    hasWritten: false
};

// ==================== 역할 기반 UI 설정 ====================
function setupRoleBasedUI() {
    const urlParams = new URLSearchParams(window.location.search);
    const role = urlParams.get('role'); // 'teacher' or 'student'
    
    const createGameSection = document.getElementById('create-game-section');
    const formDivider = document.getElementById('form-divider');
    const teacherLink = document.getElementById('teacher-link');
    
    if (role === 'teacher') {
        // 교사용: 게임 만들기 표시
        if (createGameSection) createGameSection.style.display = 'block';
        if (formDivider) formDivider.style.display = 'block';
        if (teacherLink) teacherLink.style.display = 'none';
    } else {
        // 학생용 또는 기본값: 게임 만들기 숨김
        if (createGameSection) createGameSection.style.display = 'none';
        if (formDivider) formDivider.style.display = 'none';
        if (teacherLink) teacherLink.style.display = 'none';
    }
}

// ==================== 화면 관리 ====================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
    gameState.currentScreen = screenId;
}

// ==================== 게임 생성 ====================
function createGame() {
    const playerName = document.getElementById('create-player-name').value.trim();
    
    if (!playerName) {
        showPopup('이름을 입력해주세요!');
        return;
    }
    
    gameState.playerName = playerName;
    socket.emit('createGame', playerName);
}

// ==================== 게임 참가 (시작 화면에서) ====================
function joinGameFromStart() {
    const gameId = document.getElementById('join-game-id-input').value.trim();
    const playerName = document.getElementById('join-player-name-input').value.trim();
    
    if (!gameId) {
        showPopup('게임 코드를 입력해주세요!');
        return;
    }
    
    if (!playerName) {
        showPopup('이름을 입력해주세요!');
        return;
    }
    
    gameState.playerName = playerName;
    socket.emit('joinGame', { gameId, playerName });
}


// ==================== 게임 시작 ====================
function startGame() {
    socket.emit('startGame');
}

// ==================== 역할 확인 후 다음으로 ====================
function proceedToWrite() {
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
}

// ==================== 투표 ====================
function submitVote(votedPlayerId) {
    socket.emit('submitVote', votedPlayerId);
}

// ==================== 다시 하기 ====================
function playAgain() {
    socket.emit('restartGame');
}

function goToStart() {
    location.reload();
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

// 게임 생성됨
socket.on('gameCreated', (data) => {
    gameState.gameId = data.gameId;
    gameState.playerId = data.playerId;
    document.getElementById('game-id').textContent = data.gameId;
    showScreen('waiting-room');
});

// 게임 참가됨
socket.on('gameJoined', (data) => {
    gameState.gameId = data.gameId;
    gameState.playerId = data.playerId;
    showScreen('waiting-room');
});

// 플레이어 참가
socket.on('playerJoined', (data) => {
    const playersContainer = document.getElementById('players-container');
    const playerItem = document.createElement('div');
    playerItem.className = 'player-item';
    playerItem.innerHTML = `
        <span class="player-emoji">👤</span>
        <span>${data.playerName}</span>
    `;
    playersContainer.appendChild(playerItem);
    
    document.getElementById('player-count').textContent = `현재 ${data.playerCount}명`;
    
    // 최소 2명 이상이면 시작 버튼 활성화
    if (data.playerCount >= 2) {
        document.getElementById('start-button').disabled = false;
    }
});

// 플레이어 퇴장
socket.on('playerLeft', (data) => {
    showPopup(`${data.playerName}님이 게임을 나갔습니다.`);
    location.reload();
});

// 게임 시작됨 (세션에서 자동 배정 후)
socket.on('gameStarted', (data) => {
    if (data.message) {
        // 세션에서 시작된 경우
        showPopup(data.message, 2000);
    } else {
        // 기존 게임에서 시작된 경우
        showPopup('게임이 시작되었습니다!', 2000);
    }
});

// 스파이 역할
socket.on('spyRole', (data) => {
    gameState.role = 'spy';
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
    
    document.getElementById('role-emoji').textContent = '🕵️‍♂️';
    document.getElementById('role-title').textContent = '당신은 시민입니다!';
    document.getElementById('role-message').textContent = data.message;
    
    document.getElementById('location-emoji').textContent = data.location.emoji;
    document.getElementById('location-name').textContent = data.location.name;
    document.getElementById('location-card').style.display = 'block';
    
    showScreen('role-screen');
});

// 설명 제출됨
socket.on('descriptionSubmitted', () => {
    showPopup('설명이 제출되었습니다! 다른 플레이어를 기다려주세요.');
    showScreen('waiting-write-screen');
});

// 설명 작성 진행 상황
socket.on('waitingForDescriptions', (data) => {
    document.getElementById('write-progress').textContent = 
        `${data.writtenCount}/${data.totalCount} 작성 완료`;
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

// 투표 단계
socket.on('votingPhase', (data) => {
    const voteOptions = document.getElementById('vote-options');
    voteOptions.innerHTML = '';
    
    data.players.forEach(player => {
        const button = document.createElement('button');
        button.className = 'vote-option';
        button.textContent = player.name;
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

// 게임 재시작됨
socket.on('gameRestarted', () => {
    showPopup('게임이 재시작되었습니다!');
    location.reload();
});

// 에러
socket.on('error', (message) => {
    showPopup(message);
});

// 방 재배정
socket.on('roomReassigned', (data) => {
    showPopup(data.message);
    gameState.gameId = data.newGameId;
});

// ==================== 이벤트 리스너 ====================
document.addEventListener('DOMContentLoaded', function() {
    // 역할 기반 UI 설정
    setupRoleBasedUI();
    
    // 엔터키로 게임 생성/참가
    document.getElementById('create-player-name').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            createGame();
        }
    });
    
    document.getElementById('join-game-id-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            joinGameFromStart();
        }
    });
    
    document.getElementById('join-player-name-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            joinGameFromStart();
        }
    });
    
    // ESC 키로 팝업 닫기
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closePopup();
        }
    });
});