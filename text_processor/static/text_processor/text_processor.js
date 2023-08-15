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

    const viewerIframe = document.getElementById('pdf-viewer-frame');
    const viewerDocument = viewerIframe.contentDocument || viewerIframe.contentWindow.document;
    const selection = viewerDocument.getSelection();

    const selectedText = selection.toString();
    console.log("Selected Text:", selectedText);

    if (selectedText.trim() !== "") {
        if (selection.rangeCount === 0) {
            return;
        }

        const range = selection.getRangeAt(0);
        const rects = range.getClientRects();
        const firstRect = rects[0];

        const optionsDiv = parent.document.getElementById('text-options');
        console.log("Options Div:", optionsDiv);

        if (!optionsDiv) {
            console.error("Cannot find the text-options div in the DOM.");
            return;
        }

        const divWidth = optionsDiv.offsetWidth;
        const divHeight = optionsDiv.offsetHeight;

        optionsDiv.style.left = (firstRect.left + (firstRect.width / 2) - (divWidth / 2)) + 'px'; 
        optionsDiv.style.top = (firstRect.top - divHeight - 10) + 'px';
        optionsDiv.style.display = 'block';

        console.log("Computed coordinates:", {left: firstRect.left, top: (firstRect.top - divHeight - 10)});
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

let pdfContent = "";

function extractPdfContentFromPdfJs() {
    const viewerIframe = document.getElementById('pdf-viewer-frame');
    const viewerDocument = viewerIframe.contentDocument || viewerIframe.contentWindow.document;

    if (!viewerDocument.PDFViewerApplication || !viewerDocument.PDFViewerApplication.pdfDocument) {
        console.error("PDFViewerApplication or pdfDocument is not available.");
        return;
    }
    
    const pdfUrl = viewerDocument.PDFViewerApplication.pdfDocument._transport._params.url; // Get PDF URL

    // Ensure PDF.js worker is correctly set up
    pdfjsLib.GlobalWorkerOptions.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.js';
    document.getElementById('user-input').disabled = true;

    pdfjsLib.getDocument(pdfUrl).promise.then(function(pdf) {
        let totalPages = pdf.numPages;
        let allPagesText = [];

        for(let i = 1; i <= totalPages; i++) {
            allPagesText.push(pdf.getPage(i).then(function(page) {
                return page.getTextContent().then(function(textContent) {
                    return textContent.items.map(function(item) {
                        return item.str;
                    }).join(' ');
                });
            }));
        }

        Promise.all(allPagesText).then(function(pagesText) {
            pdfContent = pagesText.join(' ');
            console.log("Extracted PDF Content:", pdfContent);
            document.getElementById('user-input').disabled = false;

        });
    }).catch(function(error) {
        console.error("Error extracting PDF content:", error);
    });
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
    const input = document.getElementById('user-input');
    const message = input.value;
    input.value = "";

    const context = `Document says: ${pdfContent}. User asks: ${message}`;
    sendDataToBackend(context, 'query');

    const chatMessages = parent.document.getElementById('chat-messages');
    chatMessages.innerHTML += `<div>User: ${message}</div>`;
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
        console.log(data);  // This will show you the exact response you're getting from the backend
        const chatMessages = parent.document.getElementById('chat-messages');
        chatMessages.innerHTML += `<div>Bot: ${data.result}</div>`;
    })    
    .catch(error => {
        console.error('There was a problem with the fetch operation:', error.message);
    });
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

function waitForPDFViewerApplication(callback, timeout = 3000, interval = 200) {
    let waited = 0;
    
    function check() {
        const viewerIframe = document.getElementById('pdf-viewer-frame');
        const viewerDocument = viewerIframe.contentDocument || viewerIframe.contentWindow.document;

        if (viewerDocument.PDFViewerApplication && viewerDocument.PDFViewerApplication.pdfDocument) {
            callback();
        } else if (waited < timeout) {
            waited += interval;
            setTimeout(check, interval);
        } else {
            console.error("Timeout: PDFViewerApplication or pdfDocument is not available.");
        }
    }

    check();
}

function checkPDFViewerReady(callback) {
    const viewerIframe = document.getElementById('pdf-viewer-frame');
    const viewerDocument = viewerIframe.contentDocument || viewerIframe.contentWindow.document;

    if (viewerDocument.PDFViewerApplication && viewerDocument.PDFViewerApplication.pdfDocument) {
        callback();
    } else {
        setTimeout(() => checkPDFViewerReady(callback), 500); // check every half-second
    }
}

if (pdfViewerFrame) {
    pdfViewerFrame.addEventListener('load', function() {
        console.log("Iframe loaded");

        // Check for PDF.js readiness and then extract content
        checkPDFViewerReady(extractPdfContentFromPdfJs);

        pdfViewerFrame.contentWindow.document.addEventListener('mouseup', function() {
            console.log("Mouseup event triggered inside iframe");
            updateButtonStates();
            showOptionsAboveSelectedText();
        });
    });
} else {
    console.error('Cannot find the PDF viewer frame.');
}
