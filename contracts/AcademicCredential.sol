// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AcademicCredential {

    address public admin;

    struct Credential {
        string studentName;
        string degree;
        string institution;
        uint256 issueDate;
    }

    mapping(address => Credential[]) private credentials;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function issueCredential(
        address student,
        string memory studentName,
        string memory degree,
        string memory institution
    ) public onlyAdmin {

        credentials[student].push(
            Credential({
                studentName: studentName,
                degree: degree,
                institution: institution,
                issueDate: block.timestamp
            })
        );
    }

    function getCredentials(address student)
        public
        view
        returns (Credential[] memory)
    {
        return credentials[student];
    }
}
