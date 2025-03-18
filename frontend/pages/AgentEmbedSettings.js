import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const AgentEmbedSettings = () => {
  const { agentId } = useParams();
  const [agent, setAgent] = useState(null);
  const [settings, setSettings] = useState({
    primaryColor: '#0084ff',
    position: 'bottom-right',
    welcomeMessage: 'Hi! Ask me anything!',
    bubbleIcon: 'default',
    showBranding: true,
    autoOpen: false,
    width: '380px',
    height: '500px'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAgent = async () => {
      try {
        const res = await axios.get(`/api/agents/${agentId}`);
        setAgent(res.data.data);
        // Load saved embed settings if they exist
        if (res.data.data.embedSettings) {
          setSettings(res.data.data.embedSettings);
        }
        setLoading(false);
      } catch (err) {
        console.error('Error fetching agent:', err);
        setLoading(false);
      }
    };

    fetchAgent();
  }, [agentId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings({
      ...settings,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const saveSettings = async () => {
    try {
      await axios.put(`/api/agents/${agentId}/embed-settings`, { embedSettings: settings });
      alert('Embed settings saved successfully!');
    } catch (err) {
      console.error('Error saving embed settings:', err);
      alert('Failed to save embed settings');
    }
  };

  const generateEmbedCode = () => {
    return `<script>
  window.chatbaseConfig = {
    agentId: "${agentId}",
    apiEndpoint: "${window.location.origin}/api",
    settings: ${JSON.stringify(settings)}
  }
</script>
<script 
  src="${window.location.origin}/embed.js" 
  async>
</script>`;
  };

  if (loading) return <div>Loading...</div>;
  if (!agent) return <div>Agent not found</div>;

  return (
    <div className="embed-settings-container">
      <h1>Embed Settings for {agent.name}</h1>
      
      <div className="settings-form">
        <div className="form-group">
          <label>Primary Color</label>
          <input
            type="color"
            name="primaryColor"
            value={settings.primaryColor}
            onChange={handleChange}
          />
        </div>
        
        <div className="form-group">
          <label>Position</label>
          <select name="position" value={settings.position} onChange={handleChange}>
            <option value="bottom-right">Bottom Right</option>
            <option value="bottom-left">Bottom Left</option>
            <option value="top-right">Top Right</option>
            <option value="top-left">Top Left</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Welcome Message</label>
          <input
            type="text"
            name="welcomeMessage"
            value={settings.welcomeMessage}
            onChange={handleChange}
          />
        </div>
        
        <div className="form-group">
          <label>Show Branding</label>
          <input
            type="checkbox"
            name="showBranding"
            checked={settings.showBranding}
            onChange={handleChange}
          />
        </div>
        
        <div className="form-group">
          <label>Auto-open Chat</label>
          <input
            type="checkbox"
            name="autoOpen"
            checked={settings.autoOpen}
            onChange={handleChange}
          />
        </div>
        
        <div className="form-group">
          <label>Chat Width</label>
          <input
            type="text"
            name="width"
            value={settings.width}
            onChange={handleChange}
          />
        </div>
        
        <div className="form-group">
          <label>Chat Height</label>
          <input
            type="text"
            name="height"
            value={settings.height}
            onChange={handleChange}
          />
        </div>
        
        <button className="save-button" onClick={saveSettings}>
          Save Settings
        </button>
      </div>
      
      <div className="embed-code-section">
        <h2>Embed Code</h2>
        <p>Copy and paste this code just before the closing &lt;/body&gt; tag on your website:</p>
        <pre className="code-block">
          {generateEmbedCode()}
        </pre>
        <button 
          className="copy-button" 
          onClick={() => {
            navigator.clipboard.writeText(generateEmbedCode());
            alert('Embed code copied to clipboard!');
          }}
        >
          Copy to Clipboard
        </button>
      </div>
      
      <div className="preview-section">
        <h2>Preview</h2>
        <div className="chat-preview" style={{ position: 'relative', height: '400px', border: '1px solid #ddd' }}>
          {/* Simple preview of how the chat will look */}
          <div className="chat-bubble" style={{ 
            position: 'absolute', 
            bottom: settings.position.includes('bottom') ? '20px' : 'auto',
            top: settings.position.includes('top') ? '20px' : 'auto',
            right: settings.position.includes('right') ? '20px' : 'auto',
            left: settings.position.includes('left') ? '20px' : 'auto',
            backgroundColor: settings.primaryColor,
            width: '60px',
            height: '60px',
            borderRadius: '50%'
          }}></div>
        </div>
      </div>
    </div>
  );
};

export default AgentEmbedSettings; 