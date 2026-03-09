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

    let verification;
    let credential;

    // Check if it's a transaction hash (starts with 0x and is 66 chars long)
    if (hash.startsWith('0x') && hash.length === 66) {
      console.log('📝 Verifying as transaction hash');
      
      // Verify on blockchain using the singleton instance
      verification = await realBlockchainService.verifyCredential(hash);
      
      // Find credential in database by transaction hash
      credential = await Credential.findOne({ blockchainTxHash: hash });
      
      console.log('📦 Database credential found:', credential ? 'Yes' : 'No');
      
    } else {
      // Try as credential ID
      console.log('📝 Verifying as credential ID');
      verification = await realBlockchainService.verifyCredentialById(hash);
      credential = await Credential.findOne({ credentialId: hash });
    }

    console.log('🔍 Verification result:', verification);

    // Check verification result
    if (!verification || !verification.isValid) {
      return res.status(200).json({
        success: true,
        isValid: false,
        message: verification?.error || 'Credential not found on blockchain',
        hash
      });
    }

    // If credential found in database, return full details
    if (credential) {
      console.log('✅ Credential found in database:', credential._id);
      
      // Check if revoked
      if (credential.isRevoked) {
        return res.status(200).json({
          success: true,
          isValid: false,
          message: 'This credential has been revoked',
          credential: {
            title: credential.title,
            studentName: credential.studentName,
            institutionName: credential.institutionName,
            issueDate: credential.issueDate,
            credentialType: credential.credentialType,
            description: credential.description
          },
          verification: {
            blockchainTxHash: credential.blockchainTxHash,
            blockNumber: verification.blockNumber,
            confirmations: verification.confirmations,
            timestamp: verification.timestamp
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
          description: credential.description
        },
        verification: {
          blockchainTxHash: credential.blockchainTxHash,
          blockNumber: verification.blockNumber,
          confirmations: verification.confirmations,
          timestamp: verification.timestamp
        }
      });
    }

    // If mock mode and verification has credential data
    if (verification.credential) {
      return res.status(200).json({
        success: true,
        isValid: true,
        message: '✅ Credential verified (mock data)',
        credential: verification.credential,
        verification: {
          blockchainTxHash: hash,
          blockNumber: verification.blockNumber,
          confirmations: verification.confirmations,
          timestamp: verification.timestamp,
          mock: true
        }
      });
    }

    // Transaction verified but no credential in database
    return res.status(200).json({
      success: true,
      isValid: true,
      message: 'Transaction found on blockchain but credential not in database',
      verification: {
        blockchainTxHash: hash,
        blockNumber: verification.blockNumber,
        confirmations: verification.confirmations,
        timestamp: verification.timestamp,
        from: verification.from,
        to: verification.to
      },
      hash
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
    
    // Find share link
    const shareLink = await ShareLink.findOne({ shareId, isActive: true });
    
    if (!shareLink) {
      return res.status(200).json({
        success: true,
        isValid: false,
        message: 'Invalid or expired share link'
      });
    }
    
    // Check if expired
    if (shareLink.expiresAt < new Date()) {
      shareLink.isActive = false;
      await shareLink.save();
      return res.status(200).json({
        success: true,
        isValid: false,
        message: 'Share link has expired'
      });
    }
    
    // Check max accesses
    if (shareLink.maxAccess && shareLink.accessCount >= shareLink.maxAccess) {
      shareLink.isActive = false;
      await shareLink.save();
      return res.status(200).json({
        success: true,
        isValid: false,
        message: 'Maximum number of accesses reached'
      });
    }
    
    // Get credential
    const credential = await Credential.findOne({ 
      credentialId: shareLink.credentialId 
    });
    
    if (!credential) {
      return res.status(200).json({
        success: true,
        isValid: false,
        message: 'Credential not found'
      });
    }
    
    if (credential.isRevoked) {
      return res.status(200).json({
        success: true,
        isValid: false,
        message: 'This credential has been revoked'
      });
    }
    
    // Verify on blockchain
    const verification = await realBlockchainService.verifyCredential(
      credential.blockchainTxHash
    );
    
    // Update access count
    shareLink.accessCount += 1;
    await shareLink.save();
    
    res.status(200).json({
      success: true,
      isValid: verification.isValid,
      message: verification.isValid ? '✅ Credential verified' : '❌ Verification failed',
      credential: {
        title: credential.title,
        studentName: credential.studentName,
        institutionName: credential.institutionName,
        issueDate: credential.issueDate,
        credentialType: credential.credentialType,
        description: credential.description
      },
      verification: {
        blockchainTxHash: credential.blockchainTxHash,
        blockNumber: verification.blockNumber,
        confirmations: verification.confirmations,
        timestamp: verification.timestamp
      },
      shareInfo: {
        shareId: shareLink.shareId,
        sharedBy: shareLink.studentName,
        sharedAt: shareLink.createdAt,
        accessNumber: shareLink.accessCount,
        expiresAt: shareLink.expiresAt
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

// Verify by document upload (for future implementation)
export const verifyByDocument = async (req, res) => {
  try {
    // This would handle file upload and verification
    // For now, return mock response
    res.status(200).json({
      success: true,
      isValid: true,
      message: 'Document verification coming soon',
      mock: true
    });
  } catch (error) {
    console.error('❌ Document verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify document'
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
    }).select('title description institutionName issueDate credentialType studentName');
    
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
        credentialType: credential.credentialType
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