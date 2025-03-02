---
Logo:
Date: February 21, 2025
---

# Privacy Pools circuits audit report

## Executive Summary

### Executive Summary
This document presents the express curcuits security audit conducted by Oxorio for Privacy Pools curcuits.
Privacy Pool is a blockchain protocol that enables private asset transfers. Users can deposit funds publicly and partially withdraw them privately, provided they can prove membership in an approved set of addresses.

The audit process involved a comprehensive approach, including manual code review, automated analysis, and extensive testing and simulations of the curcuits to assess the project’s security and functionality. The audit covered a total of 3 curcuits, encompassing 117 lines of code. For an in-depth explanation of used the smart contract security audit methodology, please refer to the [Security Assessment Methodology](#security-assessment-methodology) section of this document.

Throughout the audit, a collaborative approach was maintained with Privacy Pools team to address all concerns identified within the audit’s scope. Each issue has been either resolved or formally acknowledged by Privacy Pools team, contributing to the robustness of the project.

As a result, following a comprehensive review, our auditors have verified that the Privacy Pools, as of audited commit 8da36d5e2150ab3c567d85ca8a6b2eb6b51740cb, has met the security and functionality requirements established for this audit, based on the code and documentation provided, and operates as intended within the defined scope.

### Summary of findings
The table below provides a comprehensive summary of the audit findings, categorizing each by status and severity level. For a detailed description of the severity levels and statuses of findings, see the [Findings Classification Reference](#findings-classification-reference) section.

Detailed technical information on the audit findings, along with our recommendations for addressing them, is provided in the [Findings Report](#findings-report) section for further reference.

All identified issues have been addressed, with Privacy Pools fixing them or formally acknowledging their status.

[FINDINGS]

## Audit Overview

[TOC]

### Disclaimer
At the request of the client, Oxorio consents to the public release of this audit report. The information contained herein is provided "as is" without any representations or warranties of any kind. Oxorio disclaims all liability for any damages arising from or related to the use of this audit report. Oxorio retains copyright over the contents of this report.

This report is based on the scope of materials and documentation provided to Oxorio for the security audit as detailed in the Executive Summary and Audited Files sections. The findings presented in this report may not encompass all potential vulnerabilities. Oxorio delivers this report and its findings on an as-is basis, and any reliance on this report is undertaken at the user’s sole risk. It is important to recognize that blockchain technology remains in a developmental stage and is subject to inherent risks and flaws.

This audit does not extend beyond the programming language of smart contracts to include areas such as the compiler layer or other components that may introduce security risks. Consequently, this report should not be interpreted as an endorsement of any project or team, nor does it guarantee the security of the project under review.

THE CONTENT OF THIS REPORT, INCLUDING ITS ACCESS AND/OR USE, AS WELL AS ANY ASSOCIATED SERVICES OR MATERIALS, MUST NOT BE CONSIDERED OR RELIED UPON AS FINANCIAL, INVESTMENT, TAX, LEGAL, REGULATORY, OR OTHER PROFESSIONAL ADVICE. Third parties should not rely on this report for making any decisions, including the purchase or sale of any product, service, or asset. Oxorio expressly disclaims any liability related to the report, its contents, and any associated services, including, but not limited to, implied warranties of merchantability, fitness for a particular purpose, and non-infringement. Oxorio does not warrant, endorse, or take responsibility for any product or service referenced or linked within this report.

For any decisions related to financial, legal, regulatory, or other professional advice, users are strongly encouraged to consult with qualified professionals.

### Project Brief

| Title | Description |
| --- | --- |
| Client | Privacy Pools |
| Project name | Privacy Pools Circuits |
| Category | privacy, zero knowledge |
| Repository | [github.com/0xbow-io/privacy-pools-core](https://github.com/0xbow-io/privacy-pools-core) |
| Documentation | [README.md](https://github.com/0xbow-io/privacy-pools-core/tree/56d5d48c21e9493954e2660d0cc252ce537edc2/packages/circuits/README.md) |
| Initial commit | [`56d5d48c21e9493954e2660d0cc252ce537edc25`](https://github.com/0xbow-io/privacy-pools-core/commit/56d5d48c21e9493954e2660d0cc252ce537edc25) |
| Final commit | [`8da36d5e2150ab3c567d85ca8a6b2eb6b51740cb`](https://github.com/0xbow-io/privacy-pools-core/commit/8da36d5e2150ab3c567d85ca8a6b2eb6b51740cb) |
| Languages | Circom 2 |
| Lead Auditor | Alexander Mazaletskiy - [am@oxor.io](emailto:am@oxor.io) |
| Project Manager | Aleksandra Rudik - [arudik@oxor.io](mailto:arudik@oxor.io) |

### Project Timeline
The key events and milestones of the project are outlined below.

| Date | Event |
| --- | --- |
| January 24, 2025 | Client approached Oxorio requesting an audit. |
| January 31, 2025 | The audit team commenced work on the project. |
| February 12, 2025 | Submission of the comprehensive report. |
| February 18, 2025 | Client feedback on the report was received. |
| February 21, 2025 | Submission of the final report incorporating client’s verified fixes. |

### Audited Files

The following table contains a list of the audited files. The [scc](https://github.com/boyter/scc) tool was used to count the number of lines and assess complexity of the files.

|  | File | Lines | Blanks | Comments | Code | Complexity |
| - | - | - | - | - | - | - |
| 1 | [packages/circuits/circuits/commitment.circom](https://github.com/0xbow-io/privacy-pools-core/blob/56d5d48c21e9493954e2660d0cc252ce537edc25/packages/circuits/circuits/commitment.circom) | 43 | 10 | 10 | 23 | 0% |
| 2 | [packages/circuits/circuits/merkleTree.circom](https://github.com/0xbow-io/privacy-pools-core/blob/56d5d48c21e9493954e2660d0cc252ce537edc25/packages/circuits/circuits/merkleTree.circom) | 75 | 17 | 24 | 34 | 1% |
| 3 | [packages/circuits/circuits/withdraw.circom](https://github.com/0xbow-io/privacy-pools-core/blob/56d5d48c21e9493954e2660d0cc252ce537edc25/packages/circuits/circuits/withdraw.circom) | 108 | 25 | 23 | 60 | 0% |
| | **Total** | 226 | 52 | 57 | 117 | 1% |

**Lines:** The total number of lines in each file. This provides a quick overview of the file size and its contents.

**Blanks:** The count of blank lines in the file.

**Comments:** This column shows the number of lines that are comments.

**Code:** The count of lines that actually contain executable code. This metric is essential for understanding how much of the file is dedicated to operational elements rather than comments or whitespace.

**Complexity**: This column shows the file complexity per line of code. It is calculated by dividing the file's total complexity (an approximation of [cyclomatic complexity](https://en.wikipedia.org/wiki/Cyclomatic_complexity) that estimates logical depth and decision points like loops and conditional branches) by the number of executable lines of code. A higher value suggests greater complexity per line, indicating areas with concentrated logic.

### Project Overview
Privacy Pool is a blockchain protocol that enables private asset transfers. Users can deposit funds publicly and partially withdraw them privately, provided they can prove membership in an approved set of addresses.
The protocol implements three main circuits that work together:

#### Withdrawal Circuit

The withdrawal circuit verifies that a user can privately withdraw funds from the protocol. It takes as input:

- The withdrawal amount and details
- The unique related commitments identifier (label)
- A state root and ASP (Association Set Provider) root
- A proof of inclusion in the state tree
- A proof of inclusion in the ASP tree
- Nullifier and commitment secrets

The circuit ensures the withdrawal is valid by verifying:

- The user knows the preimage of the commitment
- The commitment exists in the state tree
- The comimtment label is included in the ASP tree
- The withdrawal amount is valid and matches the commitment

#### LeanIMT Circuit

The LeanIMT (Lean Incremental Merkle Tree) circuit handles merkle tree operations. It implements an optimized merkle tree that:

- Supports dynamic depth
- Optimizes node computations by propagating single child values
- Verifies inclusion proofs efficiently

#### Commitment Circuit

The commitment circuit manages the hashing and verification of commitments. It:

- Computes commitment hashes from input values and secrets
- Generates nullifier hashes for preventing double-spending
- Creates precommitment hashes for privacy preservation


### Findings Breakdown by File
This table provides an overview of the findings across the audited files, categorized by severity level. It serves as a useful tool for identifying areas that may require attention, helping to prioritize remediation efforts, and provides a clear summary of the audit results.

[FINDINGS_SCOPE]

### Conclusion
A comprehensive audit was conducted on three circuits, revealing no critical or major issues. However, several warnings and informational notes were identified. The audit highlighted important vulnerabilities, including unused input signals and missing consistency checks for critical input parameters. Particularly, significant findings were observed in code optimization, verification mechanisms, and ensuring compatibility between deposited and withdrawn values in privacy-related proof systems.

Following our initial audit, Privacy Pools worked closely with our team to address the identified issues. The proposed changes aim to enhance the security and reliability of the project by introducing stronger constraints to verify input signals, addressing redundancy in circuit components, and implementing system checks to prevent unforeseen edge cases. Key recommendations include removing unused input and output signals, preventing nullifier and secret collisions, and adding deposit constraints to maintain compatibility. These changes are designed to reinforce the integrity of the contracts, improve computational efficiency, and align with industry best practices.

As a result, the project has passed our audit. Our auditors have verified that the Privacy Pools Circuits, as of audited commit 8da36d5e2150ab3c567d85ca8a6b2eb6b51740cb, operates as intended within the defined scope, based on the information and code provided at the time of evaluation. The robustness of the codebase has been significantly improved, meeting the necessary security and functionality requirements established for this audit.

## Findings Report

### CRITICAL

No critical issues found.

### MAJOR

No major issues found.

### WARNING

#### [FIXED] Unused input signals in `withdraw.circom`, `merkletree.circom`
##### Location
File | Location | Line
--- | --- | ---
[merkletree.circom](https://github.com/0xbow-io/privacy-pools-core/tree/56d5d48c21e9493954e2660d0cc252ce537edc25/packages/circuits/circuits/merkleTree.circom#L25-L26) | template `LeanIMTInclusionProof` | 25-26
[withdraw.circom](https://github.com/0xbow-io/privacy-pools-core/tree/56d5d48c21e9493954e2660d0cc252ce537edc25/packages/circuits/circuits/withdraw.circom#L21-L2) | template `Withdraw` | 21-23

##### Description
In the `Withdraw` template, the `StateTreeDepth` and `ASPTreeDepth` signals are defined as:
```circom
  signal input stateTreeDepth;                   // Current state tree depth
  // ...
  signal input ASPTreeDepth;                     // Current ASP tree depth
```
These serve as input signals for the `merkletree` circuit.

In the `LeanIMTInclusionProof` template, `actualDepth` is defined as:
```circom
  signal input actualDepth;        // Current tree depth (unused as |siblings| <= actualDepth)
  _ <== actualDepth;               // Silence unused signal warning
```
This leads to a situation where identical valid proofs can be generated for different sets of `stateTreeDepth` and `ASPTreeDepth` values, violating the fundamental zero knowledge proof property of `soundness`, as these values are not actually verified.

##### Recommendation
We recommend either removing unused signals or adding constraints for these signals. For example, this could be implemented as:
```circom
signal actualDepthSquare;
actualDepthSquare <== actualDepth * actualDepth;
```

##### Update
Fixed at [`8da36d5e2150ab3c567d85ca8a6b2eb6b51740cb`](https://github.com/0xbow-io/privacy-pools-core/commit/8da36d5e2150ab3c567d85ca8a6b2eb6b51740cb)

#### [ACKNOWLEDGED] Potential inclusion proof manipulation in `merkleTree.circom`
##### Location
File | Location | Line
--- | --- | ---
[merkleTree.circom](https://github.com/0xbow-io/privacy-pools-core/tree/56d5d48c21e9493954e2660d0cc252ce537edc25/packages/circuits/circuits/merkleTree.circom#L25-L26) | - | 25-26

##### Description
In the `merkleTree` circuit, the `actualDepth` signal is provided as input:
```circom
  signal input actualDepth;        // Current tree depth (unused as |siblings| <= actualDepth)
  _ <== actualDepth;               // Silence unused signal warning
```
However, `actualDepth` is not utilized in the circuit's inclusion proof verification logic. This potentially allows proving the inclusion of a non-existing leaf. One possible attack scenario arises if the leaf stores the result of a Poseidon(2) hash:
- Consider a use case where the contract logic assumes that the leaf stores a user-provided value, such as in Tornado Cash Classic, where the leaf is defined as `commitment = hash(nullifier, secret)`.
- During a deposit, the user provides a `commitment`, which is expected to be `hash(nullifier, secret)`. However, an attacker can submit a different value instead. To exploit this, the attacker submits the Merkle root of a tree that is constructed using `poseidon(2)`, where its leaves store multiple fake deposits with different nullifiers and secrets.
- Since the actual depth of the tree is not verified within the `merkleTree` circuit, the Merkle path to the fake deposits remains valid. During withdrawal, the attacker can prove inclusion for one of the fake deposits within the tree root and withdraw funds, effectively stealing all assets stored in the contract.

![image](https://i.ibb.co/bRDwWPnz/image-3.png)

This exact attack is not possible in the Privacy Pools project because it uses `Poseidon(3)` for hashing leaves instead of `Poseidon(2)`.

Additionally, the current LeanIMT implementation allows multiple valid inclusion proofs for the same leaf by manipulating the actual tree height. For example, in the case of the highlighted leaf in the diagram, both of the following proofs would be valid:
- `index = 2, actualDepth = 2, siblings = [leaf-4, node-1]`
- `index = 4, actualDepth = 3, siblings = [0, leaf-4, node-1]`

![image](https://i.ibb.co/v4V6HsN5/image-4.png)

Given these security concerns, the current implementation of LeanIMT is not considered safe and is not recommended for use in its present form.

##### Recommendation
We recommend refactoring the LeanIMT circuit to ensure that the actual depth of the tree is explicitly enforced in the proof verification logic.

##### Update

###### Oxorio Response
This issue was originally marked as major, but after further reflection, we realized it does not apply to this specific system.

#### [FIXED] Possibility of `nullifier` and `secret` collision in `withdraw.circom`
##### Location
File | Location | Line
--- | --- | ---
[withdraw.circom](https://github.com/0xbow-io/privacy-pools-core/tree/56d5d48c21e9493954e2660d0cc252ce537edc25/packages/circuits/circuits/withdraw.circom#L36) | template `Withdraw` | 36
[withdraw.circom](https://github.com/0xbow-io/privacy-pools-core/tree/56d5d48c21e9493954e2660d0cc252ce537edc25/packages/circuits/circuits/withdraw.circom#L37) | template `Withdraw` | 37

##### Description
In the `Withdraw` template, the `newNullifier` and `newSecret` signals are defined as:
```circom
  signal input newNullifier;                     // Nullifier for the new commitment
  signal input newSecret;                        // Secret for the new commitment
```
These values are used to create a new commitment. However, if the `newNullifier` and `newSecret` are the same as `existingNullifier` and `existingSecret`, it will result in creating an output commitment that uses the `nullifier` and `secret` from the `existingCommitment`.

It's worth noting that the documentation states:
```
The circuit ensures the withdrawal is valid by verifying:
- The nullifier has not been previously used
```
##### Recommendation
We recommend adding a mechanism to verify that `newNullifier` and `newSecret` have not been previously used.

##### Update
Fixed at [`8da36d5e2150ab3c567d85ca8a6b2eb6b51740cb`](https://github.com/0xbow-io/privacy-pools-core/commit/8da36d5e2150ab3c567d85ca8a6b2eb6b51740cb)

#### [FIXED] Lack of check for `existingValue` in `withdraw.circom`
##### Location
File | Location | Line
--- | --- | ---
[withdraw.circom](https://github.com/0xbow-io/privacy-pools-core/tree/56d5d48c21e9493954e2660d0cc252ce537edc25/packages/circuits/circuits/withdraw.circom#L86) | template `Withdraw`  | 86

##### Description
In the `Withdraw` template, the `existingValue` signal is used to verify the validity of the withdrawn amount:
```circom
  // 5. Check the withdrawn amount is valid
  signal remainingValue <== existingValue - withdrawnValue;
  component remainingValueRangeCheck = Num2Bits(128);
  remainingValueRangeCheck.in <== remainingValue;
  _ <== remainingValueRangeCheck.out;
  component withdrawnValueRangeCheck = Num2Bits(128);
  withdrawnValueRangeCheck.in <== withdrawnValue;
  _ <== withdrawnValueRangeCheck.out;
```
However, there is no check ensuring that `existingValue` is less than `2**128`. If `existingValue` exceeds or equals `2**130`, the funds cannot be withdrawn privately because both `remainingValue` and `withdrawnValue` are limited to `2**128`. This could lead to a scenario where deposited funds become permanently locked and inaccessible.

##### Recommendation
We recommend adding a check that deposit amount is less than `2**128`.

##### Update
Fixed at [`8da36d5e2150ab3c567d85ca8a6b2eb6b51740cb`](https://github.com/0xbow-io/privacy-pools-core/commit/8da36d5e2150ab3c567d85ca8a6b2eb6b51740cb)

#### [ACKNOWLEDGED] Uninitialized `main` component in `withdraw.circom`
##### Location
File | Location | Line
--- | --- | ---
[withdraw.circom](https://github.com/0xbow-io/privacy-pools-core/tree/56d5d48c21e9493954e2660d0cc252ce537edc25/packages/circuits/circuits/withdraw.circom) | template `Withdraw`  | -

##### Description
In the `Withdraw` template, the main component implementation is missing. According to the [circom documentation](https://docs.circom.io/circom-language/the-main-component/):
```
In order to start the execution, an initial component has to be given. By default, the name of this component is "main", and hence the component main needs to be instantiated with some template.
```
##### Recommendation
We recommend adding the main component to the `withdraw` circuit and specifying public signals.

##### Update

###### Privacy Pools Response
We handle main component instantiation with circomkit.

### INFO

#### [FIXED] Unused output signal in `commitment.circom`
##### Location
File | Location | Line
--- | --- | ---
[commitment.circom](https://github.com/0xbow-io/privacy-pools-core/tree/56d5d48c21e9493954e2660d0cc252ce537edc25/packages/circuits/circuits/commitment.circom#L41) | template `CommitmentHasher` | 41

##### Description
In the `CommitmentHasher` template, the `precommitmentHash` output signal is defined:
```circom
  signal output precommitmentHash; // Precommitment hash
  // ...
  commitmentHasher.inputs[2] <== precommitmentHasher.out;
  // ...
  precommitmentHash <== precommitmentHasher.out;
```
However, this output signal is not used in any external calling circuits. Additionally, the output of the `precommitmentHasher` component is already utilized as an input for the `commitmentHasher` component, making it redundant to artificially create a constraint for the `precommitmentHasher` component output.

##### Recommendation
We recommend removing the `precommitmentHash` output signal from the `commitment` template to improve circuit efficiency and readability.

##### Update
Fixed at [`8da36d5e2150ab3c567d85ca8a6b2eb6b51740cb`](https://github.com/0xbow-io/privacy-pools-core/commit/8da36d5e2150ab3c567d85ca8a6b2eb6b51740cb)

#### [FIXED] Unused commented signal in `merkleTree.circom`
##### Location
File | Location | Line
--- | --- | ---
[merkleTree.circom](https://github.com/0xbow-io/privacy-pools-core/tree/56d5d48c21e9493954e2660d0cc252ce537edc25/packages/circuits/circuits/merkleTree.circom#L33) | template `LeanIMTInclusionProof` | 33

##### Description
In the `LeanIMTInclusionProof` template, there is a commented-out `intermediateRoots` signal:
```circom
  signal nodes[maxDepth + 1];      // Array to store computed node values at each level
  // signal intermediateRoots[maxDepth + 1]; // Array to store intermediate root values
  signal indices[maxDepth];        // Array to store path indices for each level
```
This signal is not utilized anywhere in the circuit, making it redundant and potentially confusing for future development or auditing.

##### Recommendation
We recommend removing the commented `intermediateRoots` signal to improve code readability and maintain a cleaner codebase.

##### Update
Fixed at [`8da36d5e2150ab3c567d85ca8a6b2eb6b51740cb`](https://github.com/0xbow-io/privacy-pools-core/commit/8da36d5e2150ab3c567d85ca8a6b2eb6b51740cb)

#### [NO ISSUE] Missing check for non-zero `withdrawnValue` in `withdraw.circom`
##### Location
File | Location | Line
--- | --- | ---
[withdraw.circom](https://github.com/0xbow-io/privacy-pools-core/tree/56d5d48c21e9493954e2660d0cc252ce537edc25/packages/circuits/circuits/withdraw.circom#L17) | template `Withdraw`  | 17

##### Description
In the `LeanIMTInclusionProof` template lacks a constraint check to ensure that `withdrawnValue` is not zero. This means that a zero value for `withdrawnValue` would be considered valid.

##### Recommendation
We recommend adding a separate constraint to verify that `withdrawnValue` is not zero.

##### Update

###### Privacy Pools Response
This is intended to allow users to rotate the secrets for a commitment without withdrawing any value.

#### [ACKNOWLEDGED] Value checks after calculations in `withdraw.circom`
##### Location
File | Location | Line
--- | --- | ---
[withdraw.circom](https://github.com/0xbow-io/privacy-pools-core/tree/56d5d48c21e9493954e2660d0cc252ce537edc25/packages/circuits/circuits/withdraw.circom#L86) | template `Withdraw`  | 86

##### Description
In the `LeanIMTInclusionProof` template, checks are performed after calculations:
```circom
  signal remainingValue <== existingValue - withdrawnValue;
  component remainingValueRangeCheck = Num2Bits(128);
  remainingValueRangeCheck.in <== remainingValue;
  _ <== remainingValueRangeCheck.out;
  component withdrawnValueRangeCheck = Num2Bits(128);
  withdrawnValueRangeCheck.in <== withdrawnValue;
  _ <== withdrawnValueRangeCheck.out;
```
It would be more clear and readable to perform checks on `withdrawnValue` and `existingValue` before the calculations.

##### Recommendation
We recommend performing validation checks before calculations.

#### [ACKNOWLEDGED] Use of anonymous components in `withdraw.circom`
##### Location
File | Location | Line
--- | --- | ---
[withdraw.circom](https://github.com/0xbow-io/privacy-pools-core/tree/56d5d48c21e9493954e2660d0cc252ce537edc25/packages/circuits/circuits/withdraw.circom) | template `Withdraw`  | -

##### Description
In the `LeanIMTInclusionProof` template, constructions like:
```circom
newCommitmentHash <== newCommitmentHasher.commitment;
//_ <== newCommitmentHasher.precommitmentHash;
//_ <== newCommitmentHasher.nullifierHash;
```
can be replaced with [anonymous components](https://docs.circom.io/circom-language/anonymous-components-and-tuples/):
```circom
(newCommitmentHash, _, _) <== CommitmentHasher()(remainingValue, label, newNullifier, newSecret);
```
This makes the code more understandable and readable.

##### Recommendation
We recommend using anonymous components for improved code clarity.

## Appendix

### Security Assessment Methodology

Oxorio's smart contract security audit methodology is designed to ensure the security, reliability, and compliance of curcuits throughout their development lifecycle. Our process integrates the Smart Contract Security Verification Standard (SCSVS) with our advanced techniques to address complex security challenges. For a detailed look at our approach, please refer to the [full version of our methodology](https://docsend.com/view/yjpj6jggbqjpc5sa). Here is a concise overview of our auditing process:

**1. Project Architecture Review**

All necessary information about the smart contract is gathered, including its intended functionality and dependencies. This stage sets the foundation by reviewing documentation, business logic, and initial code analysis.

**2. Vulnerability Assessment**

This phase involves a deep dive into the smart contract's code to identify security vulnerabilities. Rigorous testing and review processes are applied to ensure robustness against potential attacks.

This stage is focused on identifying specific vulnerabilities within the smart contract code. It involves scanning and testing the code for known security weaknesses and patterns that could potentially be exploited by malicious actors.

**3. Security Model Evaluation**

The smart contract’s architecture is assessed to ensure it aligns with security best practices and does not introduce potential vulnerabilities. This includes reviewing how the contract integrates with external systems, its compliance with security best practices, and whether the overall design supports a secure operational environment.

This phase involves a analysis of the project's documentation, the consistency of business logic as documented versus implemented in the code, and any assumptions made during the design and development phases. It assesses if the contract's architectural design adequately addresses potential threats and integrates necessary security controls.

**4. Cross-Verification by Multiple Auditors**

Typically, the project is assessed by multiple auditors to ensure a diverse range of insights and thorough coverage. Findings from individual auditors are cross-checked to verify accuracy and completeness.

**5. Report Consolidation**

Findings from all auditors are consolidated into a single, comprehensive express audit. This report outlines potential vulnerabilities, areas for improvement, and an overall assessment of the smart contract’s security posture.

**6. Reaudit of Revised Submissions**

Post-review modifications made by the client are reassessed to ensure that all previously identified issues have been adequately addressed. This stage helps validate the effectiveness of the fixes applied.

**7. Final express audit Publication**

The final version of the express audit is delivered to the client and published on Oxorio's official website. This report includes detailed findings, recommendations for improvement, and an executive summary of the smart contract’s security status.

### Findings Classification Reference

#### Severity Level Reference
The following severity levels were assigned to the issues described in the report:

| Title | Description |
| --- | --- |
| <span severity="CRITICAL">CRITICAL</span> | Issues that pose immediate and significant risks, potentially leading to asset theft, inaccessible funds, unauthorized transactions, or other substantial financial losses. These vulnerabilities represent serious flaws that could be exploited to compromise or control the entire contract. They require immediate attention and remediation to secure the system and prevent further exploitation. |
| <span severity="MAJOR">MAJOR</span> | Issues that could cause a significant failure in the contract's functionality, potentially necessitating manual intervention to modify or replace the contract. These vulnerabilities may result in data corruption, malfunctioning logic, or prolonged downtime, requiring substantial operational changes to restore normal performance. While these issues do not immediately lead to financial losses, they compromise the reliability and security of the contract, demanding prioritized attention and remediation. |
| <span severity="WARNING">WARNING</span> | Issues that might disrupt the contract's intended logic, affecting its correct functioning or making it vulnerable to Denial of Service (DDoS) attacks. These problems may result in the unintended triggering of conditions, edge cases, or interactions that could degrade the user experience or impede specific operations. While they do not pose immediate critical risks, they could impact contract reliability and require attention to prevent future vulnerabilities or disruptions. |
| <span severity="INFO">INFO</span> | Issues that do not impact the security of the project but are reported to the client's team for improvement. They include recommendations related to code quality, gas optimization, and other minor adjustments that could enhance the project's overall performance and maintainability. |

#### Status Level Reference
Based on the feedback received from the client's team regarding the list of findings discovered by the contractor, the following statuses were assigned to the findings:

| Title | Description |
| --- | --- |
| <span status="NEW">NEW</span> | Waiting for the project team's feedback. |
| <span status="FIXED">FIXED</span> | Recommended fixes have been applied to the project code and the identified issue no longer aﬀects the project's security. |
| <span status="ACKNOWLEDGED">ACKNOWLEDGED</span> | The project team is aware of this finding and acknowledges the associated risks. This finding may affect the overall security of the project; however, based on the risk assessment, the team will decide whether to address it or leave it unchanged. |
| <span status="NO ISSUE">NO ISSUE</span> | Finding does not aﬀect the overall security of the project and does not violate the logic of its work. |


### About Oxorio

OXORIO is a blockchain security firm that specializes in curcuits, zk-SNARK solutions, and security consulting. With a decade of blockchain development and five years in smart contract auditing, our expert team delivers premier security services for projects at any stage of maturity and development.

Since 2021, we've conducted key security audits for notable DeFi projects like Lido, 1Inch, Rarible, and deBridge, prioritizing excellence and long-term client relationships. Our co-founders, recognized by the Ethereum and Web3 Foundations, lead our continuous research to address new threats in the blockchain industry. Committed to the industry's trust and advancement, we contribute significantly to security standards and practices through our research and education work.

Our contacts:

- [oxor.io](https://oxor.io)
- [ping@oxor.io](mailto:ping@oxor.io)
- [Github](https://github.com/oxor-io)
- [Linkedin](https://linkedin.com/company/0xorio)
- [Twitter](https://twitter.com/0xorio)