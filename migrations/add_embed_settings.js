const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

// Connect to DB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const AgentConfig = require('../models/AgentConfig');

const migrate = async () => {
  try {
    const agents = await AgentConfig.find({ embedSettings: { $exists: false } });
    
    console.log(`Found ${agents.length} agents without embed settings`);
    
    for (const agent of agents) {
      agent.embedSettings = {
        primaryColor: '#0084ff',
        position: 'bottom-right',
        welcomeMessage: 'Hi! Ask me anything!',
        bubbleIcon: 'default',
        showBranding: true,
        autoOpen: false,
        width: '380px',
        height: '500px'
      };
      
      await agent.save();
      console.log(`Updated agent: ${agent.name}`);
    }
    
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error during migration:', err);
    process.exit(1);
  }
};

migrate(); 