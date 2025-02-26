const web3 = require("@solana/web3.js");
const fs = require('fs');
const path = require('path');
const splToken = require('@solana/spl-token');

const walletAddress = ""; // Replace with the wallet address you want to monitor
const lastSignatureFile = path.join(__dirname, 'lastSignature.txt'); // File to store the last seen signature, could be a database

(async () => {
    const solana = new web3.Connection("");

    console.log("Monitoring wallet address activity...");

    let lastSignature = null;

    // Read the last seen signature from the file
    if (fs.existsSync(lastSignatureFile)) {
        lastSignature = fs.readFileSync(lastSignatureFile, 'utf8');
    }

    const seenSignatures = new Set();

    while (true) {
        const signatures = await solana.getSignaturesForAddress(new web3.PublicKey(walletAddress), { limit: 1 });

        if (signatures.length > 0) {
            const signature = signatures[0].signature;

            if (!seenSignatures.has(signature) && signature !== lastSignature) {
                const transaction = await solana.getTransaction(signature, { maxSupportedTransactionVersion: 0 });

                if (transaction) {
                    console.log("New transaction detected:", transaction);

                    transaction.transaction.message.instructions.forEach(instruction => {
                        try {
                            const decodedInstruction = splToken.TokenInstruction.decode(instruction);
                            if (decodedInstruction) {
                                console.log("Token transfer detected:", decodedInstruction);
                            }
                        } catch (error) {
                            console.error("Error decoding instruction:", error);
                        }
                    });

                    lastSignature = signature;

                    // Save the last seen signature to the file
                    fs.writeFileSync(lastSignatureFile, lastSignature);

                    seenSignatures.add(signature);
                }
            }
        }
    }
})();
