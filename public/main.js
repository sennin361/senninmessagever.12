const socket = io();
const chatArea = document.getElementById("chat-area");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const fileInput = document.getElementById("file-input");
const leaveBtn = document.getElementById("leave-btn");

function appendMessage(message, type = "other") {
  const div = document.createElement("div");
  div.classList.add("chat-bubble", type);
  if (message.type === "text") {
    div.textContent = message.content;
  } else if (message.type === "image") {
    const img = document.createElement("img");
    img.src = message.content;
    img.style.maxWidth = "100%";
    div.appendChild(img);
  } else if (message.type === "video") {
    const video = document.createElement("video");
    video.src = message.content;
    video.controls = true;
    video.style.maxWidth = "100%";
    div.appendChild(video);
  }
  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;
}

// 初回読み込み時に履歴を表示
socket.on("chat history", (messages) => {
  messages.forEach((msg) => appendMessage(msg, msg.sender === socket.id ? "me" : "other"));
});

// 新規メッセージ受信時
socket.on("chat message", (msg) => {
  appendMessage(msg, msg.sender === socket.id ? "me" : "other");
});

// 送信イベント
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const content = chatInput.value.trim();
  if (content) {
    const msg = { type: "text", content, sender: socket.id };
    socket.emit("chat message", msg);
    chatInput.value = "";
  }
});

// 画像・動画送信イベント
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) return;
    const msg = {
      type: isImage ? "image" : "video",
      content: reader.result,
      sender: socket.id,
    };
    socket.emit("chat message", msg);
  };
  reader.readAsDataURL(file);
});

// 退室ボタン
leaveBtn.addEventListener("click", () => {
  const confirmed = confirm("チャットを終了しますか？");
  if (confirmed) {
    socket.disconnect();
    location.reload();
  }
});
