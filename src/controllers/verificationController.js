// backend/src/controllers/verificationController.js

import { realBlockchainService } from '../services/realBlockchainService.js';
import Credential from '../models/Credential.js';
import ShareLink from '../models/ShareLink.js';

// Verify by transaction hash or credential ID
export const verifyByHash = async (req, res) => {
  try {
    const { hash } = req.params;
    
    console.log(`🔍 Verifying hash: ${hash}`);
    
    if (!hash) {
      return res.status(400).json({
        success: false,
        message: 'Hash is required'
      });
    }

    // FIRST check if credential exists in database
    let credential = await Credential.findOne({ 
      $or: [
        { blockchainTxHash: hash },
        { credentialId: hash }
      ]
    });

    // If credential not found in database, it's invalid
    if (!credential) {
      return res.status(200).json({
        success: true,
        isValid: false,
        message: '❌ Credential not found in our system',
        hash
      });
    }

    // Check if revoked
    if (credential.isRevoked) {
      return res.status(200).json({
        success: true,
        isValid: false,
        message: '❌ This credential has been revoked',
        credential: {
          title: credential.title,
          studentName: credential.studentName,
          institutionName: credential.institutionName,
          issueDate: credential.issueDate,
          credentialType: credential.credentialType,
        }
      });
    }

    // Verify on blockchain
    let verification = { isValid: true };
    try {
      verification = await realBlockchainService.verifyCredential(credential.blockchainTxHash);
    } catch (blockchainError) {
      console.warn('⚠️ Blockchain verification failed, using database record:', blockchainError.message);
    }

    // Check if blockchain verification failed
    if (verification && verification.isValid === false) {
      return res.status(200).json({
        success: true,
        isValid: false,
        message: '❌ Blockchain verification failed',
        credential: {
          title: credential.title,
          studentName: credential.studentName,
          institutionName: credential.institutionName,
        }
      });
    }

    // Success - credential verified
    return res.status(200).json({
      success: true,
      isValid: true,
      message: '✅ Credential verified successfully',
      credential: {
        title: credential.title,
        studentName: credential.studentName,
        institutionName: credential.institutionName,
        issueDate: credential.issueDate,
        credentialType: credential.credentialType,
        description: credential.description,
        metadata: credential.metadata,
        grade: credential.metadata?.grade,
        gpa: credential.metadata?.gpa,
        credits: credential.metadata?.credits,
        program: credential.metadata?.program,
        major: credential.metadata?.major
      },
      verification: {
        blockchainTxHash: credential.blockchainTxHash,
        blockNumber: verification.blockNumber,
        confirmations: verification.confirmations,
        timestamp: verification.timestamp,
        network: 'sepolia',
        mock: verification.mock || false
      }
    });
    
  } catch (error) {
    console.error('❌ Verification error:', error);
    res.status(500).json({
      success: false,
      isValid: false,
      message: 'Verification failed',
      error: error.message
    });
  }
};

