import json
from flask import Flask, request, jsonify, render_template, session
from flask_cors import CORS
from flask_socketio import SocketIO
import groq
import re
import threading
from datetime import datetime, timedelta
import os
from twilio.rest import Client as TwilioClient
from dotenv import load_dotenv
import base64
from PyPDF2 import PdfReader
import docx
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.messages import HumanMessage, AIMessage

load_dotenv()

# Initialize Flask app with SocketIO
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "default-secret-key")  # Required for session
CORS(app, 
     resources={
         r"/api/*": {
             "origins": ["http://localhost:3000"],
             "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
             "allow_headers": ["Content-Type", "Authorization"],
             "supports_credentials": True
         }
     })

@app.before_request
def handle_options():
    if request.method == "OPTIONS":
        response = jsonify({"message": "CORS preflight"})
        response.headers.add("Access-Control-Allow-Origin", "http://localhost:3000")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
        response.headers.add("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS")
        response.headers.add("Access-Control-Allow-Credentials", "true")
        return response
socketio = SocketIO(app, cors_allowed_origins="*")

groq_api_key = os.getenv("GROQ_API_KEY")
client = groq.Client(api_key=groq_api_key) 

embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

# Global index and mapping
index = faiss.IndexFlatL2(384)  # For all-MiniLM-L6-v2
id_to_text = {}
next_id = 0 

# Session storage for conversation histories
session_histories = {}

def get_session_history(session_id: str) -> ChatMessageHistory:
    if session_id not in session_histories:
        session_histories[session_id] = ChatMessageHistory()
    return session_histories[session_id]

def detect_intent_llm(text):
    prompt = [
        {
            "role": "system",
            "content": (
                "You are an Excellent AI that extracts and classifies multiple intents from a user message.\n"
                "Your task is to identify the intent of each sub-query in the message.\n"
                "Classify the intents into the following categories:\n"
                "Supported intents: greeting, study_schedule, set_reminder, motivation, general_query.\n"
                "If the input contains multiple tasks, split them and label each with its intent.\n"
                "Reply in JSON format like:\n"
                "[{\"query\": \"message one\", \"intent\": \"greeting\"}, {\"query\": \"message two\", \"intent\": \"set_reminder\"}]"
                "you are an mathematical chatbot so if the query is about maths then classify it as general_query.\n"
                "If no intent is found, return [{\"query\": \"message\", \"intent\": \"general_query\"}].\n\n"
            )
        },
        {
            "role": "user",
            "content": f"User message: {text}"
        }
    ]

    response = client.chat.completions.create(
        model="llama3-70b-8192",
        messages=prompt
    )

    try:
        result = json.loads(response.choices[0].message.content)
        # Ensure proper formatting
        valid_intents = ["greeting", "study_schedule", "set_reminder", "motivation", "general_query"]
        return [item for item in result if item["intent"] in valid_intents]
    except Exception as e:
        print("Intent parsing error:", e)
        return [{"query": text, "intent": "general_query"}]

def extract_time_llm(text):
    prompt = [
        {
            "role": "system",
            "content": (
                "You are an intelligent assistant that extracts time from user queries for study sessions or alarms.\n"
                "Understand if the user wants to:\n"
                "- Start a timer for a short duration (like 'in 1 hour', 'after 30 minutes') → this is 'relative'\n"
                "- Schedule a specific time (like 'set alarm at 6 AM', 'wake me up at 2 PM') → this is 'absolute'\n\n"
                "Return a JSON object with these keys:\n"
                "- 'type': 'relative' or 'absolute'\n"
                "- 'time': Time in 12-hour format (e.g., '06:00 AM')\n"
                "- 'seconds': Number of seconds from now (only for 'relative')\n\n"
                "If no time is found, return null."
            )
        },
        {"role": "user", "content": f"Query: {text}"}
    ]

    response = client.chat.completions.create(
        model="llama3-70b-8192",
        messages=prompt
    )

    try:
        return json.loads(response.choices[0].message.content.strip())
    except Exception as e:
        print("LLM Time Parse Error:", e)
        return None

# --- Twilio Setup ---
twilio_sid = os.getenv("TWILIO_SID")
twilio_token = os.getenv("TWILIO_TOKEN")
twilio_number = os.getenv("TWILIO_NUMBER")
user_phone_number = os.getenv("USER_PHONE_NUMBER")

twilio_client = TwilioClient(twilio_sid, twilio_token)

def send_sms(message):
    twilio_client.messages.create(
        body=message,
        from_=twilio_number,
        to=user_phone_number
    )

def make_call(message):
    twiml = f'<Response><Say>{message}</Say></Response>'
    call = twilio_client.calls.create(
        twiml=twiml,
        to=user_phone_number,
        from_=twilio_number
    )

