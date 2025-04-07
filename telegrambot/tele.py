import os
import json
import re
import threading
from datetime import datetime, timedelta
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters, ContextTypes

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
        {"role": "system", "content": (
            "You are an intelligent assistant that extracts time from user queries.\n"
            "Return a JSON with: type (relative/absolute), time (12hr), seconds (only if relative).\n"
            "Return null if no time is found."
        )},
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
        {"role": "system", "content": "You are an AI Study Assistant. Help with schedules, reminders, and motivation."},
        {"role": "user", "content": f"User Query: {query}"}
    ]
    response = client.chat.completions.create(model="llama3-70b-8192", messages=prompt)
    return clean_response(response.choices[0].message.content)

def generate_greeting_response(user_input):
    prompt = [
        {"role": "system", "content": "You are a fun, gamified AI Study Buddy. Be motivational and friendly."},
        {"role": "user", "content": f"User Query: {user_input}"}
    ]
    response = client.chat.completions.create(model="llama3-70b-8192", messages=prompt)
    return clean_response(response.choices[0].message.content)

# --- Telegram Handlers ---
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_input = update.message.text.strip()
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
                    def timer_action():
                        context.bot.send_message(chat_id=update.effective_chat.id, text="✅ Timer finished! Time for a break ☕")
                    threading.Timer(time_data["seconds"], timer_action).start()
                    responses.append(f"✅ Timer started for {time_data['seconds']} seconds.")
                else:
                    def alarm_action():
                        send_sms(f"⏰ Study reminder: {time_data['time']}")
                        make_call(f"This is your Study Buddy. It's time to study at {time_data['time']}")
                        context.bot.send_message(chat_id=update.effective_chat.id, text="📞 Alarm triggered!")
                    now = datetime.now()
                    target = datetime.strptime(time_data["time"], "%I:%M %p").replace(year=now.year, month=now.month, day=now.day)
                    if target < now:
                        target += timedelta(days=1)
                    delay = (target - now).total_seconds()
                    threading.Timer(delay, alarm_action).start()
                    responses.append(f"⏰ Alarm set for {time_data['time']}")
            else:
                responses.append("⌛ Please provide a valid time for scheduling.")

        elif intent == "motivation":
            responses.append(generate_response(query))
        else:
            responses.append(generate_response(query))

    full_response = "\n\n".join(responses)
    await update.message.reply_text(full_response)


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("👋 Hey! I'm your AI Study Buddy. How can I help you today?")


def main():
    telegram_token = os.getenv("TELEGRAM_BOT_TOKEN")
    app = ApplicationBuilder().token(telegram_token).build()

    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print("🚀 Telegram bot running...")
    app.run_polling()


if __name__ == "__main__":
    main()
