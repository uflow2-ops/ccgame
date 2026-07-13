const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

admin.initializeApp();
const db = admin.firestore();
const rtdb = admin.database();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// 게임 설정
const MAX_PLAYERS_PER_ROOM = 5;
const MIN_PLAYERS_TO_START = 2;

// Cloudinary 설정 (환경 변수에서 가져옴)
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
    console.log('☁️ Cloudinary 영구 저장소 사용 중');
}

// 파일 업로드 설정
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(`.${file.originalname.split('.').pop()}`);
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
});

// ==================== Cloudinary 헬퍼 함수 ====================

// 이미지 버퍼를 Cloudinary에 업로드하거나, 미설정 시 RTDB에 저장
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

    // Fallback: RTDB에 이미지 base64로 저장 (크기 제한 있음)
    return { url: null, publicId: null };
}

// Cloudinary 이미지 삭제
async function deleteImage(location) {
    if (!location || !location.image) return;
    try {
        if (cloudinaryConfigured && location.publicId) {
            await cloudinary.uploader.destroy(location.publicId);
        }
    } catch (error) {
        console.error('이미지 삭제 실패:', error);
    }
}

// ==================== 장소 데이터 관리 ====================

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

// 모든 장소 조회
app.get('/api/locations', async (req, res) => {
    try {
        const locationsRef = rtdb.ref('locations');
        const snapshot = await locationsRef.once('value');
        
        if (!snapshot.exists()) {
            // 기본 데이터 저장
            await locationsRef.set(defaultChuncheonLocations);
            return res.json(defaultChuncheonLocations);
        }
        
        const locations = snapshot.val();
        res.json(Array.isArray(locations) ? locations : Object.values(locations));
    } catch (error) {
        console.error('장소 조회 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

// 장소 추가
app.post('/api/locations', upload.single('image'), async (req, res) => {
    try {
        const { name, emoji, description } = req.body;
        const image = req.file;
        
        if (!name || !description) {
            return res.status(400).json({ error: '장소 이름과 설명은 필수입니다.' });
        }
        
        const locationsRef = rtdb.ref('locations');
        const snapshot = await locationsRef.once('value');
        let locations = snapshot.exists() ? (Array.isArray(snapshot.val()) ? snapshot.val() : Object.values(snapshot.val())) : [];
        
        // 중복 이름 확인
        if (locations.some(loc => loc.name === name)) {
            return res.status(400).json({ error: '이미 존재하는 장소 이름입니다.' });
        }
        
        // 이미지를 Cloudinary에 업로드
        const savedImage = await saveImage(image);
        
        const newId = Date.now().toString();
        const newLocation = {
            id: newId,
            name: name,
            emoji: emoji || '📍',
            description: description,
            image: savedImage.url,
            publicId: savedImage.publicId
        };
        
        locations.push(newLocation);
        await locationsRef.set(locations);
        
        res.json({ 
            success: true, 
            location: newLocation,
            message: '장소가 추가되었습니다.'
        });
    } catch (error) {
        console.error('장소 추가 오류:', error);
        res.status(500).json({ error: '장소 추가 중 오류가 발생했습니다.' });
    }
});

// 장소 삭제
app.delete('/api/locations/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const locationsRef = rtdb.ref('locations');
        const snapshot = await locationsRef.once('value');
        
        if (!snapshot.exists()) {
            return res.status(404).json({ error: '장소를 찾을 수 없습니다.' });
        }
        
        let locations = Array.isArray(snapshot.val()) ? snapshot.val() : Object.values(snapshot.val());
        const index = locations.findIndex(loc => loc.id === id);
        
        if (index === -1) {
            return res.status(404).json({ error: '장소를 찾을 수 없습니다.' });
        }
        
        const deleted = locations[index];
        
        // Cloudinary 이미지 삭제
        await deleteImage(deleted);
        
        locations.splice(index, 1);
        await locationsRef.set(locations);
        
        res.json({ 
            success: true, 
            location: deleted,
            message: '장소가 삭제되었습니다.'
        });
    } catch (error) {
        console.error('장소 삭제 오류:', error);
        res.status(500).json({ error: '장소 삭제 중 오류가 발생했습니다.' });
    }
});

// 장소 수정
app.put('/api/locations/:id', upload.single('image'), async (req, res) => {
    try {
        const id = req.params.id;
        const { name, emoji, description } = req.body;
        const image = req.file;
        
        const locationsRef = rtdb.ref('locations');
        const snapshot = await locationsRef.once('value');
        
        if (!snapshot.exists()) {
            return res.status(404).json({ error: '장소를 찾을 수 없습니다.' });
        }
        
        let locations = Array.isArray(snapshot.val()) ? snapshot.val() : Object.values(snapshot.val());
        const index = locations.findIndex(loc => loc.id === id);
        
        if (index === -1) {
            return res.status(404).json({ error: '장소를 찾을 수 없습니다.' });
        }
        
        if (name) locations[index].name = name;
        if (emoji) locations[index].emoji = emoji;
        if (description) locations[index].description = description;
        
        // 새 이미지가 업로드된 경우에만 교체
        if (image) {
            await deleteImage(locations[index]);
            const savedImage = await saveImage(image);
            locations[index].image = savedImage.url;
            locations[index].publicId = savedImage.publicId;
        }
        
        await locationsRef.set(locations);
        
        res.json({ 
            success: true, 
            location: locations[index],
            message: '장소가 수정되었습니다.'
        });
    } catch (error) {
        console.error('장소 수정 오류:', error);
        res.status(500).json({ error: '장소 수정 중 오류가 발생했습니다.' });
    }
});

// ==================== 방 관리 API ====================

// 모든 방 조회
app.get('/api/rooms', async (req, res) => {
    try {
        const gamesRef = rtdb.ref('games');
        const snapshot = await gamesRef.once('value');
        
        if (!snapshot.exists()) {
            return res.json([]);
        }
        
        const games = snapshot.val();
        const roomsList = Object.values(games).map(game => ({
            gameId: game.id,
            playerCount: game.players ? game.players.length : 0,
            status: game.status,
            hostId: game.hostId
        }));
        
        res.json(roomsList);
    } catch (error) {
        console.error('방 조회 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

// 방 삭제
app.delete('/api/rooms/:gameId', async (req, res) => {
    try {
        const gameId = req.params.gameId;
        const gameRef = rtdb.ref('games/' + gameId);
        const snapshot = await gameRef.once('value');
        
        if (!snapshot.exists()) {
            return res.status(404).json({ error: '방을 찾을 수 없습니다.' });
        }
        
        await gameRef.remove();
        
        res.json({ 
            success: true, 
            message: '방이 삭제되었습니다.' 
        });
    } catch (error) {
        console.error('방 삭제 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== Firebase Functions 내보내기 ====================
exports.api = functions.https.onRequest(app);