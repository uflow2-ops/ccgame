const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 정적 파일 제공
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// 게임 상태 저장
const games = {};

// 게임 설정
const MAX_PLAYERS_PER_ROOM = 6;  // 방당 최대 인원
const MIN_PLAYERS_TO_START = 2;  // 게임 시작 최소 인원

// 춘천 장소 데이터
const chuncheonLocations = [
    { name: '남춘천역', emoji: '🚉', description: '춘천의 중심 교통枢纽' },
    { name: '공지천', emoji: '💧', description: '춘천의 아름다운 자연 호수' },
    { name: '소양강 스카이워크', emoji: '🌉', description: '소양강 위를 걷는 짜릿한 하늘길' },
    { name: '닭갈비 골목', emoji: '🍗', description: '춘천의 대표 음식 맛집 거리' },
    { name: '춘천시청', emoji: '🏛️', description: '춘천의 행정 중심지' },
    { name: '무궁화 타워', emoji: '🌸', description: '춘천의 상징 탑' },
    { name: '김유정 문학촌', emoji: '📚', description: '작가 김유정의 생가와 문학 공간' },
    { name: '춘천 호수', emoji: '🏞️', description: '아름다운 경관의 인공 호수' }
];

// Socket.io 연결 처리
io.on('connection', (socket) => {
    console.log('새로운 플레이어 연결:', socket.id);

    // 게임 생성
    socket.on('createGame', (playerName) => {
        const gameId = uuidv4().substring(0, 6);
        games[gameId] = {
            id: gameId,
            players: [],
            status: 'waiting', // waiting, playing, voting, ended
            spyId: null,
            locations: [],
            descriptions: {},
            votes: {},
            hostId: socket.id
        };
        
        socket.join(gameId);
        socket.gameId = gameId;
        
        const player = {
            id: socket.id,
            name: playerName,
            location: null,
            isSpy: false,
            hasWritten: false
        };
        
        games[gameId].players.push(player);
        
        socket.emit('gameCreated', { gameId, playerId: socket.id });
        io.to(gameId).emit('playerJoined', { playerName, playerCount: games[gameId].players.length });
    });

    // 게임 참가 (자동 방 분배 기능)
    socket.on('joinGame', ({ gameId, playerName }) => {
        // 해당 게임이 존재하는지 확인
        if (!games[gameId]) {
            socket.emit('error', '게임을 찾을 수 없습니다.');
            return;
        }
        
        const game = games[gameId];
        
        // 게임이 이미 시작되었는지 확인
        if (game.status !== 'waiting') {
            socket.emit('error', '이미 게임이 시작되었습니다.');
            return;
        }
        
        // 방이 꽉 찼는지 확인
        let targetGameId = gameId;
        if (game.players.length >= MAX_PLAYERS_PER_ROOM) {
            // 같은 호스트의 다른 방 찾기
            const hostGames = Object.values(games).filter(g => 
                g.hostId === game.hostId && 
                g.status === 'waiting' && 
                g.players.length < MAX_PLAYERS_PER_ROOM
            );
            
            if (hostGames.length > 0) {
                // 여유 있는 방이 있으면 그 방에 배정
                targetGameId = hostGames[0].id;
                socket.emit('roomReassigned', { 
                    newGameId: targetGameId,
                    message: `방이 꽉 차서 자동으로 다른 방(${targetGameId})에 배정되었습니다.`
                });
            } else {
                // 여유 있는 방이 없으면 새 방 생성
                const newGameId = uuidv4().substring(0, 6);
                games[newGameId] = {
                    id: newGameId,
                    players: [],
                    status: 'waiting',
                    spyId: null,
                    locations: [],
                    descriptions: {},
                    votes: {},
                    hostId: game.hostId  // 같은 호스트
                };
                
                targetGameId = newGameId;
                socket.emit('roomReassigned', { 
                    newGameId: targetGameId,
                    message: `새 방(${targetGameId})이 생성되어 배정되었습니다.`
                });
            }
        }
        
        // 게임에 참가
        socket.join(targetGameId);
        socket.gameId = targetGameId;
        
        const player = {
            id: socket.id,
            name: playerName,
            location: null,
            isSpy: false,
            hasWritten: false
        };
        
        games[targetGameId].players.push(player);
        
        io.to(targetGameId).emit('playerJoined', { 
            playerName, 
            playerCount: games[targetGameId].players.length 
        });
        
        socket.emit('gameJoined', { gameId: targetGameId, playerId: socket.id });
    });

    // 게임 시작
    socket.on('startGame', () => {
        const gameId = socket.gameId;
        if (!games[gameId] || games[gameId].hostId !== socket.id) {
            return;
        }
        
        const game = games[gameId];
        if (game.players.length < 2) {
            socket.emit('error', '최소 2명의 플레이어가 필요합니다.');
            return;
        }
        
        game.status = 'playing';
        
        // 스파이 선택
        const spyIndex = Math.floor(Math.random() * game.players.length);
        game.spyId = game.players[spyIndex].id;
        game.players[spyIndex].isSpy = true;
        
        // 장소 할당 (스파이 제외)
        const shuffledLocations = [...chuncheonLocations].sort(() => Math.random() - 0.5);
        const citizenLocations = shuffledLocations.slice(0, game.players.length - 1);
        
        let locationIndex = 0;
        game.players.forEach(player => {
            if (player.id === game.spyId) {
                player.location = null; // 스파이는 장소를 모름
                socket.to(player.id).emit('spyRole', {
                    message: '당신은 스파이입니다! 다른 플레이어들이 어떤 장소를 받았는지 추리해보세요.'
                });
            } else {
                player.location = citizenLocations[locationIndex];
                locationIndex++;
                socket.to(player.id).emit('citizenRole', {
                    location: player.location,
                    message: `당신의 장소는 ${player.location.emoji} ${player.location.name}입니다. 이 장소에 대한 설명을 작성해주세요.`
                });
            }
        });
        
        io.to(gameId).emit('gameStarted', { 
            playerCount: game.players.length 
        });
    });

    // 설명 제출
    socket.on('submitDescription', (description) => {
        const gameId = socket.gameId;
        if (!games[gameId]) return;
        
        const game = games[gameId];
        const player = game.players.find(p => p.id === socket.id);
        
        if (!player || player.hasWritten) return;
        
        player.hasWritten = true;
        game.descriptions[socket.id] = description;
        
        // 모든 플레이어가 작성했는지 확인
        const allWritten = game.players.every(p => p.hasWritten);
        
        if (allWritten) {
            game.status = 'voting';
            
            // 모든 설명을 모든 플레이어에게 전송
            const descriptionsList = game.players.map(p => ({
                playerId: p.id,
                playerName: p.name,
                description: game.descriptions[p.id],
                isSpy: p.id === game.spyId
            }));
            
            io.to(gameId).emit('allDescriptionsSubmitted', descriptionsList);
            
            // 투표 단계로 전환
            setTimeout(() => {
                io.to(gameId).emit('votingPhase', {
                    players: game.players.map(p => ({
                        id: p.id,
                        name: p.name
                    }))
                });
            }, 2000);
        } else {
            socket.emit('descriptionSubmitted');
            io.to(gameId).emit('waitingForDescriptions', {
                writtenCount: game.players.filter(p => p.hasWritten).length,
                totalCount: game.players.length
            });
        }
    });

    // 투표 제출
    socket.on('submitVote', (votedPlayerId) => {
        const gameId = socket.gameId;
        if (!games[gameId]) return;
        
        const game = games[gameId];
        
        if (!game.votes[socket.id]) {
            game.votes[socket.id] = votedPlayerId;
        }
        
        // 모든 투표가 완료되었는지 확인
        const allVoted = game.players.every(p => game.votes[p.id]);
        
        if (allVoted) {
            // 투표 집계
            const voteCount = {};
            game.players.forEach(p => {
                voteCount[p.id] = 0;
            });
            
            Object.values(game.votes).forEach(votedId => {
                voteCount[votedId]++;
            });
            
            // 가장 많은 표를 받은 사람 찾기
            let maxVotes = 0;
            let accusedPlayerId = null;
            Object.entries(voteCount).forEach(([playerId, count]) => {
                if (count > maxVotes) {
                    maxVotes = count;
                    accusedPlayerId = playerId;
                }
            });
            
            const accusedPlayer = game.players.find(p => p.id === accusedPlayerId);
            const spyPlayer = game.players.find(p => p.id === game.spyId);
            
            // 승리 조건 확인
            const spyCaught = accusedPlayerId === game.spyId;
            
            game.status = 'ended';
            
            io.to(gameId).emit('gameEnded', {
                spyCaught,
                spyName: spyPlayer.name,
                accusedName: accusedPlayer.name,
                voteCount,
                actualSpyId: game.spyId,
                winningTeam: spyCaught ? 'citizens' : 'spy'
            });
        } else {
            socket.emit('voteSubmitted');
            io.to(gameId).emit('waitingForVotes', {
                voteCount: Object.keys(game.votes).length,
                totalCount: game.players.length
            });
        }
    });

    // 게임 재시작
    socket.on('restartGame', () => {
        const gameId = socket.gameId;
        if (!games[gameId]) return;
        
        const game = games[gameId];
        
        // 게임 상태 초기화
        game.status = 'waiting';
        game.spyId = null;
        game.locations = [];
        game.descriptions = {};
        game.votes = {};
        
        game.players.forEach(player => {
            player.location = null;
            player.isSpy = false;
            player.hasWritten = false;
        });
        
        io.to(gameId).emit('gameRestarted');
    });

    // 연결 해제
    socket.on('disconnect', () => {
        console.log('플레이어 연결 해제:', socket.id);
        
        // 게임에서 플레이어 제거
        Object.keys(games).forEach(gameId => {
            const game = games[gameId];
            const playerIndex = game.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                const playerName = game.players[playerIndex].name;
                game.players.splice(playerIndex, 1);
                
                io.to(gameId).emit('playerLeft', { 
                    playerName, 
                    playerCount: game.players.length 
                });
                
                // 플레이어가 없으면 게임 삭제
                if (game.players.length === 0) {
                    delete games[gameId];
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`춘천 스파이 게임 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`로컬 접속: http://localhost:${PORT}`);
    console.log(`네트워크 접속: http://192.168.0.152:${PORT}`);
    console.log(`같은 WiFi에 연결된 기기에서 위 주소로 접속하세요!`);
});
