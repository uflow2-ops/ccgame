const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    transports: ['websocket', 'polling'],
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 정적 파일 제공
app.use(express.static(path.join(__dirname)));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==================== Cloudinary 설정 (외부 영구 저장) ====================
// 환경변수가 설정되면 Cloudinary에 업로드(재배포 후에도 유지),
// 미설정 시 로컬 uploads/ 폴더에 fallback(기존 동작)
const cloudinaryConfigured = !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

if (cloudinaryConfigured) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
    console.log('☁️ Cloudinary 영구 저장소 사용 중 (재배포 후에도 사진/장소 유지)');
} else {
    console.log('⚠️ Cloudinary 환경변수 미설정: 로컬 uploads/ 폴더에 저장 (재배포 시 사라질 수 있음)');
}

// 파일 업로드 설정 (메모리 버퍼로 받아 Cloudinary 또는 로컬에 저장)
const upload = multer({
    storage: multer.memoryStorage(),
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

// 전역 로비
const lobbyPlayers = []; // { id: socketId, name: string }

// 교사 세션
let teacherSession = null; // { teacherId, teacherName }

// 장소 데이터 파일 경로
const LOCATIONS_FILE = path.join(__dirname, 'locations.json');

// locations.json에서 장소 데이터 로드
// Cloudinary 설정 시: 외부 raw 파일에서 로드(재배포 후에도 유지), 실패 시 로컬 fallback
async function loadLocations() {
    if (cloudinaryConfigured) {
        try {
            const url = cloudinary.url('chuncheon-spy/locations', { resource_type: 'raw' });
            const resp = await fetch(url);
            if (resp.ok) {
                return await resp.json();
            }
        } catch (error) {
            console.error('Cloudinary 장소 데이터 로드 실패, 로컬 fallback:', error);
        }
    }
    // 로컬 fallback
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
// 항상 로컬에 백업 쓰고, Cloudinary 설정 시 외부 raw 파일에도 영구 저장
async function saveLocations(locations) {
    // 로컬 백업
    try {
        fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(locations, null, 2), 'utf8');
    } catch (error) {
        console.error('로컬 장소 데이터 저장 실패:', error);
    }

    // Cloudinary 영구 저장
    if (cloudinaryConfigured) {
        try {
            const json = JSON.stringify(locations, null, 2);
            await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'chuncheon-spy', public_id: 'locations', resource_type: 'raw', overwrite: true },
                    (err, result) => err ? reject(err) : resolve(result)
                );
                stream.end(Buffer.from(json, 'utf8'));
            });
        } catch (error) {
            console.error('Cloudinary 장소 데이터 저장 실패:', error);
            return false;
        }
    }
    return true;
}

// ==================== 영구 저장 헬퍼 (Cloudinary) ====================

// 이미지 버퍼를 Cloudinary에 업로드하거나, 미설정 시 로컬 uploads/에 저장
// 반환값: { url, publicId } (로컬 저장 시 publicId는 null)
async function saveImage(file) {
    if (!file) return { url: null, publicId: null };

    if (cloudinaryConfigured) {
        return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { folder: 'chuncheon-spy/locations', resource_type: 'image' },
                (error, result) => {
                    if (error) return reject(error);
                    resolve({ url: result.secure_url, publicId: result.public_id });
                }
            );
            stream.end(file.buffer);
        });
    }

    // Fallback: 로컬 디스크 저장
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    const filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    fs.writeFileSync(path.join(uploadDir, filename), file.buffer);
    return { url: `/uploads/${filename}`, publicId: null };
}

