// test-api-fixed.js
import axios from 'axios';
import { ethers } from 'ethers';

const testAPI = async () => {
  try {
    // Use a real wallet address from your system
    const walletAddress = '0xca0199d4bf3975aa8a13d7740d073430f24fe646';
    
    // Create a proper signature (in a real scenario, this would come from MetaMask)
    // For testing, we'll use a simple message
    const message = `Login to AcademiChain at ${Date.now()}`;
    
    // Since we can't sign without private key, we'll use the actual login flow
    // First, check if the user exists
    console.log('🔍 Testing institution students endpoint...');
    
    // Get token from localStorage or use an existing token
    // For testing, let's try to get students directly with a valid token
    // You'll need to replace this with an actual token from your frontend
    const token = 'YOUR_ACTUAL_TOKEN_HERE'; // Get this from your browser's localStorage
    
    if (token === 'YOUR_ACTUAL_TOKEN_HERE') {
      console.log('⚠️ Please replace with an actual token from your browser');
      console.log('1. Open your app in Chrome');
      console.log('2. Open Dev Tools (F12)');
      console.log('3. Go to Application → Local Storage');
      console.log('4. Copy the "token" value');
      console.log('5. Paste it in this file');
      return;
    }
    
    const response = await axios.get('http://localhost:3001/api/institution/students', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ API Response:', response.data);
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.log('\n🔑 Authentication failed. Here\'s how to get a valid token:');
      console.log('1. Open your app in Chrome');
      console.log('2. Log in with your wallet');
      console.log('3. Open Dev Tools (F12) → Application → Local Storage');
      console.log('4. Copy the "token" value');
      console.log('5. Update the token in this file');
    }
  }
};

testAPI();