import json
from flask import Flask, request, jsonify, render_template
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
from pymongo import MongoClient
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationChain
from langchain_groq import ChatGroq
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
import jwt
from functools import wraps
from bson import ObjectId

load_dotenv()

# Initialize Flask app with SocketIO
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY")
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# MongoDB setup
mongo_uri = os.getenv("MONGO_URI")
mongo_client = MongoClient(mongo_uri)
db = mongo_client["test"]
chats_collection = db["chats"]

# JWT setup
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"

# Groq setup
groq_api_key = os.getenv("GROQ_API_KEY")
client = groq.Client(api_key=groq_api_key)

# Twilio setup
twilio_sid = os.getenv("TWILIO_SID")
twilio_token = os.getenv("TWILIO_TOKEN")
twilio_number = os.getenv("TWILIO_NUMBER")
user_phone_number = os.getenv("USER_PHONE_NUMBER")

twilio_client = TwilioClient(twilio_sid, twilio_token)

# Vector store setup
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
index = faiss.IndexFlatL2(384)
id_to_text = {}
next_id = 0

# User session memories
user_memories = {}

def get_user_memory(username):
    if username not in user_memories:
        # Initialize LangChain memory
        llm = ChatGroq(temperature=0, model_name="llama3-70b-8192", groq_api_key=groq_api_key)
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an AI Study Assistant. Help students with study schedules, reminders, and motivation. Keep responses concise and engaging."),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{input}")
        ])
        memory = ConversationBufferMemory(return_messages=True)
        user_memories[username] = ConversationChain(
            llm=llm,
            prompt=prompt,
            memory=memory
        )
    return user_memories[username]

# JWT authentication decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check for token in Authorization header
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1]
            
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            current_user = data['username']
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token is invalid!'}), 401
        except Exception as e:
            return jsonify({'message': str(e)}), 401
        
        return f(current_user, *args, **kwargs)
    return decorated


# Helper functions
def clean_response(text):
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'\*(.*?)\*', r'\1', text)
    return text.strip()

def start_timer(seconds, username):
    socketio.emit("start_timer", {"seconds": seconds, "username": username})
    threading.Timer(seconds, lambda: socketio.emit("timer_finished", {
        "message": "✅ Timer finished! Take a short break! ☕",
        "username": username
    })).start()

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

