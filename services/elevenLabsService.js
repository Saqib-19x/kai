const axios = require('axios');
const FormData = require('form-data');
const axiosRetry = require('axios-retry').default;

class ElevenLabsService {
  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY;
    this.baseUrl = 'https://api.elevenlabs.io';
    
    // Log configuration (temporary for debugging)
    console.log('ElevenLabs Service Configuration:', {
      baseUrl: this.baseUrl,
      apiKeyPresent: !!this.apiKey,
      apiKeyFirstChars: this.apiKey?.substring(0, 3)
    });

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      headers: {
        'xi-api-key': this.apiKey
      }
    });

    // Configure retry logic
    if (axiosRetry) {
      axiosRetry(this.client, { 
        retries: 3,
        retryDelay: (retryCount) => {
          return retryCount * 1000; // Time interval between retries in milliseconds
        },
        retryCondition: (error) => {
          return (
            error.code === 'ECONNRESET' ||
            error.code === 'ETIMEDOUT' ||
            (error.response && error.response.status >= 500)
          );
        }
      });
    }

    // Add response interceptor for better error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        console.error('ElevenLabs API Error:', {
          status: error.response?.status,
          data: error.response?.data,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            headers: {
              ...error.config?.headers,
              'xi-api-key': '***hidden***'
            }
          }
        });
        throw error;
      }
    );
  }

  // General request methods
  async get(endpoint, params = {}) {
    try {
      const response = await this.client.get(endpoint, { params });
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  async post(endpoint, data = {}) {
    try {
      const response = await this.client.post(endpoint, data);
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  async delete(endpoint) {
    try {
      const response = await this.client.delete(endpoint);
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  async postFormData(endpoint, formData) {
    try {
      console.log('Making request to:', `${this.baseUrl}${endpoint}`);
      
      const response = await this.client.post(endpoint, formData, {
        headers: {
          ...formData.getHeaders(),
          'Content-Length': formData.getLengthSync()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 60000,
        decompress: true,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log(`Upload Progress: ${percentCompleted}%`);
        }
      });

      return response.data;
    } catch (error) {
      console.error('Request failed:', {
        endpoint,
        status: error.response?.status,
        data: error.response?.data,
        code: error.code,
        message: error.message
      });
      throw error;
    }
  }

  _handleError(error) {
    const errorMessage = error.response?.data?.detail || error.message;
    throw new Error(errorMessage);
  }
}

module.exports = new ElevenLabsService(); 