def clean_response(text):
    # Remove asterisk-based markdown (e.g., *text*, **text**)
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'\*(.*?)\*', r'\1', text)
    return text.strip()

def start_timer(seconds):
    socketio.emit("start_timer", {"seconds": seconds})  # Send initial time
    threading.Timer(seconds, lambda: socketio.emit("timer_finished", {"message": "✅ Timer finished! Take a short break! ☕"})).start()

def generate_response_with_history(query, session_id):
    # Get the conversation history
    history = get_session_history(session_id)
    
    # Prepare the messages for the LLM
    messages = [
        {"role": "system", "content": "You are an Mathematical AI Study Assistant. Provide accurate mathematical solutions. Help with study schedules, reminders, and motivation. Keep responses concise and easy to understand."}
    ]
    
    # Add the last 5 messages from history (adjust as needed)
    for msg in history.messages[-10:]:  # Keep last 10 messages for context
        if isinstance(msg, HumanMessage):
            messages.append({"role": "user", "content": msg.content})
        elif isinstance(msg, AIMessage):
            messages.append({"role": "assistant", "content": msg.content})
    
    # Add the current query
    messages.append({"role": "user", "content": query})
    
    # Generate response
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile", 
        messages=messages
    )
    
    raw_response = response.choices[0].message.content
    clean_response_text = clean_response(raw_response)
    
    # Update history
    history.add_user_message(query)
    history.add_ai_message(clean_response_text)
    
    return clean_response_text

def generate_greeting_response(user_input, session_id):
    history = get_session_history(session_id)
    
    messages = [
        {"role": "system", "content": "You are a friendly Mathematical AI Study Buddy. Your tone should be fun, engaging, and motivational. Keep responses short."}
    ]
    
    for msg in history.messages[-5:]:
        if isinstance(msg, HumanMessage):
            messages.append({"role": "user", "content": msg.content})
        elif isinstance(msg, AIMessage):
            messages.append({"role": "assistant", "content": msg.content})
    
    messages.append({"role": "user", "content": user_input})
    
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages
    )
    
    raw_response = response.choices[0].message.content
    clean_response_text = clean_response(raw_response)
    
    history.add_user_message(user_input)
    history.add_ai_message(clean_response_text)
    
    return clean_response_text

def transcribe_audio_to_text(audio_path):
    with open(audio_path, "rb") as file:
        transcription = client.audio.transcriptions.create(
            file=(audio_path, file.read()),
            model="whisper-large-v3-turbo",
            response_format="verbose_json",
            language="en"
        )
    return transcription.text

def handle_image_query(image_file, query=None):
    image_bytes = image_file.read()
    mime_type = image_file.mimetype

    base64_image = base64.b64encode(image_bytes).decode("utf-8")
    image_payload = {
        "type": "image_url",
        "image_url": {
            "url": f"data:{mime_type};base64,{base64_image}"
        }
    }

    chat_prompt = query if query else "Describe this image in a very few lines.Dont provide extra context strictly follow this."

    response = client.chat.completions.create(
        model="llama-3.2-11b-vision-preview",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": chat_prompt},
                    image_payload
                ]
            }
        ]
    )
    return response.choices[0].message.content

def is_image(file):
    return file.mimetype.startswith('image/')

def extract_text(file):
    ext = file.filename.lower()
    if ext.endswith(".pdf"):
        reader = PdfReader(file)
        return "\n".join(page.extract_text() for page in reader.pages if page.extract_text())
    elif ext.endswith(".docx"):
        doc = docx.Document(file)
        return "\n".join([para.text for para in doc.paragraphs])
    elif ext.endswith(".txt"):
        return file.read().decode("utf-8")
    else:
        raise ValueError("Unsupported file type")
    
def store_file_and_index(file):
    global next_id
    text = extract_text(file)
    chunks = [text[i:i+500] for i in range(0, len(text), 500)]

    for chunk in chunks:
        embedding = embedding_model.encode(chunk, normalize_embeddings=True).astype("float32")
        index.add(np.array([embedding]))
        id_to_text[next_id] = chunk
        next_id += 1

def generate_llama_response_with_context(query, context, session_id):
    history = get_session_history(session_id)
    
    final_prompt = f"""You are a Excellent mathematical Study Buddy assistant. Use the following context to answer the question.solve the mathematical equation with highest accuracy in the most easiest way and make it easy to understand for the students.

Context:
{context}

Question:
{query}
"""
    messages = [
        {"role": "system", "content": "You are a knowledgeable Maths assistant. Provide clear and accurate responses based strictly on the provided context."}
    ]
    
    for msg in history.messages[-5:]:
        if isinstance(msg, HumanMessage):
            messages.append({"role": "user", "content": msg.content})
        elif isinstance(msg, AIMessage):
            messages.append({"role": "assistant", "content": msg.content})
    
    messages.append({"role": "user", "content": final_prompt})
    
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages
    )
    
    raw_response = response.choices[0].message.content.strip()
    
    history.add_user_message(query)
    history.add_ai_message(raw_response)
    
    return raw_response

