import json
from flask import Flask, request, jsonify, render_template, session
from flask_cors import CORS, cross_origin
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
import cv2
import numpy as np
load_dotenv()

from pymongo import MongoClient 
from bson.objectid import ObjectId

# MongoDB Setup
mongo_uri = os.getenv("MONGO_URI")
mongo_client = MongoClient(mongo_uri)
db = mongo_client["test"]

users_collection = db["users"]
education_collection = db["educations"]


db = mongo_client["ocr_math_solver"]
collection = db["math_solutions"]

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
                "You are an Excellent AI that classifies user messages for a math study assistant.\n"
                "Carefully determine the intent of the message from these categories:\n"
                "\n1. greeting - Simple greetings like 'hello', 'hi'\n"
                "2. study_schedule - Requests to set up study times ('study at 3pm', 'set timer for 30 mins')\n"
                "3. set_reminder - Requests for future notifications ('remind me tomorrow', 'alert me in 1 hour')\n"
                "4. motivation - Requests for encouragement or study motivation\n"
                "5. general_query - All math-related questions and requests for concepts/explanations\n"
                "\nSPECIAL RULES:\n"
                "- Any request for math concepts, explanations, or problems should be 'general_query'\n"
                "- Requests like 'easy concepts for my level' are ALWAYS 'general_query'\n"
                "- Only classify as study_schedule if there's a clear time/duration mentioned\n"
                "\nReturn JSON format: [{\"query\": \"message\", \"intent\": \"type\"}]\n"
                "Example: [{\"query\": \"easy concepts for my level\", \"intent\": \"general_query\"}]"
            )
        },
        {
            "role": "user",
            "content": f"Classify this message: {text}"
        }
    ]

    response = client.chat.completions.create(
        model="llama3-70b-8192",
        response_format={"type": "json_object"},
        messages=prompt
    )

    try:
        result = json.loads(response.choices[0].message.content)
        # Handle both direct array response and object-with-array responses
        if isinstance(result, dict) and "intents" in result:
            items = result["intents"]
        else:
            items = result if isinstance(result, list) else [result]
            
        valid_intents = ["greeting", "study_schedule", "set_reminder", "motivation", "general_query"]
        return [item for item in items if item.get("intent") in valid_intents]
    except Exception as e:
        print(f"Intent parsing error for '{text}':", e)
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

