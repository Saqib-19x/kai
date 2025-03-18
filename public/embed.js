(function() {
  // Get configuration from the page
  const config = window.chatbaseConfig || {};
  const agentId = config.agentId;
  const apiEndpoint = config.apiEndpoint || 'https://your-default-api.com/api';
  const settings = config.settings || {
    primaryColor: '#4285F4', // Modern Google-like blue
    position: 'bottom-right',
    welcomeMessage: 'Hi! Ask me anything!',
    bubbleIcon: 'default',
    showBranding: true,
    autoOpen: false,
    width: '380px',
    height: '600px', // Slightly taller for better mobile experience
    darkMode: false,
    borderRadius: '16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
    bubbleSize: '60px',
    animation: true
  };
  
  // Inject styles
  const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes chatbase-fade-in {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      @keyframes chatbase-pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }
      
      @keyframes chatbase-typing {
        0% { opacity: 0.3; }
        50% { opacity: 1; }
        100% { opacity: 0.3; }
      }
      
      #chatbase-container * {
        box-sizing: border-box;
      }
      
      .chatbase-message {
        transition: all 0.3s ease;
        animation: chatbase-fade-in 0.3s ease;
        margin-bottom: 16px;
        max-width: 85%;
        position: relative;
        font-size: 15px;
        line-height: 1.5;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      }
      
      .chatbase-message.user {
        border-radius: 18px 18px 4px 18px;
        margin-left: auto;
        background: ${settings.primaryColor};
        color: white;
        padding: 12px 16px;
      }
      
      .chatbase-message.bot {
        border-radius: 18px 18px 18px 4px;
        margin-right: auto;
        background: ${settings.darkMode ? '#3A3F4B' : '#F0F4F9'};
        color: ${settings.darkMode ? '#E9EDF4' : '#2D3748'};
        padding: 12px 16px;
      }
      
      .chatbase-timestamp {
        font-size: 10px;
        text-align: right;
        margin-top: 4px;
        opacity: 0.6;
      }
      
      .chatbase-typing-indicator {
        display: flex;
        align-items: center;
        margin-bottom: 16px;
      }
      
      .chatbase-typing-indicator span {
        height: 8px;
        width: 8px;
        margin: 0 2px;
        background-color: ${settings.darkMode ? '#6B7280' : '#CBD5E0'};
        border-radius: 50%;
        display: inline-block;
        animation: chatbase-typing 1s infinite;
      }
      
      .chatbase-typing-indicator span:nth-child(2) {
        animation-delay: 0.2s;
      }
      
      .chatbase-typing-indicator span:nth-child(3) {
        animation-delay: 0.4s;
      }
      
      .chatbase-quick-replies {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 10px;
      }
      
      .chatbase-quick-reply {
        background: ${settings.darkMode ? '#2D3748' : '#E2E8F0'};
        color: ${settings.darkMode ? '#E2E8F0' : '#4A5568'};
        border: none;
        border-radius: 20px;
        padding: 8px 14px;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .chatbase-quick-reply:hover {
        background: ${settings.darkMode ? '#4A5568' : '#CBD5E0'};
      }
    `;
    document.head.appendChild(style);
  };
  
  // Create chat elements with modern styling
  const createChatElements = () => {
    injectStyles();
    
    // Create container with proper z-index
    const container = document.createElement('div');
    container.id = 'chatbase-container';
    container.style.position = 'fixed';
    container.style.zIndex = '999999';
    container.style.fontFamily = settings.fontFamily;
    
    // Position the container
    if (settings.position.includes('bottom')) {
      container.style.bottom = '20px';
    } else {
      container.style.top = '20px';
    }
    
    if (settings.position.includes('right')) {
      container.style.right = '20px';
    } else {
      container.style.left = '20px';
    }
    
    // Create chat bubble with modern styling
    const bubble = document.createElement('div');
    bubble.id = 'chatbase-bubble';
    bubble.style.width = settings.bubbleSize;
    bubble.style.height = settings.bubbleSize;
    bubble.style.backgroundColor = settings.primaryColor;
    bubble.style.borderRadius = '50%';
    bubble.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.15)';
    bubble.style.cursor = 'pointer';
    bubble.style.display = 'flex';
    bubble.style.justifyContent = 'center';
    bubble.style.alignItems = 'center';
    bubble.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    bubble.style.transform = 'scale(1)';
    
    // Add modern chat icon
    bubble.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.5013 2.97074 16.7765 4.57153 18.4282L2.5 21.5L5.82843 19.5C7.47945 21.0645 9.61961 22 12 22Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    
    if (settings.animation) {
      bubble.style.animation = 'chatbase-pulse 2s infinite';
    }
    
    bubble.addEventListener('mouseenter', () => {
      bubble.style.transform = 'scale(1.1)';
    });
    
    bubble.addEventListener('mouseleave', () => {
      bubble.style.transform = 'scale(1)';
    });
    
    // Create chat window with modern styling
    const chatWindow = document.createElement('div');
    chatWindow.id = 'chatbase-window';
    chatWindow.style.display = 'none';
    chatWindow.style.flexDirection = 'column';
    chatWindow.style.position = 'absolute';
    chatWindow.style.bottom = '80px';
    chatWindow.style.right = settings.position.includes('right') ? '0' : 'auto';
    chatWindow.style.left = settings.position.includes('left') ? '0' : 'auto';
    chatWindow.style.width = settings.width;
    chatWindow.style.height = settings.height;
    chatWindow.style.backgroundColor = settings.darkMode ? '#1A202C' : '#FFFFFF';
    chatWindow.style.borderRadius = settings.borderRadius;
    chatWindow.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.12)';
    chatWindow.style.overflow = 'hidden';
    chatWindow.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    chatWindow.style.opacity = '0';
    chatWindow.style.transform = 'translateY(10px)';
    
    // Create modern chat header
    const chatHeader = document.createElement('div');
    chatHeader.style.backgroundColor = settings.primaryColor;
    chatHeader.style.color = '#fff';
    chatHeader.style.padding = '16px';
    chatHeader.style.fontWeight = '600';
    chatHeader.style.fontSize = '16px';
    chatHeader.style.display = 'flex';
    chatHeader.style.justifyContent = 'space-between';
    chatHeader.style.alignItems = 'center';
    chatHeader.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
    
    // Create agent info with avatar in header
    const agentInfo = document.createElement('div');
    agentInfo.style.display = 'flex';
    agentInfo.style.alignItems = 'center';
    agentInfo.style.gap = '10px';
    
    const agentAvatar = document.createElement('div');
    agentAvatar.style.width = '32px';
    agentAvatar.style.height = '32px';
    agentAvatar.style.borderRadius = '50%';
    agentAvatar.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    agentAvatar.style.display = 'flex';
    agentAvatar.style.justifyContent = 'center';
    agentAvatar.style.alignItems = 'center';
    agentAvatar.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 11C20 13.3869 19.0518 15.6761 17.364 17.364C15.6761 19.0518 13.3869 20 11 20C8.61305 20 6.32387 19.0518 4.63604 17.364C2.94821 15.6761 2 13.3869 2 11C2 8.61305 2.94821 6.32387 4.63604 4.63604C6.32387 2.94821 8.61305 2 11 2C13.3869 2 15.6761 2.94821 17.364 4.63604C19.0518 6.32387 20 8.61305 20 11Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 11H20" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M11 2C13.5013 3.95029 15 7.41297 15 11C15 14.587 13.5013 18.0497 11 20C8.49872 18.0497 7 14.587 7 11C7 7.41297 8.49872 3.95029 11 2Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    
    const agentName = document.createElement('div');
    agentName.textContent = 'Chatbase AI Agent';
    
    agentInfo.appendChild(agentAvatar);
    agentInfo.appendChild(agentName);
    
    // Modern close button
    const closeButton = document.createElement('button');
    closeButton.id = 'chatbase-close';
    closeButton.style.background = 'transparent';
    closeButton.style.border = 'none';
    closeButton.style.color = 'white';
    closeButton.style.cursor = 'pointer';
    closeButton.style.padding = '0';
    closeButton.style.display = 'flex';
    closeButton.style.alignItems = 'center';
    closeButton.style.justifyContent = 'center';
    closeButton.style.width = '32px';
    closeButton.style.height = '32px';
    closeButton.style.borderRadius = '50%';
    closeButton.style.transition = 'background-color 0.2s ease';
    closeButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 6L6 18" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M6 6L18 18" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    });
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.backgroundColor = 'transparent';
    });
    
    chatHeader.appendChild(agentInfo);
    chatHeader.appendChild(closeButton);
    
    // Create chat body with modern styling
    const chatBody = document.createElement('div');
    chatBody.id = 'chatbase-body';
    chatBody.style.flex = '1';
    chatBody.style.overflowY = 'auto';
    chatBody.style.padding = '16px';
    chatBody.style.backgroundColor = settings.darkMode ? '#1A202C' : '#F8FAFC';
    chatBody.style.display = 'flex';
    chatBody.style.flexDirection = 'column';
    
    // Add custom scrollbar styling
    chatBody.style.scrollbarWidth = 'thin';
    chatBody.style.scrollbarColor = settings.darkMode ? '#4A5568 #2D3748' : '#CBD5E0 #EDF2F7';
    
    // Add welcome message with custom styling
    const welcomeMsg = document.createElement('div');
    welcomeMsg.className = 'chatbase-message bot';
    welcomeMsg.innerHTML = settings.welcomeMessage;
    chatBody.appendChild(welcomeMsg);
    
    // Add timestamp to welcome message
    const timestamp = document.createElement('div');
    timestamp.className = 'chatbase-timestamp';
    timestamp.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    welcomeMsg.appendChild(timestamp);
    
    // Add suggested questions as quick replies
    const quickReplies = document.createElement('div');
    quickReplies.className = 'chatbase-quick-replies';
    
    const suggestedQuestions = [
      'What can you help me with?',
      'Tell me more about your services',
      'How does this work?'
    ];
    
    suggestedQuestions.forEach(question => {
      const quickReply = document.createElement('button');
      quickReply.className = 'chatbase-quick-reply';
      quickReply.textContent = question;
      quickReply.addEventListener('click', () => {
        // Simulate clicking the question
        appendUserMessage(question);
        sendMessage(question);
        
        // Remove quick replies after selection
        quickReplies.style.display = 'none';
      });
      quickReplies.appendChild(quickReply);
    });
    
    chatBody.appendChild(quickReplies);
    
    // Create modern chat footer
    const chatFooter = document.createElement('div');
    chatFooter.style.padding = '16px';
    chatFooter.style.borderTop = settings.darkMode ? '1px solid #2D3748' : '1px solid #E2E8F0';
    chatFooter.style.display = 'flex';
    chatFooter.style.alignItems = 'center';
    chatFooter.style.backgroundColor = settings.darkMode ? '#1A202C' : '#FFFFFF';
    
    // Modern input field
    const chatInputContainer = document.createElement('div');
    chatInputContainer.style.display = 'flex';
    chatInputContainer.style.flex = '1';
    chatInputContainer.style.position = 'relative';
    chatInputContainer.style.backgroundColor = settings.darkMode ? '#2D3748' : '#F1F5F9';
    chatInputContainer.style.borderRadius = '24px';
    chatInputContainer.style.overflow = 'hidden';
    
    const chatInput = document.createElement('input');
    chatInput.id = 'chatbase-input';
    chatInput.type = 'text';
    chatInput.placeholder = 'Type your message...';
    chatInput.style.flex = '1';
    chatInput.style.padding = '12px 16px';
    chatInput.style.border = 'none';
    chatInput.style.outline = 'none';
    chatInput.style.backgroundColor = 'transparent';
    chatInput.style.fontSize = '15px';
    chatInput.style.color = settings.darkMode ? '#E2E8F0' : '#1A202C';
    
    chatInputContainer.appendChild(chatInput);
    
    // Modern send button
    const chatSend = document.createElement('button');
    chatSend.id = 'chatbase-send';
    chatSend.style.width = '42px';
    chatSend.style.height = '42px';
    chatSend.style.backgroundColor = settings.primaryColor;
    chatSend.style.color = '#fff';
    chatSend.style.border = 'none';
    chatSend.style.borderRadius = '50%';
    chatSend.style.marginLeft = '10px';
    chatSend.style.cursor = 'pointer';
    chatSend.style.display = 'flex';
    chatSend.style.justifyContent = 'center';
    chatSend.style.alignItems = 'center';
    chatSend.style.transition = 'transform 0.2s ease';
    chatSend.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22 2L11 13" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    
    chatSend.addEventListener('mouseenter', () => {
      chatSend.style.transform = 'scale(1.05)';
    });
    
    chatSend.addEventListener('mouseleave', () => {
      chatSend.style.transform = 'scale(1)';
    });
    
    chatFooter.appendChild(chatInputContainer);
    chatFooter.appendChild(chatSend);
    
    // Create modern branding if enabled
    if (settings.showBranding) {
      const branding = document.createElement('div');
      branding.style.textAlign = 'center';
      branding.style.padding = '8px';
      branding.style.fontSize = '12px';
      branding.style.color = settings.darkMode ? '#A0AEC0' : '#A0AEC0';
      branding.style.backgroundColor = settings.darkMode ? '#171923' : '#F8FAFC';
      branding.style.borderTop = settings.darkMode ? '1px solid #2D3748' : '1px solid #E2E8F0';
      branding.innerHTML = 'Powered by <a href="https://your-domain.com" style="color:#718096;text-decoration:none;font-weight:600;" target="_blank">Your Company</a>';
      chatWindow.appendChild(branding);
    }
    
    // Assemble chat window
    chatWindow.appendChild(chatHeader);
    chatWindow.appendChild(chatBody);
    chatWindow.appendChild(chatFooter);
    
    // Add everything to container
    container.appendChild(bubble);
    container.appendChild(chatWindow);
    
    // Add container to body
    document.body.appendChild(container);
    
    // Return elements for event binding
    return {
      container,
      bubble,
      chatWindow,
      chatBody,
      chatInput,
      chatSend,
      closeButton,
      quickReplies
    };
  };
  
  // Handle chat functionality with improved UX
  const initChat = () => {
    let conversationId = null;
    let messagesQueue = [];
    let isProcessing = false;
    
    const elements = createChatElements();
    
    // Enhanced toggle animation
    const toggleChat = () => {
      const isVisible = elements.chatWindow.style.display === 'flex';
      
      if (isVisible) {
        elements.chatWindow.style.opacity = '0';
        elements.chatWindow.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
          elements.chatWindow.style.display = 'none';
        }, 300);
      } else {
        elements.chatWindow.style.display = 'flex';
        
        // Force a reflow to ensure the transition happens
        void elements.chatWindow.offsetWidth;
        
        elements.chatWindow.style.opacity = '1';
        elements.chatWindow.style.transform = 'translateY(0)';
        elements.chatInput.focus();
        
        // If opening chat for first time, create conversation
        if (!conversationId) {
          createConversation();
        }
      }
    };
    
    // Function to create a new conversation
    const createConversation = async () => {
      try {
        const response = await fetch(`${apiEndpoint}/conversations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: 'Website Chat',
            agentConfig: agentId
          })
        });
        
        const data = await response.json();
        if (data.success) {
          conversationId = data.data._id;
        } else {
          console.error('Error creating conversation:', data);
          appendErrorMessage();
        }
      } catch (error) {
        console.error('Error creating conversation:', error);
        appendErrorMessage();
      }
    };
    
    // Function to show typing indicator
    const showTypingIndicator = () => {
      const typingIndicator = document.createElement('div');
      typingIndicator.className = 'chatbase-typing-indicator';
      typingIndicator.innerHTML = `
        <span></span>
        <span></span>
        <span></span>
      `;
      
      elements.chatBody.appendChild(typingIndicator);
      elements.chatBody.scrollTop = elements.chatBody.scrollHeight;
      
      return typingIndicator;
    };
    
    // Function to send message to API with improved UX
    const sendMessage = async (message) => {
      if (!conversationId) {
        messagesQueue.push(message);
        await createConversation();
        return;
      }
      
      if (isProcessing) {
        messagesQueue.push(message);
        return;
      }
      
      isProcessing = true;
      
      // Show typing indicator
      const typingIndicator = showTypingIndicator();
      
      try {
        const response = await fetch(`${apiEndpoint}/conversations/${conversationId}/agent-messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: message
          })
        });
        
        // Remove typing indicator
        typingIndicator.remove();
        
        const data = await response.json();
        if (data.success) {
          appendBotMessage(data.data.content);
        } else {
          console.error('Error sending message:', data);
          appendErrorMessage();
        }
      } catch (error) {
        // Remove typing indicator
        typingIndicator.remove();
        
        console.error('Error sending message:', error);
        appendErrorMessage();
      }
      
      isProcessing = false;
      
      // Process queue if there are pending messages
      if (messagesQueue.length > 0) {
        const nextMessage = messagesQueue.shift();
        sendMessage(nextMessage);
      }
    };
    
    // Function to append user message to chat
    const appendUserMessage = (message) => {
      const msgElement = document.createElement('div');
      msgElement.className = 'chatbase-message user';
      msgElement.textContent = message;
      
      // Add timestamp
      const timestamp = document.createElement('div');
      timestamp.className = 'chatbase-timestamp';
      timestamp.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      msgElement.appendChild(timestamp);
      
      elements.chatBody.appendChild(msgElement);
      elements.chatBody.scrollTop = elements.chatBody.scrollHeight;
      
      // Hide quick replies after user sends a message
      if (elements.quickReplies) {
        elements.quickReplies.style.display = 'none';
      }
    };
    
    // Function to append bot message to chat
    const appendBotMessage = (message) => {
      const msgElement = document.createElement('div');
      msgElement.className = 'chatbase-message bot';
      
      // Process message content (handle markdown, links, etc.)
      const processedMessage = message
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color:' + 
          (settings.darkMode ? '#90CDF4' : '#3182CE') + 
          ';text-decoration:none;">$1</a>');
      
      msgElement.innerHTML = processedMessage;
      
      // Add timestamp
      const timestamp = document.createElement('div');
      timestamp.className = 'chatbase-timestamp';
      timestamp.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      msgElement.appendChild(timestamp);
      
      elements.chatBody.appendChild(msgElement);
      elements.chatBody.scrollTop = elements.chatBody.scrollHeight;
    };
    
    // Function to append error message
    const appendErrorMessage = () => {
      const errorMsg = 'Sorry, there was an error processing your request. Please try again later.';
      appendBotMessage(errorMsg);
    };
    
    // Event listener for bubble click
    elements.bubble.addEventListener('click', toggleChat);
    
    // Event listener for close button
    elements.closeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleChat();
    });
    
    // Event listener for send button
    elements.chatSend.addEventListener('click', () => {
      const message = elements.chatInput.value.trim();
      if (message) {
        appendUserMessage(message);
        sendMessage(message);
        elements.chatInput.value = '';
      }
    });
    
    // Event listener for Enter key
    elements.chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const message = elements.chatInput.value.trim();
        if (message) {
          appendUserMessage(message);
          sendMessage(message);
          elements.chatInput.value = '';
        }
      }
    });
    
    // Auto-open chat if configured
    if (settings.autoOpen) {
      setTimeout(() => {
        toggleChat();
      }, 1000);
    }
    
    // Add mobile responsiveness
    const handleResize = () => {
      if (window.innerWidth < 500) {
        elements.chatWindow.style.width = '100vw';
        elements.chatWindow.style.height = '100vh';
        elements.chatWindow.style.bottom = '0';
        elements.chatWindow.style.right = '0';
        elements.chatWindow.style.borderRadius = '0';
      } else {
        elements.chatWindow.style.width = settings.width;
        elements.chatWindow.style.height = settings.height;
        elements.chatWindow.style.borderRadius = settings.borderRadius;
        
        // Reset position
        elements.chatWindow.style.bottom = '80px';
        if (settings.position.includes('right')) {
          elements.chatWindow.style.right = '0';
          elements.chatWindow.style.left = 'auto';
        } else {
          elements.chatWindow.style.left = '0';
          elements.chatWindow.style.right = 'auto';
        }
      }
    };
    
    // Add resize event listener
    window.addEventListener('resize', handleResize);
    handleResize();
  };
  
  // Initialize when DOM is fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChat);
  } else {
    initChat();
  }
})(); 