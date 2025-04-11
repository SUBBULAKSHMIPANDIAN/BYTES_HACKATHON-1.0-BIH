const socket = io.connect("http://localhost:8000");
let timerInterval = null;
let timeLeft = 0;
let timerActive = false;

const timerDisplay = document.getElementById("timer");
const alarmSound = document.getElementById("alarm-sound");
const alertOverlay = document.getElementById("alert-overlay");

function handleKeyPress(event) {
    if (event.key === "Enter") sendMessage();
}

function sendMessage() {
    const userInputElem = document.getElementById("user-input");
    const userInput = userInputElem.value;
    const trimmedInput = userInput.trim();

    // 🟡 Maintain your existing logic for plain text input
    if (!trimmedInput && !selectedFile) return;

    if (trimmedInput) {
        appendMessage(trimmedInput, "user");
        userInputElem.value = "";
    }

    // 🔁 If there's a file selected, send as FormData
    if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        if (trimmedInput) formData.append("query", trimmedInput);

        const isImage = selectedFile.type.startsWith("image/");
        appendMessage(isImage ? "🧠 Processing your image..." : "🧠 Processing your file...", "bot");

        fetch("/chat", {
            method: "POST",
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            const messages = document.querySelectorAll(".message.bot");
            const lastBotMessage = messages[messages.length - 1];
            if (lastBotMessage && lastBotMessage.innerText.includes("Processing")) {
                lastBotMessage.remove();
            }

            if (data.transcribed) appendMessage(data.transcribed, "user");
            appendMessage(data.response || "🤖 No response.", "bot");
        })
        .catch(err => {
            console.error("File upload error:", err);
            appendMessage("❌ Error processing your file.", "bot");
        });

        selectedFile = null; // Reset after sending
    } else {
        // 🔁 If only text, follow your original fetch
        fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: trimmedInput })
        })
        .then(response => response.json())
        .then(data => appendMessage(data.response, "bot"))
        .catch(err => {
            console.error("Text send error:", err);
            appendMessage("❌ Error processing your message.", "bot");
        });
    }
}

function appendMessage(text, sender) {
            const chatContainer = document.getElementById("chat-container");
            const messageDiv = document.createElement("div");
            messageDiv.className = `message ${sender}`;
            messageDiv.innerText = text;
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
}

socket.on("start_timer", function(data) {
    timeLeft = data.seconds;
    if (!timerActive) {
        startTimer();
    }
});

function startTimer() {
    clearInterval(timerInterval);
    timerActive = true;
    updateTimerDisplay(timeLeft);
    timerDisplay.classList.add("active");

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay(timeLeft);

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timerActive = false;
            timeLeft = 0;
            updateTimerDisplay(0);
            showAlert();
        }
    }, 1000);
}

function cancelTimer() {
    clearInterval(timerInterval);
    timerActive = false;
    timeLeft = 0;
    updateTimerDisplay(0);
    timerDisplay.classList.remove("active");
    appendMessage("⏹️ Timer cancelled.", "bot");
    dismissAlert();
}

function addTime(secondsToAdd) {
    if (!timerActive || timeLeft <= 0) return;
    timeLeft += secondsToAdd;
    appendMessage(`⏱️ Added ${secondsToAdd / 60} min to the timer.`, "bot");
    updateTimerDisplay(timeLeft);
}

function dismissAlert() {
    alertOverlay.classList.remove("active");
    alarmSound.pause();
    alarmSound.currentTime = 0;
}

function updateTimerDisplay(seconds) {
    const timerDisplay = document.getElementById("timer");
    timerDisplay.innerText = `⏳ Timer: ${seconds > 0 ? seconds + "s remaining" : "Finished!"}`;
}

function showAlert() {
    alertOverlay.classList.add("active");
    // Play alarm sound
    try {
        alarmSound.play().catch(error => {
            console.log("Audio playback failed:", error);
            // Add event listener for user interaction to enable audio on mobile
            document.addEventListener('click', function enableAudio() {
                alarmSound.play().catch(e => console.log("Still cannot play audio:", e));
                document.removeEventListener('click', enableAudio);
            }, { once: true });
        });
    } catch (error) {
        console.log("Audio playback error:", error);
    }
}


        

        





// File attachment functionality
function triggerFileInput() {
    document.getElementById('file-input').click();
}

let selectedFile = null; // Global to store file

