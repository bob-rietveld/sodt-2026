import { Pinecone } from '@pinecone-database/pinecone';

async function checkAssistant() {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) {
    console.log('PINECONE_API_KEY not set');
    return;
  }
  
  const pc = new Pinecone({ apiKey });
  
  try {
    const assistant = pc.Assistant('sodt-2026');
    console.log('Assistant object created');
    
    const files = await assistant.listFiles();
    console.log('Files in assistant:', JSON.stringify(files, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
}

checkAssistant();