def detect_intent_llm(text):
    prompt = [
        {
            "role": "system",
            "content": (
                "You are an AI that extracts and classifies multiple intents from a user message.\n"
                "Supported intents: greeting, study_schedule, set_reminder, motivation, general_query.\n"
                "If the input contains multiple tasks, split them and label each with its intent.\n"
                "Reply in JSON format like:\n"
                "[{\"query\": \"message one\", \"intent\": \"greeting\"}, {\"query\": \"message two\", \"intent\": \"set_reminder\"}]"
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
    mime_type = image_file.mimetype  # usually "image/jpeg" or "image/png"

    # Encode image to base64
    base64_image = base64.b64encode(image_bytes).decode("utf-8")

    # Create image payload
    image_payload = {
        "type": "image_url",
        "image_url": {
            "url": f"data:{mime_type};base64,{base64_image}"
        }
    }

    # Default to describing image
    chat_prompt = query if query else "Describe this image in a very few lines.Dont provide extra context strictly follow this."

    # Send to llama-3.2-11b-vision-preview via Groq client
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

def save_chat_to_db(username, query, response, conversation_id=None):
    now = datetime.utcnow()
    
    if not conversation_id:
        # Create new conversation
        chat_data = {
            "username": username,
            "conversation_id": str(ObjectId()),  # New unique ID
            "title": query[:50] + ("..." if len(query) > 50 else ""),  # Auto-generated title
            "messages": [{
                "query": query,
                "response": response,
                "timestamp": now
            }],
            "created_at": now,
            "updated_at": now,
            "message_count": 1
        }
        result = chats_collection.insert_one(chat_data)
        return chat_data["conversation_id"]
    else:
        # Append to existing conversation
        chats_collection.update_one(
            {"conversation_id": conversation_id, "username": username},
            {
                "$push": {"messages": {
                    "query": query,
                    "response": response,
                    "timestamp": now
                }},
                "$set": {"updated_at": now},
                "$inc": {"message_count": 1}
            }
        )
        return conversation_id

def get_user_chats(username):
    """Get all conversations for a user, creates first conversation if none exists"""
    chats = list(chats_collection.find({"username": username}).sort("created_at", 1))
    
    # If no chats exist, create a welcome conversation
    if not chats:
        welcome_msg = "Welcome to Study Buddy! How can I help you today?"
        save_chat_to_db(username, "New user started", welcome_msg)
        chats = list(chats_collection.find({"username": username}).sort("created_at", 1))
    
    return chats

def generate_greeting_response(user_input):
    greet_prompt = [
        {"role": "system", "content": "You are a friendly and gamified AI Study Buddy. Your tone should be fun, engaging, and motivational. Provide minimal and engaging responses."},
        {"role": "user", "content": f"User Query: {user_input}"}
    ]
    response = client.chat.completions.create(model="llama3-70b-8192", messages=greet_prompt)
    return clean_response(response.choices[0].message.content)

def generate_llama_response_with_context(query, context):
    final_prompt = f"""You are a AI Study Buddy assistant. Use the following context to answer the question.

Context:
{context}

Question:
{query}
"""
    chat_completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",  # Or llama-3.3-70b-versatile
        messages=[
            {"role": "system", "content": "You are a knowledgeable assistant. Your job is to provide clear and accurate responses based strictly on the provided context.Dont provide information any other than the context strictly follow this rule "},
            {"role": "user", "content": final_prompt}
        ]
    )
    return chat_completion.choices[0].message.content.strip()

def retrieve_relevant_text(query, top_k=5):
    query_embedding = embedding_model.encode(query, normalize_embeddings=True).reshape(1, -1).astype("float32")
    distances, indices = index.search(query_embedding, top_k)
    retrieved = [id_to_text.get(i, "") for i in indices[0] if i >= 0]
    return "\n".join(retrieved) if retrieved else "No relevant context found."

# Routes
@app.route("/")
def home():
    return render_template("i.html")

@app.route("/api/chats", methods=["GET"])
@token_required
def get_chats(current_user):
    chats = get_user_chats(current_user)
    return jsonify([{
        "query": chat["query"],
        "response": chat["response"],
        "timestamp": chat["timestamp"].strftime("%Y-%m-%d %H:%M"),
        "id": str(chat["_id"])
    } for chat in chats])

@app.route("/api/chat", methods=["POST"])
@token_required
def chat(current_user):
    # Initialize variables
    transcribed = None
    file = request.files.get("file")
    conversation_id = request.form.get("conversation_id") if request.form else None
    query = request.form.get("query", "").strip() if request.form else None
    if not conversation_id:
        # Check if user has any existing conversations
        existing_conv = chats_collection.find_one({"username": current_user})
        if not existing_conv:
            # Create welcome conversation
            welcome_response = "Welcome to Study Buddy! I'm here to help with your studies. What would you like to work on today?"
            conversation_id = save_chat_to_db(current_user, "New session started", welcome_response)

    # Handle file uploads (images/documents)
    if file:
        if file.mimetype.startswith("image/"):
            try:
                response_text = handle_image_query(file, query)
                conversation_id = save_chat_to_db(
                    current_user, 
                    query or "Image uploaded", 
                    response_text, 
                    conversation_id
                )
                return jsonify({
                    "response": response_text,
                    "conversation_id": conversation_id
                })
            except Exception as e:
                print("Image handling error:", e)
                return jsonify({"response": "❌ Failed to process the image."}), 500

        elif any(file.filename.lower().endswith(ext) for ext in [".txt", ".pdf", ".docx"]):
            try:
                store_file_and_index(file)
                if query:
                    context = retrieve_relevant_text(query)
                    response_text = generate_llama_response_with_context(query, context)
                    conversation_id = save_chat_to_db(
                        current_user, 
                        query, 
                        response_text, 
                        conversation_id
                    )
                    return jsonify({
                        "response": response_text,
                        "conversation_id": conversation_id
                    })
                else:
                    return jsonify({
                        "response": "📁 File processed. Ask your question related to the content.",
                        "conversation_id": conversation_id
                    })
            except Exception as e:
                print("Document handling error:", e)
                return jsonify({"response": "❌ Failed to process the document."}), 500

    # Handle audio input
    if 'audio' in request.files:
        audio_file = request.files['audio']
        temp_path = "temp_audio.m4a"
        audio_file.save(temp_path)
        user_input = transcribe_audio_to_text(temp_path)
        transcribed = user_input
        os.remove(temp_path)
    else:
        data = request.get_json()
        user_input = data.get("query", "").strip() if data else ""
        transcribed = user_input
        conversation_id = data.get("conversation_id") if data else None

    if not user_input:
        return jsonify({
            "response": "I couldn't find relevant information. Can you rephrase?",
            "transcribed": transcribed,
            "conversation_id": conversation_id
        })

    # Process the user input
    sub_queries = detect_intent_llm(user_input)
    responses = []

    for item in sub_queries:
        query = item["query"]
        intent = item["intent"]

        if intent == "greeting":
            response = generate_greeting_response(query)
            responses.append(response)
            conversation_id = save_chat_to_db(
                current_user, 
                query, 
                response, 
                conversation_id
            )

        elif intent in ["study_schedule", "set_reminder"]:
            time_data = extract_time_llm(query)
            if time_data:
                scheduled_info = f"your scheduled session at {time_data['time']}"
                if time_data["type"] == "relative":
                    threading.Thread(
                        target=start_timer, 
                        args=(time_data["seconds"], current_user)
                    ).start()
                    response = f"✅ Timer started! Your study session is set for {time_data['seconds']} seconds. Time to focus! 📚"
                    responses.append(response)
                    conversation_id = save_chat_to_db(
                        current_user, 
                        query, 
                        response, 
                        conversation_id
                    )
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
                    response = f"⏰ Alarm set for {time_data['time']}. I'll call and message you when it's time! 📞"
                    responses.append(response)
                    conversation_id = save_chat_to_db(
                        current_user, 
                        query, 
                        response, 
                        conversation_id
                    )
            else:
                response = "⌛ I can set up your study session, but I need a valid time. When should we start? 🕒"
                responses.append(response)
                conversation_id = save_chat_to_db(
                    current_user, 
                    query, 
                    response, 
                    conversation_id
                )

        else:
            # Use LangChain for general queries with memory
            conversation = get_user_memory(current_user)
            response = conversation.predict(input=query)
            response = clean_response(response)
            responses.append(response)
            conversation_id = save_chat_to_db(
                current_user, 
                query, 
                response, 
                conversation_id
            )

    return jsonify({
        "response": "\n\n".join(responses),
        "transcribed": transcribed,
        "conversation_id": conversation_id
    })

@app.route("/api/conversations", methods=["GET"])
@token_required
def get_conversations(current_user):
    """Get list of all conversations for the user, creates first if new"""
    conversations = get_user_chats(current_user)
    
    return jsonify([{
        "id": conv["conversation_id"],
        "title": conv["title"],
        "last_updated": conv["updated_at"].strftime("%Y-%m-%d %H:%M"),
        "message_count": conv["message_count"]
    } for conv in conversations if "conversation_id" in conv])  # Ensure we only return proper conversations

@app.route("/api/conversation/<conversation_id>", methods=["GET"])
@token_required
def get_conversation(current_user, conversation_id):
    """Get all messages in a specific conversation"""
    conversation = chats_collection.find_one(
        {"conversation_id": conversation_id, "username": current_user},
        {"_id": 0, "messages": 1}
    )
    
    if not conversation:
        return jsonify({"error": "Conversation not found"}), 404
    
    return jsonify({
        "messages": [{
            "query": msg["query"],
            "response": msg["response"],
            "timestamp": msg["timestamp"].strftime("%Y-%m-%d %H:%M")
        } for msg in conversation["messages"]]
    })

@app.route("/api/conversation/<conversation_id>", methods=["DELETE"])
@token_required
def delete_conversation(current_user, conversation_id):
    """Delete entire conversation"""
    result = chats_collection.delete_one({
        "conversation_id": conversation_id,
        "username": current_user
    })
    
    if result.deleted_count == 1:
        return jsonify({"status": "success"})
    else:
        return jsonify({"error": "Conversation not found"}), 404

@app.route("/api/message/<conversation_id>", methods=["DELETE"])
@token_required
def delete_message(current_user, conversation_id):
    """Delete specific message from conversation"""
    timestamp = request.json.get("timestamp")  # Frontend sends the message timestamp
    
    if not timestamp:
        return jsonify({"error": "Timestamp required"}), 400
    
    try:
        target_time = datetime.strptime(timestamp, "%Y-%m-%d %H:%M")
    except ValueError:
        return jsonify({"error": "Invalid timestamp format"}), 400
    
    result = chats_collection.update_one(
        {"conversation_id": conversation_id, "username": current_user},
        {
            "$pull": {"messages": {"timestamp": target_time}},
            "$inc": {"message_count": -1},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    if result.modified_count == 1:
        return jsonify({"status": "success"})
    else:
        return jsonify({"error": "Message not found"}), 404

@app.route("/api/chat/<chat_id>", methods=["GET"])
@token_required
def get_single_chat(current_user, chat_id):
    chat = chats_collection.find_one({"_id": chat_id, "username": current_user})
    if not chat:
        return jsonify({"error": "Chat not found"}), 404
    return jsonify({
        "query": chat["query"],
        "response": chat["response"],
        "timestamp": chat["timestamp"].strftime("%Y-%m-%d %H:%M")
    })

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=8000, debug=True)