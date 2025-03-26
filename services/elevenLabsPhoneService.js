const elevenLabs = require('./elevenLabsService');

class ElevenLabsPhoneService {
  constructor() {
    this.basePath = '/phone-numbers';
  }

  // Get available phone numbers
  async getAvailablePhoneNumbers(countryCode = 'US', areaCode = null) {
    return await elevenLabs.get(`${this.basePath}/available`, {
      country_code: countryCode,
      area_code: areaCode
    });
  }

  // Get all phone numbers for account
  async getPhoneNumbers() {
    return await elevenLabs.get(this.basePath);
  }

  // Get phone number by ID
  async getPhoneNumber(phoneNumberId) {
    return await elevenLabs.get(`${this.basePath}/${phoneNumberId}`);
  }

  // Add phone number (purchase/provision)
  async addPhoneNumber(phoneNumber, agentId, callOptions = {}) {
    return await elevenLabs.post(this.basePath, {
      phone_number: phoneNumber,
      agent_id: agentId,
      ...callOptions
    });
  }

  // Update phone configuration
  async updatePhoneNumber(phoneNumberId, agentId, callOptions = {}) {
    return await elevenLabs.post(`${this.basePath}/${phoneNumberId}`, {
      agent_id: agentId,
      ...callOptions
    });
  }

  // Remove phone number
  async removePhoneNumber(phoneNumberId) {
    return await elevenLabs.delete(`${this.basePath}/${phoneNumberId}`);
  }

  // Initiate an outbound call
  async initiateCall(phoneNumberId, to, agentId = null) {
    return await elevenLabs.post(`${this.basePath}/${phoneNumberId}/call`, {
      to,
      agent_id: agentId
    });
  }

  // Get call logs
  async getCallLogs(phoneNumberId, page = 1, pageSize = 10) {
    return await elevenLabs.get(`${this.basePath}/${phoneNumberId}/calls`, {
      page,
      page_size: pageSize
    });
  }

  // Get call details
  async getCallDetails(phoneNumberId, callId) {
    return await elevenLabs.get(`${this.basePath}/${phoneNumberId}/calls/${callId}`);
  }
}

module.exports = new ElevenLabsPhoneService(); 