def generate_response_with_history(query, session_id, username):
    # Get the conversation history
    history = get_session_history(session_id)
    
    
    # Get user's education details using the passed username
    # Update the education query to be case-insensitive
    user_education = education_collection.find_one({
        "username": {"$regex": f"^{username}$", "$options": "i"}})
    
    # Prepare education context for prompt
    education_context = ""
    if user_education:
        education_context = f"""
        User's Education Profile:
        - Level: {user_education.get('educationLevel', 'Not specified')}
        - Class/Year: {user_education.get('classOrYear', 'Not specified')}
        - Institution: {user_education.get('institution', 'Not specified')}
        - Course: {user_education.get('course', 'Not specified')}
        - Semester: {user_education.get('semester', 'Not specified')}
        """
        print(f"Found education details: {education_context}")  # Debug print
    else:
        education_context = "User's education details are not available."
        print(f"No education details found for username: {username}") 
    # Prepare the messages for the LLM with education context
    messages = [
        {
            "role": "system", 
            "content": f"""You are an Mathematical AI Study Assistant specialized in providing solutions tailored to the user's education level. 
            {education_context}
            
            Guidelines:
            1. For maths problems from education levels 1-5 (primary school), provide simple, step-by-step solutions with basic explanations.
            2. For higher education (UG/PG), provide more detailed mathematical solutions with appropriate technical terms.
            3. For vocational courses, focus on practical applications of mathematical concepts.
            4. Always verify your calculations for absolute accuracy.
            5. If the query isn't mathematical, politely guide them to mathematical topics or suggest consulting other resources.
            6. For engineering students, emphasize problem-solving approaches and real-world applications.
            
            Current User Profile:
            - Level: {user_education.get('educationLevel', 'Not specified') if user_education else 'Not specified'}
            - Course: {user_education.get('course', 'Not specified') if user_education else 'Not specified'}
            
            Provide accurate mathematical solutions tailored to these specifications."""
        }
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
    
    # Get username from localStorage (passed via template)
    username = request.args.get('username') or 'default'
    
    # Get user's education details from MongoDB
    user_education = education_collection.find_one({"username": username})
    
    # Prepare education context for prompt
    education_context = ""
    if user_education:
        education_context = f"""
        User's Education Profile:
        - Level: {user_education.get('educationLevel', 'Not specified')}
        - Class/Year: {user_education.get('classOrYear', 'Not specified')}
        - Course: {user_education.get('course', 'Not specified')}
        """
    
    final_prompt = f"""You are an Excellent mathematical Study Buddy assistant. Use the following context to answer the question. 
    {education_context}
    
    Solve the mathematical equation with highest accuracy in the most appropriate way for the user's education level.
    Make it easy to understand for the student's level.
    
    Context:
    {context}

    Question:
    {query}
    """
    
    messages = [
        {
            "role": "system", 
            "content": f"""You are a knowledgeable Maths assistant. Provide clear and accurate responses based strictly on the provided context.
            {education_context}
            
            Tailor your response to:
            - Education Level: {user_education.get('educationLevel', 'Not specified') if user_education else 'Not specified'}
            - Course: {user_education.get('course', 'Not specified') if user_education else 'Not specified'}
            """
        }
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
    try:
        # Get username from either JSON or form data
        if request.content_type == 'application/json':
            data = request.get_json()
            
            username = data.get('username', 'default').strip()
        else:
            username = request.form.get('username', 'default').strip()
        
        print(f"Received username: {username}")  # Debug print
        
        if not username or username == 'default':
            return jsonify({"error": "Username is required"}), 400
            
        # Rest of your chat endpoint logic...
        
    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        return jsonify({"error": "Internal server error"}), 500
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
            responses.append(generate_response_with_history(query, session_id,username))

        else:  # general_query or fallback
            responses.append(generate_response_with_history(query, session_id,username))

    return jsonify({
        "response": "\n\n".join(responses),
        "transcribed": transcribed
    })


def process_image(image_data):
    """Convert base64 image data to a numpy array."""
    try:
        image_data = image_data.split(",")[1]
        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Failed to decode image")
        return image
    except Exception as e:
        print(f"Error processing image: {e}")
        return None

def extract_text_from_image(image):
    """Analyze and solve math problem from image using Groq API."""
    try:
        _, buffer = cv2.imencode(".jpg", image)
        base64_image = base64.b64encode(buffer).decode("utf-8")

        completion = client.chat.completions.create(
            model="llama-3.2-11b-vision-preview",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "You are a helpful and accurate math tutor. "
                                "Analyze the following image and solve the math problem it contains. "
                                "Explain your steps clearly and concisely before giving the final answer. "
                                "provide the answer in simple and easy steps.make the response to be short and consice"
                                "provide an engaging response so that the steps for can be understand easily."
                                "If the image does NOT contain a math problem, respond exactly with: 'I am a math solver.in a polite manner'"
                            )
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            temperature=0.3,
            max_tokens=1000,
            top_p=1,
            stream=False,
        )

        result = completion.choices[0].message.content.strip()
        return result
    except Exception as e:
        print(f"Error extracting/solving math problem: {e}")
        return None
    

@app.route("/extract-text", methods=["POST"])
@cross_origin(origin='http://localhost:3000')
def extract_text():
    """Handle image data, return extracted text, and store in MongoDB."""
    try:
        data = request.get_json()
        if not data or "image" not in data:
            return jsonify({"error": "No image data provided"}), 400

        image = process_image(data["image"])
        if image is None:
            return jsonify({"error": "Invalid image data"}), 400

        text = extract_text_from_image(image)
        if text:
            if text.lower().strip() == "i am a math solver.":
                result_text = "This image doesn't contain a math problem. I am a math solver."
            else:
                result_text = text

            # Store in MongoDB
            collection.insert_one({
                "image_data": data["image"],
                "result_text": result_text,
                "timestamp": datetime.utcnow()
            })

            return jsonify({"text": result_text})
        else:
            return jsonify({"error": "No response from the model"}), 500
    except Exception as e:
        print(f"Server error: {e}")
        return jsonify({"error": "Failed to process image"}), 500

@app.route("/get-solutions", methods=["GET"])
@cross_origin(origin='http://localhost:3000')
def get_solutions():
    """Fetch all stored math solutions from MongoDB."""
    try:
        solutions = collection.find().sort("timestamp", -1)  # Sort by timestamp, newest first
        solutions_list = [
            {
                "image_data": sol["image_data"],
                "result_text": sol["result_text"],
                "timestamp": sol["timestamp"].isoformat()
            }
            for sol in solutions
        ]
        return jsonify({"solutions": solutions_list})
    except Exception as e:
        print(f"Error fetching solutions: {e}")
        return jsonify({"error": "Failed to fetch solutions"}), 500

@app.route("/")
def home():
    return render_template("index.html")

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=8000, debug=True)