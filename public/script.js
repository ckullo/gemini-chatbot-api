document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatBox = document.getElementById('chat-box');
    const sendButton = chatForm.querySelector('button[type="submit"]');

    /**
     * Adds a message to the chat box.
     * @param {string} sender - 'user' or 'bot'.
     * @param {string} message - The message text.
     * @param {boolean} [isTemporary=false] - If true, marks the message for later replacement.
     * @returns {HTMLElement} The created message element.
     */
    function addMessage(sender, message, isTemporary = false) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', sender);
        if (sender === 'bot') {
            messageElement.innerHTML = formatMessageText(message);
        } else {
            messageElement.textContent = message;
        }
        if (isTemporary) {
            messageElement.dataset.temporary = 'true';
            messageElement.classList.add('thinking'); // Add a class for "thinking" state
        }
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to the latest message
        return messageElement;
    }

    /**
     * Replaces a temporary message element with a new message.
     * @param {HTMLElement} tempElement - The temporary message element to replace.
     * @param {string} newMessage - The new message text.
     */
    function replaceTemporaryMessage(tempElement, newMessage) {
        if (tempElement && tempElement.dataset.temporary === 'true') {
            tempElement.innerHTML = formatMessageText(newMessage);
            delete tempElement.dataset.temporary; // Remove the temporary flag
            tempElement.classList.remove('thinking'); // Remove thinking class
            // Ensure it retains 'bot' class if it was a bot message
            if (!tempElement.classList.contains('bot')) {
                tempElement.classList.add('bot');
            }
            chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll
        }
    }

    /** Formats message text for better display / readability */
    function formatMessageText(text) {
        if (!text) return '';
        // escape HTML special characters to prevent XSS
        text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // headings
        text = text.replace(/^### (.*)$/gm, '<h3>$1</h3>');
        text = text.replace(/^## (.*)$/gm, '<h2>$1</h2>');
        text = text.replace(/^# (.*)$/gm, '<h1>$1</h1>');
        
        // bold **text**
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // italics *text*
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // inline code `code`
        text = text.replace(/`(.*?)`/g, '<code>$1</code>');
        // code blocks ```code```
        text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        // line breaks
        text = text.replace(/\n/g, '<br>');

        //bulleted lists
        text = text.replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>');
        text = text.replace(/(<li>.*<\/li>)/gms, '<ul>$1</ul>');

        // numbered lists
        text = text.replace(/^\s*\d+\.\s+(.*)$/gm, '<li>$1</li>');
        text = text.replace(/(<li>.*<\/li>)/gms, '<ol>$1</ol>');

        // links [text](url)
        text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

        // paragraphs
        text = text.replace(/^(?!<ul>|<ol>|<li>|<pre>|<code>|<strong>|<em>|<a>)(.+)$/gm, '<p>$1</p>');

        // Replace multiple spaces with a single space
        let formatted = text.replace(/\s+/g, ' ');
        // Trim leading and trailing whitespace
        formatted = formatted.trim();
        return formatted;
    }
    chatForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission and page reload

        const userMessage = userInput.value.trim();
        if (!userMessage) {
            return; // Do not send empty messages
        }

        // 1. Add the user's message to the chat box
        addMessage('user', userMessage);
        userInput.value = ''; // Clear the input field

        // Disable input and button to prevent multiple submissions while waiting for response
        userInput.disabled = true;
        sendButton.disabled = true;

        // 2. Show a temporary "Thinking..." bot message
        const thinkingMessageElement = addMessage('bot', 'Thinking...', true);

        try {
            // 3. Send the user's message as a POST request to /api/chat
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [{
                        role: 'user',
                        content: userMessage
                    }],
                }),
            });

            if (!response.ok) {
                // If the HTTP response status is not 2xx, throw an error
                let errorMessage = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error?.message || errorData.message || errorMessage;
                } catch (jsonError) {
                    // If parsing JSON fails, use the default HTTP error message
                    console.error('Failed to parse error response JSON:', jsonError);
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();

            // 4. When the response arrives, replace the "Thinking..." message with the AI's reply
            if (data && data.result) {
                replaceTemporaryMessage(thinkingMessageElement, data.result);
            } else {
                // 5. If no result is received, show "Sorry, no response received."
                replaceTemporaryMessage(thinkingMessageElement, 'Sorry, no response received.');
            }

        } catch (error) {
            console.error('Error sending message to API:', error);
            // 5. If an error occurs, show "Failed to get response from server."
            replaceTemporaryMessage(thinkingMessageElement, 'Failed to get response from server.');
        } finally {
            // Re-enable input and button regardless of success or failure
            userInput.disabled = false;
            sendButton.disabled = false;
            userInput.focus(); // Focus back on the input field for convenience
        }
    });
});