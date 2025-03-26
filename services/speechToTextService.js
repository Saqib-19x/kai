const initializeSTTStream = async (callSid) => {
  // For best results, use one of:
  // 1. Deepgram (lowest latency)
  // 2. Azure Speech (good balance)
  // 3. AssemblyAI (high accuracy)
  
  const stream = createSTTStream(callSid);
  
  // Set up event handlers for real-time transcription
  stream.on('transcription', handleTranscription);
  
  return stream;
};

const handleTranscription = async (callSid, transcript, isFinal) => {
  // Process partial transcripts for early processing
  if (!isFinal) {
    // Send to early processing queue
    startEarlyProcessing(callSid, transcript);
  } else {
    // Process final transcript
    await processCompletedUtterance(callSid, transcript);
  }
}; 