import os
import json
import re
import threading
from datetime import datetime, timedelta
from dotenv import load_dotenv
import tempfile
from telegram import Update, Audio, Voice
from telegram.ext import ApplicationBuilder, ContextTypes, MessageHandler, CommandHandler, filters
import asyncio
import groq
from twilio.rest import Client as TwilioClient

load_dotenv()

# --- Setup ---
groq_api_key = os.getenv("GROQ_API_KEY")
client = groq.Client(api_key=groq_api_key)

twilio_sid = os.getenv("TWILIO_SID")
twilio_token = os.getenv("TWILIO_TOKEN")
twilio_number = os.getenv("TWILIO_NUMBER")
user_phone_number = "+919360177805"  # Static for now

twilio_client = TwilioClient(twilio_sid, twilio_token)

# --- Utilities from Flask code ---
def clean_response(text):
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'\*(.*?)\*', r'\1', text)
    return text.strip()

def send_sms(message):
    twilio_client.messages.create(body=message, from_=twilio_number, to=user_phone_number)

def make_call(message):
    twiml = f'<Response><Say>{message}</Say></Response>'
    twilio_client.calls.create(twiml=twiml, to=user_phone_number, from_=twilio_number)

def detect_intent_llm(text):
    prompt = [
        {"role": "system", "content": (
            "You are an AI that extracts and classifies multiple intents from a user message.\n"
            "Supported intents: greeting, study_schedule, set_reminder, motivation, general_query.\n"
            "If the input contains multiple tasks, split them and label each with its intent.\n"
            "Reply in JSON format like:\n"
            "[{\"query\": \"message one\", \"intent\": \"greeting\"}]"
        )},
        {"role": "user", "content": f"User message: {text}"}
    ]
    response = client.chat.completions.create(model="llama3-70b-8192", messages=prompt)
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
    response = client.chat.completions.create(model="llama3-70b-8192", messages=prompt)
    try:
        return json.loads(response.choices[0].message.content.strip())
    except Exception as e:
        print("LLM Time Parse Error:", e)
        return None

def generate_response(query):
    prompt = [
         {"role": "system", "content": "You are an AI Study Assistant. Help students with study schedules, reminders, and motivation. Provide minimal and engaging responses.dont provide many responses make it simple and easy to understand pointwise explain it."},
        {"role": "user", "content": f"User Query: {query}"}
    ]
    response = client.chat.completions.create(model="llama3-70b-8192", messages=prompt)
    return clean_response(response.choices[0].message.content)

def generate_greeting_response(user_input):
    prompt = [
        {"role": "system", "content": "You are a friendly and gamified AI Study Buddy. Your tone should be fun, engaging, and motivational. Provide minimal and engaging responses."},
        {"role": "user", "content": f"User Query: {user_input}"}
    ]
    response = client.chat.completions.create(model="llama3-70b-8192", messages=prompt)
    return clean_response(response.choices[0].message.content)

def transcribe_audio_to_text(audio_path):
    with open(audio_path, "rb") as file:
        transcription = client.audio.transcriptions.create(
            file=(audio_path, file.read()),
            model="whisper-large-v3-turbo",
            response_format="verbose_json",
        )

    return transcription.text

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await process_input(update, context, update.message.text)

async def handle_voice(update: Update, context: ContextTypes.DEFAULT_TYPE):
    voice: Voice = update.message.voice
    with tempfile.NamedTemporaryFile(delete=False, suffix=".ogg") as tmp:
        file = await context.bot.get_file(voice.file_id)
        await file.download_to_drive(tmp.name)

    user_input = transcribe_audio_to_text(tmp.name)
    os.remove(tmp.name)
    await process_input(update, context, user_input)

async def countdown_timer(context, chat_id, seconds):
    message = await context.bot.send_message(chat_id=chat_id, text=f"⏳ Timer: {seconds} seconds remaining")
    
    for remaining in range(seconds - 1, 0, -1):
        await asyncio.sleep(1)
        try:
            await message.edit_text(f"⏳ Timer: {remaining} seconds remaining")
        except Exception as e:
            print("Error editing message:", e)
            break
    
    await asyncio.sleep(1)
    await message.edit_text("✅ Timer done! Take a break ☕")

# --- Telegram Handlers ---
async def process_input(update: Update, context: ContextTypes.DEFAULT_TYPE, user_input: str):
    responses = []
    sub_queries = detect_intent_llm(user_input)

    for item in sub_queries:
        query = item["query"]
        intent = item["intent"]

        if intent == "greeting":
            responses.append(generate_greeting_response(query))

        elif intent in ["study_schedule", "set_reminder"]:
            time_data = extract_time_llm(query)
            if time_data:
                if time_data["type"] == "relative":
                    asyncio.create_task(countdown_timer(context,update.effective_chat.id,time_data["seconds"]))

                elif time_data["type"] == "absolute":
                    def alarm():
                        send_sms(f"Reminder: Your session is at {time_data['time']}")
                        make_call(f"This is your Study Buddy. It's time to study at {time_data['time']}")
                        context.bot.send_message(chat_id=update.effective_chat.id, text="📞 Alarm triggered!")
                    now = datetime.now()
                    target = datetime.strptime(time_data["time"], "%I:%M %p").replace(
                        year=now.year, month=now.month, day=now.day)
                    if target < now:
                        target += timedelta(days=1)
                    delay = (target - now).total_seconds()
                    threading.Timer(delay, alarm).start()
                    responses.append(f"⏰ Alarm set for {time_data['time']}")
            else:
                responses.append("⌛ Please give a valid time to schedule.")

        elif intent == "motivation":
            responses.append(generate_response(query))
        else:
            responses.append(generate_response(query))

    if responses:
        await update.message.reply_text("\n\n".join(responses))
    else:
        await update.message.reply_text("🤔 I didn't catch that. Can you rephrase?")



async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("👋 Hey! I'm your AI Study Buddy. How can I help you today?")


def main():
    telegram_token = os.getenv("TELEGRAM_BOT_TOKEN")
    app = ApplicationBuilder().token(telegram_token).build()
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), handle_text))
    app.add_handler(MessageHandler(filters.VOICE, handle_voice))

    print("✅ Telegram bot running...")
    app.run_polling()


if __name__ == "__main__":
    main()
