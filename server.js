const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 정적 파일 제공
app.use(express.static(path.join(__dirname)));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 파일 업로드 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('이미지 파일만 업로드 가능합니다.'));
        }
    }
});

// 게임 상태 저장
const games = {};

// 게임 설정
const MAX_PLAYERS_PER_ROOM = 5;
const MIN_PLAYERS_TO_START = 2;

// 장소 데이터 파일 경로
const LOCATIONS_FILE = path.join(__dirname, 'locations.json');

// locations.json에서 장소 데이터 로드
function loadLocations() {
    try {
        if (fs.existsSync(LOCATIONS_FILE)) {
            const data = fs.readFileSync(LOCATIONS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('장소 데이터 로드 실패:', error);
    }
    return [];
}

// locations.json에 장소 데이터 저장
function saveLocations(locations) {
    try {
        fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(locations, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('장소 데이터 저장 실패:', error);
        return false;
    }
}

// 기본 춘천 장소 데이터
const defaultChuncheonLocations = [
    { id: '1', name: '남춘천역', emoji: '🚉', description: '춘천의 교통 중심지', image: null },
    { id: '2', name: '공지천', emoji: '💧', description: '춘천의 아름다운 자연 호수', image: null },
    { id: '3', name: '소양강 스카이워크', emoji: '🌉', description: '소양강 위를 걷는 짜릿한 하늘길', image: null },
    { id: '4', name: '닭갈비 골목', emoji: '🍗', description: '춘천의 대표 음식 맛집 거리', image: null },
    { id: '5', name: '춘천시청', emoji: '🏛️', description: '춘천의 행정 중심지', image: null },
    { id: '6', name: '무궁화 타워', emoji: '🌸', description: '춘천의 상징 탑', image: null },
    { id: '7', name: '김유정 문학촌', emoji: '📚', description: '작가 김유정의 생가와 문학 공간', image: null },
    { id: '8', name: '춘천 호수', emoji: '🏞️', description: '아름다운 경관의 인공 호수', image: null }
];

// 장소 데이터 초기화
let chuncheonLocations = loadLocations();
if (chuncheonLocations.length === 0) {
    chuncheonLocations = [...defaultChuncheonLocations];
    saveLocations(chuncheonLocations);
}

// ==================== 게임 방 관리 API ====================

// 모든 방 조회
app.get('/api/rooms', (req, res) => {
    const roomsList = Object.values(games).map(game => ({
        gameId: game.id,
        playerCount: game.players.length,
        status: game.status,
        hostId: game.hostId
    }));
    res.json(roomsList);
});

// 방 삭제
app.delete('/api/rooms/:gameId', (req, res) => {
    const gameId = req.params.gameId;
    
    if (!games[gameId]) {
        return res.status(404).json({ error: '방을 찾을 수 없습니다.' });
    }
    
    delete games[gameId];
    
    res.json({ 
        success: true, 
        message: '방이 삭제되었습니다.' 
    });
});

// ==================== 장소 관리 API ====================

// 모든 장소 조회
app.get('/api/locations', (req, res) => {
    const locations = loadLocations();
    res.json(locations);
});

// 장소 추가
app.post('/api/locations', upload.single('image'), (req, res) => {
    try {
        const { name, description } = req.body;
        const image = req.file;
        
        if (!name || !description) {
            return res.status(400).json({ error: '장소 이름과 설명은 필수입니다.' });
        }
        
        const locations = loadLocations();
        
        // 중복 이름 확인
        if (locations.some(loc => loc.name === name)) {
            return res.status(400).json({ error: '이미 존재하는 장소 이름입니다.' });
        }
        
        const newId = Date.now().toString();
        const newLocation = {
            id: newId,
            name: name,
            emoji: '📍',
            description: description,
            image: image ? `/uploads/${image.filename}` : null
        };
        
        locations.push(newLocation);
        
        if (saveLocations(locations)) {
            chuncheonLocations = locations;
            res.json({ 
                success: true, 
                location: newLocation,
                message: '장소가 추가되었습니다.'
            });
        } else {
            res.status(500).json({ error: '장소 저장에 실패했습니다.' });
        }
    } catch (error) {
        res.status(500).json({ error: '장소 추가 중 오류가 발생했습니다.' });
    }
});

// 장소 삭제
app.delete('/api/locations/:id', (req, res) => {
    try {
        const id = req.params.id;
        let locations = loadLocations();
        
        const index = locations.findIndex(loc => loc.id === id);
        
        if (index !== -1) {
            const deleted = locations[index];
            
            // 사진 파일 삭제
            if (deleted.image) {
                const photoPath = path.join(__dirname, deleted.image);
                if (fs.existsSync(photoPath)) {
                    fs.unlinkSync(photoPath);
                }
            }
            
            locations.splice(index, 1);
            
            if (saveLocations(locations)) {
                chuncheonLocations = locations;
                res.json({ 
                    success: true, 
                    location: deleted,
                    message: '장소가 삭제되었습니다.'
                });
            } else {
                res.status(500).json({ error: '장소 삭제에 실패했습니다.' });
            }
        } else {
            res.status(404).json({ error: '장소를 찾을 수 없습니다.' });
        }
    } catch (error) {
        res.status(500).json({ error: '장소 삭제 중 오류가 발생했습니다.' });
    }
});

// 장소 수정
app.put('/api/locations/:id', upload.single('image'), (req, res) => {
    try {
        const id = req.params.id;
        const { name, description } = req.body;
        const image = req.file;
        
        let locations = loadLocations();
        
        const index = locations.findIndex(loc => loc.id === id);
        
        if (index !== -1) {
            if (name) locations[index].name = name;
            if (description) locations[index].description = description;
            if (image) locations[index].image = `/uploads/${image.filename}`;
            
            if (saveLocations(locations)) {
                chuncheonLocations = locations;
                res.json({ 
                    success: true, 
                    location: locations[index],
                    message: '장소가 수정되었습니다.'
                });
            } else {
                res.status(500).json({ error: '장소 저장에 실패했습니다.' });
            }
        } else {
            res.status(404).json({ error: '장소를 찾을 수 없습니다.' });
        }
    } catch (error) {
        res.status(500).json({ error: '장소 수정 중 오류가 발생했습니다.' });
    }
});

// ==================== Socket.io 연결 처리 ====================
io.on('connection', (socket) => {
    console.log('새로운 플레이어 연결:', socket.id);

    // 게임 생성
    socket.on('createGame', (playerName) => {
        const gameId = Math.floor(100000 + Math.random() * 900000).toString();
        games[gameId] = {
            id: gameId,
            players: [],
            status: 'waiting',
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

    // 게임 참가
    socket.on('joinGame', ({ gameId, playerName }) => {
        // 대소문자 구분 없이 게임 검색
        const gameIdUpper = gameId.toUpperCase();
        const foundGameId = Object.keys(games).find(id => id.toUpperCase() === gameIdUpper);
        
        if (!foundGameId) {
            socket.emit('error', '게임을 찾을 수 없습니다.');
            return;
        }
        
        const game = games[foundGameId];
        
        if (game.status !== 'waiting') {
            socket.emit('error', '이미 게임이 시작되었습니다.');
            return;
        }
        
        let targetGameId = foundGameId;
        if (game.players.length >= MAX_PLAYERS_PER_ROOM) {
            const hostGames = Object.values(games).filter(g => 
                g.hostId === game.hostId && 
                g.status === 'waiting' && 
                g.players.length < MAX_PLAYERS_PER_ROOM
            );
            
            if (hostGames.length > 0) {
                targetGameId = hostGames[0].id;
                socket.emit('roomReassigned', { 
                    newGameId: targetGameId,
                    message: `방이 꽉 차서 자동으로 다른 방(${targetGameId})에 배정되었습니다.`
                });
            } else {
                const newGameId = Math.floor(100000 + Math.random() * 900000).toString();
                games[newGameId] = {
                    id: newGameId,
                    players: [],
                    status: 'waiting',
                    spyId: null,
                    locations: [],
                    descriptions: {},
                    votes: {},
                    hostId: game.hostId
                };
                
                targetGameId = newGameId;
                socket.emit('roomReassigned', { 
                    newGameId: targetGameId,
                    message: `새 방(${targetGameId})이 생성되어 배정되었습니다.`
                });
            }
        }
        
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
                player.location = null;
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
        
        const allWritten = game.players.every(p => p.hasWritten);
        
        if (allWritten) {
            game.status = 'voting';
            
            const descriptionsList = game.players.map(p => ({
                playerId: p.id,
                playerName: p.name,
                description: game.descriptions[p.id],
                isSpy: p.id === game.spyId
            }));
            
            io.to(gameId).emit('allDescriptionsSubmitted', descriptionsList);
            
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
        
        const allVoted = game.players.every(p => game.votes[p.id]);
        
        if (allVoted) {
            const voteCount = {};
            game.players.forEach(p => {
                voteCount[p.id] = 0;
            });
            
            Object.values(game.votes).forEach(votedId => {
                voteCount[votedId]++;
            });
            
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

    // 교사용: 방 생성
    socket.on('teacherCreateRoom', () => {
        const gameId = Math.floor(100000 + Math.random() * 900000).toString();
        games[gameId] = {
            id: gameId,
            players: [],
            status: 'waiting',
            spyId: null,
            locations: [],
            descriptions: {},
            votes: {},
            hostId: socket.id
        };
        
        socket.emit('roomCreated', { gameId });
    });
    
    // 교사용: 게임 시작
    socket.on('teacherStartGame', ({ gameId }) => {
        if (!games[gameId]) {
            socket.emit('error', '게임 방을 찾을 수 없습니다.');
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
                player.location = null;
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
        
        socket.emit('gameStarted');
    });

    // 연결 해제
    socket.on('disconnect', () => {
        console.log('플레이어 연결 해제:', socket.id);
        
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
    console.log(`교사용 페이지: http://localhost:${PORT}/teacher.html`);
    
    // 로컬 IP 주소 표시
    const interfaces = require('os').networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`네트워크 접속: http://${iface.address}:${PORT}`);
                console.log(`같은 WiFi에 연결된 기기에서 위 주소로 접속하세요!`);
                break;
            }
        }
    }
});
