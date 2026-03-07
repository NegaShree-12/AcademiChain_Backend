import QRCode from "qrcode";

export const generateQRCode = async (data) => {
  try {
    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(data, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 300,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });

    return qrCodeDataUrl;
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw new Error("Failed to generate QR code");
  }
};

export const generateQRCodeBuffer = async (data) => {
  try {
    // Generate QR code as buffer
    const qrCodeBuffer = await QRCode.toBuffer(data, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 300,
      type: "png",
    });

    return qrCodeBuffer;
  } catch (error) {
    console.error("Error generating QR code buffer:", error);
    throw new Error("Failed to generate QR code");
  }
};