function handleFileSelection(input) {
    if (input.files && input.files[0]) {
        selectedFile = input.files[0];
        const fileName = selectedFile.name;
        const fileType = selectedFile.type;
        const isImage = fileType.startsWith("image/");
        const isDocument = fileType === "application/pdf" ||
                           fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                           fileType === "text/plain";

        appendMessage(`📎 File attached: ${fileName}`, "user");

        if (isImage) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const img = document.createElement("img");
                img.src = e.target.result;
                img.style.maxWidth = "200px";
                img.style.borderRadius = "8px";
                img.style.marginTop = "5px";
                const chatContainer = document.getElementById("chat-container");
                const wrapper = document.createElement("div");
                wrapper.className = "message user";
                wrapper.appendChild(img);
                chatContainer.appendChild(wrapper);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            };
            reader.readAsDataURL(selectedFile);
        } else if (isDocument) {
            const icon = document.createElement("div");
            icon.innerHTML = `📄 <strong>${fileName}</strong>`;
            icon.style.marginTop = "5px";
            icon.style.padding = "10px";
            icon.style.border = "1px solid #ccc";
            icon.style.borderRadius = "6px";
            icon.style.backgroundColor = "#f9f9f9";
            icon.style.display = "inline-block";

            const chatContainer = document.getElementById("chat-container");
            const wrapper = document.createElement("div");
            wrapper.className = "message user";
            wrapper.appendChild(icon);
            chatContainer.appendChild(wrapper);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        input.value = "";
    }
}






// Audio recording functionality
let isRecording = false;
let mediaRecorder;
let audioChunks = [];

function toggleAudioRecording() {
    const audioBtn = document.getElementById('audio-btn');
    
    if (!isRecording) {
        // Start recording
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                isRecording = true;
                audioBtn.classList.add('recording');
                audioBtn.innerHTML = '<i class="fas fa-stop"></i>';
                
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];
                
                mediaRecorder.ondataavailable = (event) => {
                    audioChunks.push(event.data);
                };
                
                mediaRecorder.onstop = () => {
                    const mimeType = mediaRecorder.mimeType || 'audio/webm';
                    const audioBlob = new Blob(audioChunks, { type: mimeType });
                
                    
                    appendMessage("🧠 Processing your voice message...", "bot");
                
                    const formData = new FormData();
                    formData.append("audio", audioBlob, "voice-input.m4a");
                
                    fetch("/chat", {
                        method: "POST",
                        body: formData
                    })
                    .then(res => res.json())
                    .then(data => {
                        // Remove "processing..." message
                        const messages = document.querySelectorAll(".message.bot");
                        const lastBotMessage = messages[messages.length - 1];
                        if (lastBotMessage && lastBotMessage.innerText === "🧠 Processing your voice message...") {
                            lastBotMessage.remove();
                        }
                    
                        // 🗣️ Show what user said (transcribed)
                        appendMessage(data.transcribed || "🎤 (Could not understand audio)", "user");
                    
                        // 🤖 Show bot response
                        appendMessage(data.response, "bot");
                    })
                    
                    .catch(err => {
                        console.error("Error processing voice message:", err);
                        appendMessage("❌ Error processing your voice message. Try again.", "bot");
                    });
                };
                
                
                mediaRecorder.start();
            })
            .catch(error => {
                console.error("Error accessing microphone:", error);
                appendMessage("Could not access microphone. Please check permissions.", "bot");
            });
    } else {
        // Stop recording
        isRecording = false;
        audioBtn.classList.remove('recording');
        audioBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
    }
}

        
// Enable audio for iOS devices (requires user interaction)
document.addEventListener('touchstart', function() {
            const silentAudio = document.createElement('audio');
            silentAudio.setAttribute('src', 'data:audio/mp3;base64,//MkxAAHiAICWABElBeKPL/RANb2w+yiT1g/gTok//lP/W/l3h8QO/OCdCqCW2Cw//MkxAQHkAIWUAhEmAQXWUOFW2dxPu//9mr60ElY5sseQ+xxesmHKtZr7bsqqX2L//MkxAgFwAYiQAhEAC2hq22d3///9FTV6tA36JdgBJoOGgc+7qvqej5Zu7/7uI9l//MkxBQHAAYi8AhEAO193vt9KGOq+6qcT7hhfN5FTInmwk8RkqKImTM55pRQHQSq//MkxBsGkgoIAABHhTACIJLf99nVI///yuW1uBqWfEu7CgNPWGpUadBmZ////4sL//MkxCMHMAH9iABEmAsKioqKigsLCwtVTEFNRTMuOTkuNVVVVVVVVVVVVVVVVVVV//MkxCkECAUYCAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV');
            silentAudio.volume = 0;
            document.body.appendChild(silentAudio);
            silentAudio.play().then(() => {
                silentAudio.remove();
            }).catch(e => {
                console.log("iOS audio initialization failed:", e);
            });
        }, { once: true });
        
        // Handle page visibility changes
        document.addEventListener("visibilitychange", function() {
            if (document.hidden && alarmSound.played) {
                alarmSound.pause();
            } else if (!document.hidden && alertOverlay.classList.contains("active")) {
                alarmSound.play().catch(e => console.log("Cannot resume audio:", e));
            }
});



