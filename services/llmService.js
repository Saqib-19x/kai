const generateResponse = async (callSid, transcript, conversation, knowledgeBaseIds) => {
  // Retrieve relevant context from knowledge base
  const relevantContext = await retrieveContext(knowledgeBaseIds, transcript);
  
  // Start generating response
  const llmResponse = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [
      ...conversation.messages,
      {
        role: 'user',
        content: transcript
      }
    ],
    stream: true, // Enable streaming for faster first tokens
    temperature: 0.7,
    max_tokens: 150, // Keep responses concise for voice
    top_p: 1
  });
  
  // Handle streaming response
  return processStreamingResponse(callSid, llmResponse);
}; 