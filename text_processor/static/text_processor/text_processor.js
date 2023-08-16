// Utility function to get selected text from PDF.js viewer
function getSelectedTextFromViewer() {
    const viewerIframe = document.getElementById('pdf-viewer-frame');
    const viewerDocument = viewerIframe.contentDocument || viewerIframe.contentWindow.document;

    if (viewerDocument) {
        return viewerDocument.getSelection().toString();
    }

    return "";
}

function showOptionsAboveSelectedText() {
    console.log("Trying to show options...");

    const selectedText = getSelectedTextFromViewer();
    console.log("Selected Text:", selectedText);

    if (selectedText.trim() !== "") {
        const optionsDiv = window.top.document.getElementById('text-options');  // Use window.top to ensure we're accessing the main document

        if (!optionsDiv) {
            console.error("Cannot find the text-options div in the DOM.");
            return;
        }

        optionsDiv.style.display = 'block';
    } else {
        const optionsDiv = window.top.document.getElementById('text-options');
        optionsDiv.style.display = 'none';
    }
}



function updateButtonStates() {
    const selectedText = getSelectedTextFromViewer();
    const summarizeBtn = parent.document.getElementById('summarizeBtn');
    const explainBtn = parent.document.getElementById('explainBtn');
    const optionsDiv = parent.document.getElementById('text-options');

    if (selectedText.trim() !== "") {
        summarizeBtn.disabled = false;
        explainBtn.disabled = false;
        optionsDiv.style.display = 'block';
    } else {
        summarizeBtn.disabled = true;
        explainBtn.disabled = true;
        optionsDiv.style.display = 'none';
    }
}

function wordCount(str) {
    return str.split(/\s+/).filter(Boolean).length;
}

function summarizeText() {
    const text = getSelectedTextFromViewer();
    const count = wordCount(text);

    if (count > 50) {
        sendDataToBackend(text, 'summarize');
    } else {
        alert("Please select more than 50 words to summarize.");
    }
}

function explainText() {
    const text = getSelectedTextFromViewer();
    sendDataToBackend(text, 'explain');
}


function sendMessage() {
    // Get user input
    const userInput = document.getElementById("user-input").value;

    // Append user message to the chatbox
    appendMessage("user", userInput);

    // Get the PDF content from the hidden input field
    const pdfContent = document.getElementById("pdf-content").value;

    // Prepare data to send to the server
    const data = {
        text: userInput,
        action: "summarize",
        pdf_content: pdfContent
    };

    // Send data to the server
    fetch("/process_text/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    })
    .then(response => response.json())
    .then(data => {
        // Append bot's reply to the chatbox
        appendMessage("bot", data.result);
    })
    .catch(error => {
        console.error("Error:", error);
    });
}

function sendDataToBackend(text, action) {
    fetch(`/process_text/`, {
        method: 'POST',
        body: JSON.stringify({
            text: text,
            action: action
        }),
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        }
    })
    .then(response => response.json())
    .then(data => {
        appendMessage("bot", data.result);
    })
    .catch(error => {
        console.error('There was a problem with the fetch operation:', error.message);
    });
}

function appendMessage(sender, message) {
    const chatMessages = document.getElementById("chat-messages");
    const messageDiv = document.createElement("div");
    messageDiv.className = sender + "-message";
    const messageContent = `
        <span class="message-label">${sender === "user" ? "You" : "Bot"}:</span>
        <p class="message-content">${message}</p>
    `;
    messageDiv.innerHTML = messageContent;
    chatMessages.appendChild(messageDiv);
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

document.getElementById('pdf-upload-input').addEventListener('change', function(event) {
    var file = event.target.files[0];
    if (file) {
        var reader = new FileReader();
        reader.onload = function(evt) {
            var blob = new Blob([evt.target.result], {type: 'application/pdf'});
            var blobURL = URL.createObjectURL(blob);
            
            // Set the iframe's src to the blobURL
            document.getElementById('pdf-viewer-frame').src = '{% static "pdfjs-3/web/viewer.html" %}?file=' + encodeURIComponent(blobURL);
        };
        reader.readAsArrayBuffer(file);
    }
});

function bindIframeEvents() {
    const pdfViewerFrame = document.getElementById('pdf-viewer-frame');
    if (pdfViewerFrame) {
        console.log("Iframe loaded");

        // Existing Mouseup Event
        pdfViewerFrame.contentWindow.document.addEventListener('mouseup', function() {
            console.log("Mouseup event triggered inside iframe");
            updateButtonStates();
            showOptionsAboveSelectedText();
        });

        // Test Click Event Listener
        pdfViewerFrame.contentWindow.document.body.onclick = function() {
            console.log("Click event triggered inside iframe");
        };
    } else {
        setTimeout(bindIframeEvents, 500);  // retry after 500ms
    }
}

document.addEventListener("DOMContentLoaded", bindIframeEvents);