def retrieve_relevant_text(query, top_k=5):
    query_embedding = embedding_model.encode(query, normalize_embeddings=True).reshape(1, -1).astype("float32")
    distances, indices = index.search(query_embedding, top_k)
    retrieved = [id_to_text.get(i, "") for i in indices[0] if i >= 0]
    return "\n".join(retrieved) if retrieved else "No relevant context found."

@app.route("/chat", methods=['POST', 'OPTIONS'])
def chat():
    if request.method == 'OPTIONS':
        # Preflight request
        return jsonify({'message': 'CORS preflight'}), 200
    # Generate or retrieve session ID
    session_id = request.cookies.get('session_id') or str(hash(request.remote_addr))
    
    transcribed = None
    file = request.files.get("file")
    query = request.form.get("query", "").strip() if request.form else None

    # Handle file uploads first (image or document)
    if file:
        if file.mimetype.startswith("image/"):
            try:
                response_text = handle_image_query(file, query)
                return jsonify({"response": response_text})
            except Exception as e:
                print("Image handling error:", e)
                return jsonify({"response": "❌ Failed to process the image."}), 500

        elif any(file.filename.lower().endswith(ext) for ext in [".txt", ".pdf", ".docx"]):
            try:
                store_file_and_index(file)
                if query:
                    context = retrieve_relevant_text(query)
                    response_text = generate_llama_response_with_context(query, context, session_id)
                    return jsonify({"response": response_text})
                else:
                    return jsonify({"response": "📁 File processed. Ask your question related to the content."})
            except Exception as e:
                print("Document handling error:", e)
                return jsonify({"response": "❌ Failed to process the document."}), 500
        else:
            return jsonify({"response": "❌ Unsupported file type."}), 415

    # Handle audio files
    if 'audio' in request.files:
        audio_file = request.files['audio']
        temp_path = "temp_audio.m4a"
        audio_file.save(temp_path)
        user_input = transcribe_audio_to_text(temp_path)
        transcribed = user_input
        os.remove(temp_path)
    else:
        # Handle regular text input
        data = request.get_json()
        user_input = data.get("query", "").strip() if data else ""
        transcribed = user_input

    if not user_input:
        return jsonify({
            "response": "I couldn't find relevant information. Can you rephrase?",
            "transcribed": transcribed
        })

    # Intent Detection and Execution
    sub_queries = detect_intent_llm(user_input)
    print("Detected sub-queries:", sub_queries)

    responses = []

    for item in sub_queries:
        query = item["query"]
        intent = item["intent"]
        print(f"Processing intent '{intent}' for query: {query}")

        if intent == "greeting":
            responses.append(generate_greeting_response(query, session_id))

        elif intent in ["study_schedule", "set_reminder"]:
            time_data = extract_time_llm(query)
            print("Time LLM Output:", time_data)

            if time_data:
                scheduled_info = f"your scheduled session at {time_data['time']}"

                if time_data["type"] == "relative":
                    threading.Thread(target=start_timer, args=(time_data["seconds"],)).start()
                    responses.append(f"✅ Timer started! Your study session is set for {time_data['seconds']} seconds. Time to focus! 📚")

                elif time_data["type"] == "absolute":
                    def alarm_trigger():
                        send_sms(f"Hi! 📅 It's time for {scheduled_info}. Stay sharp! 💪")
                        make_call(f"This is your study assistant calling. It's time for {scheduled_info}. Let's get started!")

                    now = datetime.now()
                    target_time = datetime.strptime(time_data["time"], "%I:%M %p")
                    target_time = target_time.replace(year=now.year, month=now.month, day=now.day)

                    if target_time < now:
                        target_time += timedelta(days=1)

                    delay_seconds = (target_time - now).total_seconds()
                    threading.Timer(delay_seconds, alarm_trigger).start()

                    responses.append(f"⏰ Alarm set for {time_data['time']}. I'll call and message you when it's time! 📞")
            else:
                responses.append("⌛ I can set up your study session, but I need a valid time. When should we start? 🕒")

        elif intent == "motivation":
            responses.append(generate_response_with_history(query, session_id))

        else:  # general_query or fallback
            responses.append(generate_response_with_history(query, session_id))

    return jsonify({
        "response": "\n\n".join(responses),
        "transcribed": transcribed
    })

@app.route("/")
def home():
    return render_template("index.html")

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=8000, debug=True)