// Cloudinary 이미지 삭제 (로컬인 경우 파일 삭제)
async function deleteImage(location) {
    if (!location || !location.image) return;
    try {
        if (cloudinaryConfigured && location.publicId) {
            await cloudinary.uploader.destroy(location.publicId);
        } else if (!cloudinaryConfigured) {
            const photoPath = path.join(__dirname, location.image);
            if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
        }
    } catch (error) {
        console.error('이미지 삭제 실패:', error);
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

// 장소 데이터 초기화 (비동기 로드)
let chuncheonLocations = [];

(async () => {
    chuncheonLocations = await loadLocations();
    if (chuncheonLocations.length === 0) {
        chuncheonLocations = [...defaultChuncheonLocations];
        await saveLocations(chuncheonLocations);
    }
})();

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
app.get('/api/locations', async (req, res) => {
    const locations = await loadLocations();
    res.json(locations);
});

// 장소 추가
app.post('/api/locations', upload.single('image'), async (req, res) => {
    try {
        const { name, description } = req.body;
        const image = req.file;
        
        if (!name || !description) {
            return res.status(400).json({ error: '장소 이름과 설명은 필수입니다.' });
        }
        
        const locations = await loadLocations();
        
        // 중복 이름 확인
        if (locations.some(loc => loc.name === name)) {
            return res.status(400).json({ error: '이미 존재하는 장소 이름입니다.' });
        }
        
        // 이미지를 영구 저장소(Cloudinary 또는 로컬)에 업로드
        const savedImage = await saveImage(image);
        
        const newId = Date.now().toString();
        const newLocation = {
            id: newId,
            name: name,
            emoji: '📍',
            description: description,
            image: savedImage.url,
            publicId: savedImage.publicId
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
        console.error('장소 추가 오류:', error);
        res.status(500).json({ error: '장소 추가 중 오류가 발생했습니다.' });
    }
});

// 장소 삭제
app.delete('/api/locations/:id', async (req, res) => {
    try {
        const id = req.params.id;
        let locations = await loadLocations();
        
        const index = locations.findIndex(loc => loc.id === id);
        
        if (index !== -1) {
            const deleted = locations[index];
            
            // 영구 저장소(Cloudinary 또는 로컬)에서 사진 삭제
            await deleteImage(deleted);
            
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
        console.error('장소 삭제 오류:', error);
        res.status(500).json({ error: '장소 삭제 중 오류가 발생했습니다.' });
    }
});

// 장소 수정
app.put('/api/locations/:id', upload.single('image'), async (req, res) => {
    try {
        const id = req.params.id;
        const { name, description } = req.body;
        const image = req.file;
        
        let locations = await loadLocations();
        
        const index = locations.findIndex(loc => loc.id === id);
        
        if (index !== -1) {
            if (name) locations[index].name = name;
            if (description) locations[index].description = description;
            
            // 새 이미지가 업로드된 경우에만 교체 (기존 이미지 삭제 후 새로 업로드)
            if (image) {
                await deleteImage(locations[index]);
                const savedImage = await saveImage(image);
                locations[index].image = savedImage.url;
                locations[index].publicId = savedImage.publicId;
            }
            
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
        console.error('장소 수정 오류:', error);
        res.status(500).json({ error: '장소 수정 중 오류가 발생했습니다.' });
    }
});

// ==================== Socket.io 연결 처리 ====================
io.on('connection', (socket) => {
    console.log('새로운 플레이어 연결:', socket.id);

    // ==================== 재접속 처리 ====================
    
    // 교사 재접속 요청
    socket.on('rejoinTeacherSession', (data) => {
        const { teacherName } = data;
        
        // 교사 세션이 존재하는지 확인
        if (!teacherSession) {
            socket.emit('rejoinTeacherFailed', { message: '교사 세션이 존재하지 않습니다.' });
            return;
        }
        
        // 교사 이름이 일치하는지 확인
        if (teacherSession.teacherName !== teacherName) {
            socket.emit('rejoinTeacherFailed', { message: '교사 이름이 일치하지 않습니다.' });
            return;
        }
        
        // 교사 세션 복구
        teacherSession.teacherId = socket.id;
        socket.join('lobby');
        socket.emit('rejoinTeacherSuccess', {
            teacherId: socket.id,
            teacherName: teacherName,
            lobbyPlayers: lobbyPlayers.map(p => ({ id: p.id, name: p.name })),
            games: Object.values(games).map(game => ({
                gameId: game.id,
                playerCount: game.players.length,
                status: game.status
            }))
        });
        
        console.log(`교사 ${teacherName}이 세션에 재접속했습니다.`);
    });
    
    // 학생이 게임 재접속 요청
    socket.on('rejoinGame', (data) => {
        const { gameId, playerName } = data;
        
        // 게임이 존재하는지 확인
        if (!games[gameId]) {
            socket.emit('rejoinFailed', { message: '게임을 찾을 수 없습니다.' });
            return;
        }
        
        const game = games[gameId];
        
        // 플레이어가 이미 게임에 참가했는지 확인 (이름으로 매칭)
        const existingPlayer = game.players.find(p => p.name === playerName);
        
        if (!existingPlayer) {
            socket.emit('rejoinFailed', { message: '해당 게임에 참가한 기록이 없습니다.' });
            return;
        }
        
        // 게임이 이미 종료되었는지 확인
        if (game.status === 'ended') {
            socket.emit('rejoinFailed', { message: '이미 종료된 게임입니다.' });
            return;
        }
        
        // 소켓 정보 업데이트 (기존 플레이어 정보 유지)
        const oldSocketId = existingPlayer.id;
        existingPlayer.id = socket.id; // 새로운 socket.id로 업데이트
        
        // 소켓 방 입장
        socket.join(gameId);
        socket.gameId = gameId;
        socket.playerName = playerName;
        socket.inGame = true;
        
        // 재접속 성공 - 게임 상태 복구
        socket.emit('rejoinSuccess', {
            gameId: gameId,
            playerName: playerName,
            role: existingPlayer.isSpy ? 'spy' : 'citizen',
            location: existingPlayer.isSpy ? null : existingPlayer.location,
            gameStatus: game.status,
            hasWritten: existingPlayer.hasWritten || false,
            players: game.players.map(p => ({
                id: p.id,
                name: p.name,
                isSpy: p.isSpy
            })),
            descriptions: game.descriptions || {},
            votes: game.votes || {}
        });
        
        // 방 전체에 재접속 알림
        io.to(gameId).emit('playerRejoined', {
            playerName: playerName,
            playerId: socket.id
        });
        
        console.log(`플레이어 ${playerName}이 게임 ${gameId}에 재접속했습니다. (이전 socket.id: ${oldSocketId})`);
    });

    // ==================== 로비 시스템 ====================

    // 학생이 로비에 입장
    socket.on('joinLobby', (playerName) => {
        socket.join('lobby');
        socket.playerName = playerName;
        socket.inGame = false;
        
        lobbyPlayers.push({ id: socket.id, name: playerName });
        
        socket.emit('joinedLobby', { playerId: socket.id });
        io.to('lobby').emit('lobbyUpdate', lobbyPlayers.map(p => ({ id: p.id, name: p.name })));
        
        // 교사에게도 로비 업데이트 알림
        if (teacherSession) {
            io.to(teacherSession.teacherId).emit('lobbyUpdate', lobbyPlayers.map(p => ({ id: p.id, name: p.name })));
        }
    });

    // 교사 세션 시작
    socket.on('teacherStartSession', (teacherName) => {
        teacherSession = { teacherId: socket.id, teacherName: teacherName };
        socket.join('lobby');
        socket.emit('sessionStarted', { teacherId: socket.id });
        io.to('lobby').emit('lobbyUpdate', lobbyPlayers.map(p => ({ id: p.id, name: p.name })));
    });

    // 교사가 게임 시작 (로비 플레이어들을 방으로 자동 분배)
    socket.on('teacherStartGame', (data) => {
        if (!teacherSession || teacherSession.teacherId !== socket.id) {
            socket.emit('error', '교사만 게임을 시작할 수 있습니다.');
            return;
        }
        
        if (lobbyPlayers.length < 2) {
            socket.emit('error', '최소 2명의 플레이어가 필요합니다.');
            return;
        }
        
        const gameTimeMinutes = data && data.gameTimeMinutes ? data.gameTimeMinutes : 0;
        
        // 로비 플레이어 섞기
        const shuffled = [...lobbyPlayers].sort(() => Math.random() - 0.5);
        
        // 방으로 분할 (최대 5명씩)
        const rooms = [];
        for (let i = 0; i < shuffled.length; i += MAX_PLAYERS_PER_ROOM) {
            rooms.push(shuffled.slice(i, i + MAX_PLAYERS_PER_ROOM));
        }
        
        const createdGameIds = [];
        
        rooms.forEach((roomPlayers) => {
            const gameId = Math.floor(100000 + Math.random() * 900000).toString();
            createdGameIds.push(gameId);
            
            games[gameId] = {
                id: gameId,
                players: [],
                status: 'waiting',
                spyId: null,
                locations: [],
                descriptions: {},
                completionTimes: {},
                votes: {},
                hostId: socket.id,
                teacherSessionId: teacherSession.teacherId,
                gameTimeMinutes: gameTimeMinutes,
                timeEndTime: null
            };
            
            roomPlayers.forEach(p => {
                const playerSocket = io.sockets.sockets.get(p.id);
                if (playerSocket) {
                    playerSocket.leave('lobby');
                    playerSocket.join(gameId);
                    playerSocket.gameId = gameId;
                    playerSocket.inGame = true;
                    
                    const player = {
                        id: p.id,
                        name: p.name,
                        location: null,
                        isSpy: false,
                        hasWritten: false
                    };
                    games[gameId].players.push(player);
                }
            });
            
            // 로비에서 제거
            roomPlayers.forEach(p => {
                const idx = lobbyPlayers.findIndex(lp => lp.id === p.id);
                if (idx !== -1) lobbyPlayers.splice(idx, 1);
            });
            
            // 각 방의 게임 시작
            const game = games[gameId];
            game.status = 'playing';
            
            // 스파이 선택
            const spyIndex = Math.floor(Math.random() * game.players.length);
            game.spyId = game.players[spyIndex].id;
            game.players[spyIndex].isSpy = true;
            
            // 장소 할당
            const shuffledLocations = [...chuncheonLocations].sort(() => Math.random() - 0.5);
            const assignedLocation = shuffledLocations[0];
            game.assignedLocation = assignedLocation;
            
            // 시간이 설정된 경우 종료 시간 설정
            if (gameTimeMinutes > 0) {
                game.timeEndTime = Date.now() + (gameTimeMinutes * 60 * 1000);
            }
            
            game.players.forEach(player => {
                if (player.id === game.spyId) {
                    player.location = null;
                    io.to(player.id).emit('spyRole', {
                        gameId: gameId,
                        message: '당신은 스파이입니다! 다른 플레이어들이 어떤 장소를 받았는지 추리해보세요.'
                    });
                } else {
                    player.location = assignedLocation;
                    io.to(player.id).emit('citizenRole', {
                        gameId: gameId,
                        location: assignedLocation,
                        message: `당신의 장소는 ${assignedLocation.emoji} ${assignedLocation.name}입니다. 이 장소에 대한 설명을 작성해주세요.`
                    });
                }
            });
            
            io.to(gameId).emit('gameStarted', { 
                gameId: gameId,
                playerCount: game.players.length,
                gameTimeMinutes: gameTimeMinutes
            });
        });
        
        // 로비 업데이트
        io.to('lobby').emit('lobbyUpdate', lobbyPlayers.map(p => ({ id: p.id, name: p.name })));
        socket.emit('gamesStarted', { roomCount: rooms.length, gameIds: createdGameIds });
    });

    // 설명 제출 (실시간 브로드캐스트)
    socket.on('submitDescription', (description) => {
        const gameId = socket.gameId;
        if (!games[gameId]) return;
        
        const game = games[gameId];
        const player = game.players.find(p => p.id === socket.id);
        
        if (!player || player.hasWritten) return;
        
        player.hasWritten = true;
        game.descriptions[socket.id] = description;
        game.completionTimes[socket.id] = Date.now();
        
        // 실시간으로 설명을 방 전체에 브로드캐스트
        io.to(gameId).emit('newDescription', {
            playerId: player.id,
            playerName: player.name,
            description: description
        });
        
        const allWritten = game.players.every(p => p.hasWritten);
        
        if (allWritten) {
            game.status = 'voting';
            
            const descriptionsList = game.players.map(p => ({
                playerId: p.id,
                playerName: p.name,
                description: game.descriptions[p.id],
                isSpy: p.id === game.spyId,
                completionTime: game.completionTimes[p.id]
            }));
            
            io.to(gameId).emit('allDescriptionsSubmitted', descriptionsList);
            
            // 설명을 복구할 수 있도록 descriptions도 전달
            setTimeout(() => {
                io.to(gameId).emit('votingPhase', {
                    players: game.players.map(p => ({
                        id: p.id,
                        name: p.name
                    })),
                    descriptions: game.descriptions
                });
            }, 2000);
        } else {
            socket.emit('descriptionSubmitted');
            io.to(gameId).emit('waitingForDescriptions', {
                writtenCount: game.players.filter(p => p.hasWritten).length,
                totalCount: game.players.length,
                latestWriter: player.name
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
            
            // Determine winner based on completion time (fastest citizen)
            let fastestPlayer = null;
            let fastestTime = Infinity;
            
            if (game.completionTimes) {
                game.players.forEach(player => {
                    if (!player.isSpy && game.completionTimes[player.id]) {
                        if (game.completionTimes[player.id] < fastestTime) {
                            fastestTime = game.completionTimes[player.id];
                            fastestPlayer = player;
                        }
                    }
                });
            }
            
            game.status = 'ended';
            
            const playersInfo = game.players.map(p => ({
                id: p.id,
                name: p.name,
                isSpy: p.id === game.spyId
            }));
            
            io.to(gameId).emit('gameEnded', {
                spyCaught,
                spyName: spyPlayer.name,
                accusedName: accusedPlayer.name,
                voteCount,
                players: playersInfo,
                actualSpyId: game.spyId,
                winningTeam: spyCaught ? 'citizens' : 'spy',
                fastestPlayer: fastestPlayer ? {
                    name: fastestPlayer.name,
                    completionTime: fastestTime
                } : null
            });
        } else {
            socket.emit('voteSubmitted');
            io.to(gameId).emit('waitingForVotes', {
                voteCount: Object.keys(game.votes).length,
                totalCount: game.players.length
            });
        }
    });

    // 게임 종료 후 로비로 복귀
    socket.on('returnToLobby', () => {
        const gameId = socket.gameId;
        if (!games[gameId]) return;
        
        const game = games[gameId];
        const player = game.players.find(p => p.id === socket.id);
        
        if (player) {
            // 소켓을 게임 방에서 로비로 이동
            socket.leave(gameId);
            socket.join('lobby');
            socket.gameId = null;
            socket.inGame = false;
            
            // 로비에 플레이어 추가
            lobbyPlayers.push({ id: socket.id, name: player.name });
            
            // 로비 업데이트
            io.to('lobby').emit('lobbyUpdate', lobbyPlayers.map(p => ({ id: p.id, name: p.name })));
            if (teacherSession) {
                io.to(teacherSession.teacherId).emit('lobbyUpdate', lobbyPlayers.map(p => ({ id: p.id, name: p.name })));
            }
            
            socket.emit('returnedToLobby');
        }
    });

    // 연결 해제
    socket.on('disconnect', () => {
        console.log('플레이어 연결 해제:', socket.id);
        
        // 로비에서 제거
        const lobbyIdx = lobbyPlayers.findIndex(p => p.id === socket.id);
        if (lobbyIdx !== -1) {
            lobbyPlayers.splice(lobbyIdx, 1);
            io.to('lobby').emit('lobbyUpdate', lobbyPlayers.map(p => ({ id: p.id, name: p.name })));
            if (teacherSession) {
                io.to(teacherSession.teacherId).emit('lobbyUpdate', lobbyPlayers.map(p => ({ id: p.id, name: p.name })));
            }
        }
        
        // 게임 방에서 제거 (재접속 가능하도록 즉시 삭제하지 않음)
        Object.keys(games).forEach(gameId => {
            const game = games[gameId];
            const playerIndex = game.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                // 플레이어를 즉시 제거하지 않고, 재접속 대기 상태로 유지
                // 5분간 재접속 기회 제공
                const player = game.players[playerIndex];
                player.disconnected = true;
                player.disconnectedAt = Date.now();
                
                // 방 전체에게 재접속 가능함을 알림
                io.to(gameId).emit('playerDisconnected', { 
                    playerName: player.name,
                    playerCount: game.players.length,
                    canReconnect: true
                });
                
                // 5분 후 자동 제거
                setTimeout(() => {
                    const currentPlayerIndex = game.players.findIndex(p => p.id === socket.id);
                    if (currentPlayerIndex !== -1 && game.players[currentPlayerIndex].disconnected) {
                        const playerName = game.players[currentPlayerIndex].name;
                        game.players.splice(currentPlayerIndex, 1);
                        
                        io.to(gameId).emit('playerLeft', { 
                            playerName, 
                            playerCount: game.players.length 
                        });
                        
                        if (game.players.length === 0) {
                            delete games[gameId];
                        }
                    }
                }, 5 * 60 * 1000); // 5분
            }
        });
        
        // 교사 세션 정리
        if (teacherSession && teacherSession.teacherId === socket.id) {
            teacherSession = null;
        }
    });
});

const PORT = process.env.PORT || 80;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`춘천 스파이 게임 서버가 포트 ${PORT}에서 실행 중입니다.`);
});