// Verify by share ID
export const verifyByShareId = async (req, res) => {
  try {
    const { shareId } = req.params;
    
    console.log(`🔍 Verifying share ID: ${shareId}`);
    
    // Find the share link
    const shareLink = await ShareLink.findOne({ shareId, isActive: true });
    
    if (!shareLink) {
      return res.status(200).json({
        success: true,
        isValid: false,
        message: '❌ Invalid or expired share link'
      });
    }
    
    console.log(`📌 Share link found for credential: ${shareLink.credentialId}`);
    
    // Find the SPECIFIC credential using the stored credentialId
    const credential = await Credential.findOne({ 
      credentialId: shareLink.credentialId 
    });
    
    if (!credential) {
      return res.status(200).json({
        success: true,
        isValid: false,
        message: '❌ Credential not found'
      });
    }
    
    console.log(`✅ Found credential: ${credential.title} for student: ${credential.studentName}`);
    
    // Return the SPECIFIC credential details
    return res.status(200).json({
      success: true,
      isValid: true,
      message: '✅ Credential verified successfully',
      credential: {
        title: credential.title,
        studentName: credential.studentName,
        institutionName: credential.institutionName,
        issueDate: credential.issueDate,
        credentialType: credential.credentialType,
        description: credential.description,
        metadata: credential.metadata
      },
      verification: {
        blockchainTxHash: credential.blockchainTxHash,
        method: 'share-link',
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Share verification error:', error);
    res.status(500).json({
      success: false,
      isValid: false,
      message: 'Verification failed',
      error: error.message
    });
  }
};

// Get blockchain status
export const getBlockchainStatus = async (req, res) => {
  try {
    const status = await realBlockchainService.getNetworkInfo();
    
    res.status(200).json({
      success: true,
      data: {
        ...status,
        network: status.name || 'sepolia',
        contractAddress: process.env.CONTRACT_ADDRESS,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get blockchain status',
      error: error.message
    });
  }
};

// Verify by document upload
// backend/src/controllers/verificationController.js

// Verify by document upload
export const verifyByDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    console.log("📄 Document received:", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    let extractedHash = null;
    let credential = null;

    // Handle different file types
    if (req.file.mimetype === 'application/json') {
      // Parse JSON files
      try {
        const jsonContent = JSON.parse(req.file.buffer.toString());
        extractedHash = jsonContent.credential?.blockchainTxHash || 
                       jsonContent.transactionHash || 
                       jsonContent.hash ||
                       jsonContent.credential?.txHash;
        
        if (extractedHash) {
          // Verify the extracted hash
          const verification = await realBlockchainService.verifyCredential(extractedHash);
          
          if (verification.isValid && verification.credential) {
            return res.status(200).json({
              success: true,
              isValid: true,
              message: '✅ Credential verified from JSON',
              credential: verification.credential,
              verification: {
                blockchainTxHash: extractedHash,
                blockNumber: verification.blockNumber,
                confirmations: verification.confirmations,
                timestamp: verification.timestamp,
                network: 'sepolia'
              }
            });
          }
        }
      } catch (jsonError) {
        console.error("Error parsing JSON:", jsonError);
      }
    } 
    else if (req.file.mimetype.startsWith('image/')) {
      // For image files, we need to extract from filename or metadata
      // For now, check if filename contains a transaction hash pattern
      const hashMatch = req.file.originalname.match(/[0-9a-fA-F]{64}/g);
      if (hashMatch) {
        extractedHash = `0x${hashMatch[0]}`;
        const verification = await realBlockchainService.verifyCredential(extractedHash);
        
        if (verification.isValid && verification.credential) {
          return res.status(200).json({
            success: true,
            isValid: true,
            message: '✅ Credential verified from image filename',
            credential: verification.credential,
            verification: {
              blockchainTxHash: extractedHash,
              blockNumber: verification.blockNumber,
              confirmations: verification.confirmations,
              timestamp: verification.timestamp,
              network: 'sepolia'
            }
          });
        }
      }
      
      return res.status(200).json({
        success: true,
        isValid: false,
        message: 'No valid credential hash found in image. Please use the QR code scanner for images with QR codes.',
      });
    }
    else if (req.file.mimetype === 'application/pdf') {
      // For PDFs, you'd need to extract text
      return res.status(200).json({
        success: true,
        isValid: false,
        message: 'PDF verification coming soon. Please use transaction hash or share link for now.',
      });
    }

    // If we get here, no valid hash was found
    return res.status(200).json({
      success: true,
      isValid: false,
      message: 'No valid credential hash found in document. Please upload a JSON file with a transaction hash or use the hash verification method.',
    });

  } catch (error) {
    console.error('❌ Document verification error:', error);
    res.status(500).json({
      success: false,
      isValid: false,
      message: 'Failed to verify document',
      error: error.message
    });
  }
};
// Get credential preview
export const getCredentialPreview = async (req, res) => {
  try {
    const { credentialId } = req.params;
    
    const credential = await Credential.findOne({ 
      credentialId,
      isRevoked: false 
    }).select('title description institutionName issueDate credentialType studentName metadata');
    
    if (!credential) {
      return res.status(404).json({
        success: false,
        message: 'Credential not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        title: credential.title,
        description: credential.description,
        studentName: credential.studentName,
        institutionName: credential.institutionName,
        issueDate: credential.issueDate,
        credentialType: credential.credentialType,
        metadata: credential.metadata
      }
    });
    
  } catch (error) {
    console.error('❌ Preview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get credential preview'
    });
  }
};