import os
import json
import re
import threading
import base64
from datetime import datetime, timedelta
from dotenv import load_dotenv
import tempfile
from telegram import Update, Audio, Voice, PhotoSize
from telegram.ext import ApplicationBuilder, ContextTypes, MessageHandler, CommandHandler, filters
import asyncio
import groq
from twilio.rest import Client as TwilioClient
from PyPDF2 import PdfReader
import docx
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
load_dotenv()

# --- Setup ---
groq_api_key = os.getenv("GROQ_API_KEY")
client = groq.Client(api_key=groq_api_key)

twilio_sid = os.getenv("TWILIO_SID")
twilio_token = os.getenv("TWILIO_TOKEN")
twilio_number = os.getenv("TWILIO_NUMBER")
user_phone_number = os.getenv("USED_PHONE_NUMBER")

twilio_client = TwilioClient(twilio_sid, twilio_token)

# --- Document Indexing Setup ---
embedding_dim = 384  # Dimension of embeddings
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')  
index = faiss.IndexFlatL2(embedding_dim)
id_to_text = {}
next_id = 0

# --- Utilities ---
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

# --- Image and Document Handling ---
async def handle_image(update: Update, context: ContextTypes.DEFAULT_TYPE):
    photo = update.message.photo[-1]  # Get highest resolution photo
    file = await context.bot.get_file(photo.file_id)
    
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        await file.download_to_drive(tmp.name)
        with open(tmp.name, "rb") as image_file:
            caption = update.message.caption or "Describe this image"
            response = handle_image_query(image_file, caption)
    
    os.remove(tmp.name)
    await update.message.reply_text(response)

def handle_image_query(image_file, query=None):
    image_bytes = image_file.read()
    mime_type = "image/jpeg"  # Telegram sends as JPEG
    
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

async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    document = update.message.document
    file = await context.bot.get_file(document.file_id)
    
    with tempfile.NamedTemporaryFile(suffix=document.file_name, delete=False) as tmp:
        await file.download_to_drive(tmp.name)
        try:
            text = extract_text(tmp)
            store_file_and_index(tmp)
            response = "📄 Document processed and indexed!"
        except ValueError as e:
            response = f"❌ Error: {str(e)}"
        except Exception as e:
            response = "❌ An error occurred while processing the document."
            print("Document processing error:", e)
    
    os.remove(tmp.name)
    await update.message.reply_text(response)

def extract_text(file):
    filename = file.name.lower()
    if filename.endswith(".pdf"):
        reader = PdfReader(file.name)
        return "\n".join(page.extract_text() for page in reader.pages if page.extract_text())
    elif filename.endswith(".docx"):
        doc = docx.Document(file.name)
        return "\n".join([para.text for para in doc.paragraphs])
    elif filename.endswith(".txt"):
        with open(file.name, "r") as f:
            return f.read()
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

def generate_llama_response_with_context(query, context):
    final_prompt = f"""You are a AI Study Buddy assistant. Use the following context to answer the question.

Context:
{context}

Question:
{query}
"""
    chat_completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
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

# --- Core Message Processing ---
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
            # Check if we have document context to use
            context_text = retrieve_relevant_text(query)
            if context_text and "No relevant context" not in context_text:
                responses.append(generate_llama_response_with_context(query, context_text))
            else:
                responses.append(generate_response(query))

    if responses:
        await update.message.reply_text("\n\n".join(responses))
    else:
        await update.message.reply_text("🤔 I didn't catch that. Can you rephrase?")

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

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("👋 Hey! I'm your AI Study Buddy. How can I help you today?")

def main():
    telegram_token = os.getenv("TELEGRAM_BOT_TOKEN")
    app = ApplicationBuilder().token(telegram_token).build()
    
    # Add handlers
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), handle_text))
    app.add_handler(MessageHandler(filters.VOICE, handle_voice))
    app.add_handler(MessageHandler(filters.PHOTO, handle_image))
    app.add_handler(MessageHandler(filters.Document.ALL, handle_document))

    print("✅ Telegram bot running...")
    app.run_polling()

if __name__ == "__main__":
    main()