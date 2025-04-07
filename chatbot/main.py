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


load_dotenv()
# Initialize Flask app with SocketIO
app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

groq_api_key = os.getenv("GROQ_API_KEY")
client = groq.Client(api_key=groq_api_key) 
    
""" def detect_intent_llm(text):
    prompt = [
        {"role": "system", "content": "You are an AI assistant that detects user intent from queries. Intent categories: greeting, study_schedule, set_reminder, motivation, general_query. Reply with only the intent name."},
        {"role": "user", "content": f"Query: {text}"}
    ]

    response = client.chat.completions.create(
        model="llama3-70b-8192",
        messages=prompt
    )
    
    intent = response.choices[0].message.content.strip().lower()

    # Ensure a valid intent is returned
    valid_intents = ["greeting", "study_schedule", "set_reminder", "motivation", "general_query"]
    return intent if intent in valid_intents else "general_query" """

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
user_phone_number = "+919360177805"

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

# Start timer and send event when finished
def start_timer(seconds):
    socketio.emit("start_timer", {"seconds": seconds})  # Send initial time
    threading.Timer(seconds, lambda: socketio.emit("timer_finished", {"message": "✅ Timer finished! Take a short break! ☕"})).start()

# Generate chatbot response using Groq
def generate_response(query):
    search_prompt = [
        {"role": "system", "content": "You are an AI Study Assistant. Help students with study schedules, reminders, and motivation. Provide minimal and engaging responses.dont provide many responses make it simple and easy to understand pointwise explain it."},
        {"role": "user", "content": f"User Query: {query}"}
    ]

    response = client.chat.completions.create(model="llama3-70b-8192", messages=search_prompt)
    raw_response = response.choices[0].message.content
    return clean_response(raw_response)

# Generate dynamic greeting response
def generate_greeting_response(user_input):
    greet_prompt = [
        {"role": "system", "content": "You are a friendly and gamified AI Study Buddy. Your tone should be fun, engaging, and motivational. Provide minimal and engaging responses."},
        {"role": "user", "content": f"User Query: {user_input}"}
    ]

    response = client.chat.completions.create(model="llama3-70b-8192", messages=greet_prompt)
    raw_response = response.choices[0].message.content
    return clean_response(raw_response)


def transcribe_audio_to_text(audio_path):
    with open(audio_path, "rb") as file:
        transcription = client.audio.transcriptions.create(
            file=(audio_path, file.read()),
            model="whisper-large-v3-turbo",
            response_format="verbose_json",
        )

    return transcription.text


@app.route("/chat", methods=["POST"])
def chat():
    transcribed = None

    # Handle audio or text input
    if 'audio' in request.files:
        audio_file = request.files['audio']
        temp_path = "temp_audio.m4a"
        audio_file.save(temp_path)
        user_input = transcribe_audio_to_text(temp_path)
        transcribed = user_input
        os.remove(temp_path)
    else:
        user_input = request.json.get("query", "").strip()
        transcribed = user_input

    if not user_input:
        return jsonify({
            "response": "I couldn't find relevant information. Can you rephrase?",
            "transcribed": transcribed
        })

    # Detect multiple sub-queries and intents
    sub_queries = detect_intent_llm(user_input)
    print("Detected sub-queries:", sub_queries)

    responses = []

    for item in sub_queries:
        query = item["query"]
        intent = item["intent"]
        print(f"Processing intent '{intent}' for query: {query}")

        if intent == "greeting":
            responses.append(generate_greeting_response(query))

        elif intent in ["study_schedule", "set_reminder"]:
            time_data = extract_time_llm(query)
            print("Time LLM Output:", time_data)

            if time_data:
                scheduled_info = f"your scheduled session at {time_data['time']}"

                if time_data["type"] == "relative":
                    threading.Thread(target=start_timer, args=(time_data["seconds"],)).start()
                    responses.append(f"✅ Timer started! Your study session is set for {time_data['seconds']}. Time to focus! 📚")

                elif time_data["type"] == "absolute":
                    def alarm_trigger():
                        send_sms(f"Hi! 📅 It’s time for {scheduled_info}. Stay sharp! 💪")
                        make_call(f"This is your study assistant calling. It's time for {scheduled_info}. Let’s get started!")

                    now = datetime.now()
                    target_time = datetime.strptime(time_data["time"], "%I:%M %p")
                    target_time = target_time.replace(year=now.year, month=now.month, day=now.day)

                    if target_time < now:
                        target_time += timedelta(days=1)

                    delay_seconds = (target_time - now).total_seconds()
                    threading.Timer(delay_seconds, alarm_trigger).start()

                    responses.append(f"⏰ Alarm set for {time_data['time']}. I’ll call and message you when it’s time! 📞")
            else:
                responses.append("⌛ I can set up your study session, but I need a valid time. When should we start? 🕒")

        elif intent == "motivation":
            responses.append(generate_response(query))

        else:  # general_query or fallback
            responses.append(generate_response(query))

    return jsonify({
        "response": "\n\n".join(responses),
        "transcribed": transcribed
    })

    
@app.route("/")
def home():
    return render_template("index.html")


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
