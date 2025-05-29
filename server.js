const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bodyParser = require('body-parser');
const CryptoJS = require('crypto-js');
const cors = require('cors');

const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'sennin-secret';

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static('public'));
app.use('/media', express.static(path.join(__dirname, 'media')));

// データ保存
const chatLogPath = './data/chatlog.json';
const bannedUsersPath = './data/banned.json';
const keywordsPath = './data/keywords.json';

let connectedUsers = {};
let maintenanceMode = false;

// ファイル保存設定
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'media/'),
  filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname),
});
const upload = multer({ storage });

// POST メディアアップロード
app.post('/upload', upload.single('file'), (req, res) => {
  res.json({ url: `/media/${req.file.filename}` });
});

// POST チャットログ取得
app.get('/admin/logs', (req, res) => {
  const password = req.query.password;
  if (password !== 'sennin21345528') return res.status(403).send('Forbidden');
  fs.readFile(chatLogPath, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Error');
    res.send(data);
  });
});

// POST メンテナンス切替
app.post('/admin/maintenance', (req, res) => {
  const { password, enable } = req.body;
  if (password !== 'sennin21345528') return res.status(403).send('Forbidden');
  maintenanceMode = enable;
  res.sendStatus(200);
});

// POST バンユーザー取得・解除
app.get('/admin/banned', (req, res) => {
  const password = req.query.password;
  if (password !== 'sennin21345528') return res.status(403).send('Forbidden');
  const banned = JSON.parse(fs.readFileSync(bannedUsersPath, 'utf8') || '[]');
  res.json(banned);
});

app.post('/admin/unban', (req, res) => {
  const { password, id } = req.body;
  if (password !== 'sennin21345528') return res.status(403).send('Forbidden');
  let banned = JSON.parse(fs.readFileSync(bannedUsersPath, 'utf8') || '[]');
  banned = banned.filter(user => user !== id);
  fs.writeFileSync(bannedUsersPath, JSON.stringify(banned));
  res.sendStatus(200);
});

io.on('connection', socket => {
  if (maintenanceMode) {
    socket.emit('maintenance');
    socket.disconnect();
    return;
  }

  const id = socket.id;
  const banned = JSON.parse(fs.readFileSync(bannedUsersPath, 'utf8') || '[]');
  if (banned.includes(id)) {
    socket.disconnect();
    return;
  }

  connectedUsers[id] = socket;

  const log = (message) => {
    const timestamp = new Date().toISOString();
    const entry = { timestamp, ...message };
    const logs = fs.existsSync(chatLogPath)
      ? JSON.parse(fs.readFileSync(chatLogPath, 'utf8'))
      : [];
    logs.push(entry);
    fs.writeFileSync(chatLogPath, JSON.stringify(logs, null, 2));
  };

  socket.on('join', (username) => {
    socket.username = username;
    log({ type: 'join', user: username });
    io.emit('system', `${username} が入室しました`);
  });

  socket.on('message', (data) => {
    const decrypted = CryptoJS.AES.decrypt(data.message, SECRET_KEY).toString(CryptoJS.enc.Utf8);
    log({ type: 'message', user: socket.username, message: decrypted });
    io.emit('message', { user: socket.username, message: data.message });
  });

  socket.on('media', (data) => {
    log({ type: 'media', user: socket.username, url: data.url });
    io.emit('media', { user: socket.username, url: data.url });
  });

  socket.on('ban', (targetId) => {
    const banned = JSON.parse(fs.readFileSync(bannedUsersPath, 'utf8') || '[]');
    if (!banned.includes(targetId)) {
      banned.push(targetId);
      fs.writeFileSync(bannedUsersPath, JSON.stringify(banned));
    }
    if (connectedUsers[targetId]) {
      connectedUsers[targetId].disconnect();
    }
  });

  socket.on('disconnect', () => {
    log({ type: 'leave', user: socket.username });
    io.emit('system', `${socket.username} が退室しました`);
    delete connectedUsers[id];
  });
});

http.listen(PORT, () => {
  console.log(`Sennin Chat Server running on port ${PORT}`);
});
