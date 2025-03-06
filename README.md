# AI Document Processor Backend

This is an AI-driven backend application for processing documents, providing conversational AI, and handling voice interactions.

## Features

- Document upload and processing (PDF, images, text files)
- Text extraction from various document formats
- Conversational AI powered by OpenAI GPT-4
- Voice interactions via Twilio
- Text-to-speech capabilities using Google Cloud

## Prerequisites

- Node.js (v14+)
- MongoDB
- Google Cloud account (for Text-to-Speech)
- OpenAI API key
- Twilio account

## Installation

1. Clone the repository
```
git clone <repository-url>
cd ai-document-processor
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file with the following variables:
```
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/ai-document-processor
OPENAI_API_KEY=your_openai_api_key
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
GOOGLE_APPLICATION_CREDENTIALS=path_to_your_google_credentials.json
FILE_UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880
```

4. Start the application
```bash
npm start
```

## Docker Deployment

1. Build and start the containers
```bash
docker-compose up -d
```

2. The API will be available at `http://localhost:3000`

## API Endpoints

### Documents
- `POST /api/documents/upload` - Upload a document
- `GET /api/documents` - Get all documents
- `GET /api/documents/:id` - Get a document by ID
- `DELETE /api/documents/:id` - Delete a document

### Conversations
- `POST /api/conversations` - Create a new conversation
- `GET /api/conversations` - Get all conversations
- `GET /api/conversations/:id` - Get a conversation by ID
- `POST /api/conversations/:id/messages` - Send a message in a conversation
- `DELETE /api/conversations/:id` - Delete a conversation

### Voice
- `POST /api/voice/incoming` - Handle incoming voice calls
- `POST /api/voice/respond` - Respond to voice calls
- `POST /api/voice/transcribe` - Process voice transcriptions

## License

[MIT](LICENSE)