const elevenLabs = require('./elevenLabsService');
const cache = require('memory-cache');

class ElevenLabsAgentService {
  constructor() {
    this.basePath = '/agents';
    this.cacheTime = 5 * 60 * 1000; // 5 minutes
  }

  // Create a new agent
  async createAgent(data) {
    return await elevenLabs.post(this.basePath, data);
  }

  // Get all agents
  async getAgents() {
    const cacheKey = 'elevenlabs_agents';
    const cachedAgents = cache.get(cacheKey);
    
    if (cachedAgents) return cachedAgents;
    
    const agents = await elevenLabs.get(this.basePath);
    cache.put(cacheKey, agents, this.cacheTime);
    
    return agents;
  }

  // Get agent by ID
  async getAgent(agentId) {
    const cacheKey = `elevenlabs_agent_${agentId}`;
    const cachedAgent = cache.get(cacheKey);
    
    if (cachedAgent) return cachedAgent;
    
    const agent = await elevenLabs.get(`${this.basePath}/${agentId}`);
    cache.put(cacheKey, agent, this.cacheTime);
    
    return agent;
  }

  // Update agent
  async updateAgent(agentId, data) {
    const response = await elevenLabs.post(`${this.basePath}/${agentId}`, data);
    // Clear cache
    cache.del(`elevenlabs_agent_${agentId}`);
    cache.del('elevenlabs_agents');
    
    return response;
  }

  // Delete agent
  async deleteAgent(agentId) {
    const response = await elevenLabs.delete(`${this.basePath}/${agentId}`);
    // Clear cache
    cache.del(`elevenlabs_agent_${agentId}`);
    cache.del('elevenlabs_agents');
    
    return response;
  }

  // Get agent LLM configuration options (models, etc.)
  async getAgentLLMOptions() {
    const cacheKey = 'elevenlabs_agent_llm_options';
    const cachedOptions = cache.get(cacheKey);
    
    if (cachedOptions) return cachedOptions;
    
    const options = await elevenLabs.get(`${this.basePath}/llm-options`);
    cache.put(cacheKey, options, this.cacheTime);
    
    return options;
  }
}

module.exports = new ElevenLabsAgentService(); 