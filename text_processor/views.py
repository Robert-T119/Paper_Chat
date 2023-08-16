from django.shortcuts import render
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseRedirect
from django.core.files.storage import FileSystemStorage
from django.views.decorators.csrf import csrf_exempt
from django.urls import reverse
from django.core.exceptions import ValidationError
from django.conf import settings
import json
import openai
import os
from dotenv import load_dotenv
from PyPDF2 import PdfReader
import shutil

load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

def index(request):
    context = {}

    # If 'pdf_url' is in the session, use it for this one time and then clear it
    if 'pdf_url' in request.session:
        context['file_url'] = request.session['pdf_url']
        del request.session['pdf_url']  # Clear it after use

    return render(request, 'text_processor/index.html', context)

def clean_temp_directory():
    temp_dir = os.path.join(settings.MEDIA_ROOT, 'temp')
    for filename in os.listdir(temp_dir):
        file_path = os.path.join(temp_dir, filename)
        try:
            if os.path.isfile(file_path) or os.path.islink(file_path):
                os.unlink(file_path)
            elif os.path.isdir(file_path):
                shutil.rmtree(file_path)
        except Exception as e:
            print(f'Failed to delete {file_path}. Reason: {e}')

def upload_pdf(request):
    if request.method == "POST":
        # First, clean up any old files in the temp directory
        clean_temp_directory()

        pdf_file = request.FILES['pdf_file']

        # Ensure the directory exists
        temp_directory = os.path.join(settings.MEDIA_ROOT, 'temp')
        os.makedirs(temp_directory, exist_ok=True)

        # Save the file to the temp directory
        file_path = os.path.join(temp_directory, pdf_file.name)
        with open(file_path, 'wb+') as destination:
            for chunk in pdf_file.chunks():
                destination.write(chunk)

        pdf_content = extract_text_from_pdf(file_path)

        # Print the extracted content for debugging
        print("Extracted PDF Content:", pdf_content)

        # Storing the pdf_content in the session for subsequent use
        request.session['pdf_content'] = pdf_content

        # Store the relative URL to the uploaded PDF file in the session
        relative_url = os.path.join('media', 'temp', pdf_file.name)
        request.session['pdf_url'] = relative_url

        return HttpResponseRedirect(reverse('index'))  # Redirect to the main page after upload

    return render(request, 'upload_pdf.html')


def extract_text_from_pdf(pdf_file):
    pdf_reader = PdfReader(pdf_file)
    text = ""
    for page_num in range(len(pdf_reader.pages)):
        page = pdf_reader.pages[page_num]
        text += page.extract_text()
    return text

# Rest of your functions like process_text, your_summarize_function, and your_explain_function remain unchanged.

@csrf_exempt
def process_text(request):
    print("Starting process_text")
    
    if request.method != "POST":
        return HttpResponseBadRequest("Only POST method is allowed.")
    
    try:
        data = json.loads(request.body)
        print("Loaded JSON data:", data)
        
        text = data.get('text')
        action = data.get('action')
        pdf_content = data.get('pdf_content', "")

        if not text or not action:
            return HttpResponseBadRequest("Invalid data format.")
        
        # Using the provided pdf_content directly
        pdf_text = pdf_content if pdf_content else ""
        print("Using PDF Text:", pdf_text)
        
        # Use the extracted text as context when sending to OpenAI
        context = f"Document says: {pdf_text}. User asks: {text}"
        print("Prepared context:", context)
        
        result = ""
        if action == 'summarize':
            print("Action is 'summarize'")
            result = your_summarize_function(context)
        elif action == 'explain':
            print("Action is 'explain'")
            result = your_explain_function(context)
        elif action == 'query':
            print("Action is 'query'")
            response = openai.Completion.create(
                engine="text-davinci-003",
                prompt=context,
                max_tokens=150
            )
            result = response.choices[0].text.strip()
        else:
            return HttpResponseBadRequest("Invalid action.")
        
        print("Returning result:", result)
        return JsonResponse({'result': result})

    except ValidationError as ve:
        print("Validation error:", ve)
        return JsonResponse({'error': str(ve)}, status=400)
    except Exception as e:
        print("An exception occurred:", e)
        return JsonResponse({'error': str(e)}, status=500)

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
