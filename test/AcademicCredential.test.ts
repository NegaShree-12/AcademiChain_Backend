import { expect } from "chai";
import { ethers } from "hardhat";
import { AcademicCredential } from "../typechain-types";

describe("AcademicCredential", function () {
  let academicCredential: AcademicCredential;
  let owner: any;
  let issuer: any;
  let student: any;
  let verifier: any;

  beforeEach(async function () {
    [owner, issuer, student, verifier] = await ethers.getSigners();
    
    const AcademicCredentialFactory = await ethers.getContractFactory("AcademicCredential");
    academicCredential = await AcademicCredentialFactory.deploy();
    
    await academicCredential.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right admin", async function () {
      expect(await academicCredential.admin()).to.equal(owner.address);
    });

    it("Should have the correct name", async function () {
      expect(await academicCredential.name()).to.equal("AcademicCredential");
    });
  });

  describe("Credential Management", function () {
    const testIPFSHash = "QmTestHash1234567890";
    let credentialHash: string;

    beforeEach(async function () {
      // Issue a credential for testing
      const tx = await academicCredential.connect(issuer).issueCredential(
        student.address,
        testIPFSHash
      );
      
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => 
        log.fragment?.name === "CredentialIssued"
      );
      
      credentialHash = event?.args?.[0];
    });

    it("Should issue a credential", async function () {
      expect(credentialHash).to.exist;
      
      const credential = await academicCredential.getCredential(credentialHash);
      expect(credential.issuer).to.equal(issuer.address);
      expect(credential.student).to.equal(student.address);
      expect(credential.ipfsHash).to.equal(testIPFSHash);
      expect(credential.isValid).to.be.true;
      expect(credential.isRevoked).to.be.false;
    });

    it("Should verify a valid credential", async function () {
      const isValid = await academicCredential.verifyCredential(credentialHash);
      expect(isValid).to.be.true;
    });

    it("Should get student credentials", async function () {
      const studentCreds = await academicCredential.getStudentCredentials(student.address);
      expect(studentCreds).to.include(credentialHash);
    });

    it("Should get issuer credentials", async function () {
      const issuerCreds = await academicCredential.getIssuerCredentials(issuer.address);
      expect(issuerCreds).to.include(credentialHash);
    });

    it("Should revoke a credential", async function () {
      await academicCredential.connect(issuer).revokeCredential(credentialHash);
      
      const credential = await academicCredential.getCredential(credentialHash);
      expect(credential.isRevoked).to.be.true;
      expect(credential.isValid).to.be.false;
    });

    it("Should reinstate a revoked credential", async function () {
      await academicCredential.connect(issuer).revokeCredential(credentialHash);
      await academicCredential.connect(issuer).reinstateCredential(credentialHash);
      
      const credential = await academicCredential.getCredential(credentialHash);
      expect(credential.isRevoked).to.be.false;
      expect(credential.isValid).to.be.true;
    });

    it("Should calculate credential hash", async function () {
      const calculatedHash = await academicCredential.calculateCredentialHash(
        issuer.address,
        student.address,
        testIPFSHash,
        await ethers.provider.getBlock("latest").then(block => block!.timestamp)
      );
      
      expect(calculatedHash).to.exist;
    });
  });

  describe("Admin Functions", function () {
    it("Should change admin", async function () {
      await academicCredential.connect(owner).changeAdmin(verifier.address);
      expect(await academicCredential.admin()).to.equal(verifier.address);
    });

    it("Should prevent non-admin from changing admin", async function () {
      await expect(
        academicCredential.connect(issuer).changeAdmin(verifier.address)
      ).to.be.revertedWith("Only admin can perform this action");
    });
  });
});