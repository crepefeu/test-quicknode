const web3 = require("@solana/web3.js");
const fs = require('fs');
const path = require('path');
const splToken = require('@solana/spl-token');

const walletAddresses = [
    "",
    // Add more wallet addresses here
];
const lastSignaturesFile = path.join(__dirname, 'lastSignatures.json');

(async () => {
    const solana = new web3.Connection(""); // Replace with the Solana endpoint URL

    console.log("Monitoring wallet addresses activity...");

    let lastSignatures = {};

    // Read the last seen signatures from the file
    if (fs.existsSync(lastSignaturesFile)) {
        lastSignatures = JSON.parse(fs.readFileSync(lastSignaturesFile, 'utf8'));
    }

    const seenSignatures = new Set();

    while (true) {
        for (const walletAddress of walletAddresses) {
            const lastSignature = lastSignatures[walletAddress] || null;
            const signatures = await solana.getSignaturesForAddress(new web3.PublicKey(walletAddress), { limit: 1 });

            if (signatures.length > 0) {
                const signature = signatures[0].signature;

                if (!seenSignatures.has(signature) && signature !== lastSignature) {
                    const transaction = await solana.getTransaction(signature, { maxSupportedTransactionVersion: 0 });

                    if (transaction) {
                        console.log(`New transaction detected for ${walletAddress}:`, transaction);

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

                        lastSignatures[walletAddress] = signature;

                        // Save the last seen signatures to the file
                        fs.writeFileSync(lastSignaturesFile, JSON.stringify(lastSignatures, null, 2));

                        seenSignatures.add(signature);
                    }
                }
            }
        }

        await new Promise(resolve => setTimeout(resolve, 5000)); // wait for 5 seconds before checking again
    }
})();
