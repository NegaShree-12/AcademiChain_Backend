// backend/src/utils/qrCode.js
import QRCode from 'qrcode';

export const generateQRCode = async (text) => {
  try {
    console.log("📱 Generating QR code for:", text.substring(0, 50) + "...");
    
    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 300,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    
    console.log("✅ QR Code generated successfully. Length:", qrCodeDataUrl.length);
    console.log("📊 Preview:", qrCodeDataUrl.substring(0, 100) + "...");
    
    return qrCodeDataUrl;
  } catch (error) {
    console.error('❌ Error generating QR code:', error);
    return null;
  }
};