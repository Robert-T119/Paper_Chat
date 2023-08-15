from django.shortcuts import render
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
import json
import openai
import os
from dotenv import load_dotenv
from PyPDF2 import PdfFileReader
from io import BytesIO


load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

def index(request):
    return render(request, 'text_processor/index.html')

def your_summarize_function(text):
    try:
        response = openai.Completion.create(
            engine="text-davinci-003",
            prompt=f"Summarize the following text: {text}",
            max_tokens=150  # Adjust as needed
        )
        return response.choices[0].text.strip()
    except Exception as e:
        return str(e)

def your_explain_function(text):
    try:
        response = openai.Completion.create(
            engine="text-davinci-003",
            prompt=f"Explain the following text in a systematic way: {text}",
            max_tokens=1500  # Adjust as needed
        )
        return response.choices[0].text.strip()
    except Exception as e:
        return str(e)
    
def extract_text_from_pdf(pdf_content):
    pdf_io = BytesIO(pdf_content)
    pdf_reader = PdfFileReader(pdf_io)
    text = ""
    for page_num in range(pdf_reader.numPages):
        page = pdf_reader.getPage(page_num)
        text += page.extractText()
    return text

@csrf_exempt
def process_text(request):
    if request.method != "POST":
        return HttpResponseBadRequest("Only POST method is allowed.")
    
    try:
        data = json.loads(request.body)
        text = data.get('text')
        action = data.get('action')
        pdf_content = data.get('pdf_content', None)
        
        if not text or not action:
            return HttpResponseBadRequest("Invalid data format.")
        
        # Extract text from PDF if provided
        pdf_text = ""
        if pdf_content:
            pdf_text = extract_text_from_pdf(pdf_content)
        
        # Use the extracted text as context when sending to OpenAI
        context = f"Document says: {pdf_text}. User asks: {text}"
        
        result = ""
        if action == 'summarize':
            result = your_summarize_function(context)
        elif action == 'explain':
            result = your_explain_function(context)
        elif action == 'query':
            response = openai.Completion.create(
                engine="text-davinci-003",
                prompt=context,
                max_tokens=150
            )
            result = response.choices[0].text.strip()
            print(response.choices[0].text.strip())

        else:
            return HttpResponseBadRequest("Invalid action.")
        
        return JsonResponse({'result': result})


    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
