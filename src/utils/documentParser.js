// backend/src/utils/documentParser.js

import QRCode from 'qrcode';
import { JSDOM } from 'jsdom';
import pdf from 'pdf-parse';

export const extractHashFromDocument = async (fileBuffer, mimetype) => {
  try {
    if (mimetype.startsWith('image/')) {
      // For images, we would need a QR code reader
      // This would require additional libraries
      return null;
    } else if (mimetype === 'application/pdf') {
      // Extract text from PDF
      const data = await pdf(fileBuffer);
      const text = data.text;
      
      // Look for transaction hash pattern (0x followed by 64 hex chars)
      const hashRegex = /0x[a-fA-F0-9]{64}/g;
      const matches = text.match(hashRegex);
      
      return matches ? matches[0] : null;
    } else if (mimetype === 'application/json') {
      const jsonData = JSON.parse(fileBuffer.toString());
      return jsonData.blockchainTxHash || 
             jsonData.transactionHash || 
             jsonData.hash || 
             null;
    }
    
    return null;
  } catch (error) {
    console.error("Error extracting hash from document:", error);
    return null;
  }
};