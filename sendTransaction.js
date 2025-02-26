const web3 = require("@solana/web3.js");
const bs58 = require('bs58');
const splToken = require('@solana/spl-token');

// Replace with your wallet's private key (in base58 format)
const privateKey = ""; // Sender's private key
const recipientAddress = ""; // Replace with the recipient's wallet address
const amount = 0.001 * web3.LAMPORTS_PER_SOL; // Amount to send (in lamports)

(async () => {
    try {
        const solana = new web3.Connection(""); // Replace with the Solana endpoint URL
        
        const senderKeypair = web3.Keypair.fromSecretKey(bs58.decode(privateKey));
        const recipientPublicKey = new web3.PublicKey(recipientAddress);

        // Check sender's balance
        const senderBalance = await solana.getBalance(senderKeypair.publicKey);
        console.log(`Sender's balance: ${senderBalance / web3.LAMPORTS_PER_SOL} SOL`);

        if (senderBalance < amount) {
            throw new Error("Insufficient funds");
        }

        console.log("Creating transaction...");
        const { blockhash, lastValidBlockHeight } = await solana.getLatestBlockhash();
        const transaction = new web3.Transaction({
            blockhash,
            lastValidBlockHeight,
            feePayer: senderKeypair.publicKey,
        }).add(
            web3.SystemProgram.transfer({
                fromPubkey: senderKeypair.publicKey,
                toPubkey: recipientPublicKey,
                lamports: amount,
            })
        );

        console.log("Sending transaction...");
        const signature = await solana.sendTransaction(transaction, [senderKeypair]);
        console.log("Transaction sent with signature:", signature);
        console.log("Blockhash:", blockhash);

        // Retry mechanism to fetch the transaction details
        let transactionDetails = null;
        for (let i = 0; i < 50; i++) {
            transactionDetails = await solana.getTransaction(signature);
            if (transactionDetails) {
                break;
            }
            console.log("Retrying to fetch transaction details...");
            await new Promise(resolve => setTimeout(resolve, 500)); // wait for 500ms before retrying
        }

        if (transactionDetails) {
            console.log("Transaction details:", transactionDetails);

            // Log SOL transfer amount using preBalances and postBalances
            const preBalances = transactionDetails.meta.preBalances;
            const postBalances = transactionDetails.meta.postBalances;
            const solTransferAmount = (preBalances[0] - postBalances[0]) / web3.LAMPORTS_PER_SOL;
            console.log(`SOL transfer detected: ${solTransferAmount} SOL`);

            // Get all accounts involved in the transaction
            const accountKeys = transactionDetails.transaction.message.accountKeys;
            
            // Check for token transfers
            if (transactionDetails.meta.preTokenBalances && transactionDetails.meta.postTokenBalances) {
                const preTokenBalances = transactionDetails.meta.preTokenBalances;
                const postTokenBalances = transactionDetails.meta.postTokenBalances;

                for (let i = 0; i < preTokenBalances.length; i++) {
                    const pre = preTokenBalances[i];
                    const post = postTokenBalances[i];

                    if (pre && post) {
                        console.log(`Token transfer detected:`);
                        console.log(`Token Mint: ${pre.mint}`);
                        console.log(`Account: ${accountKeys[pre.accountIndex]}`);
                        console.log(`Previous balance: ${pre.uiTokenAmount.uiAmount}`);
                        console.log(`New balance: ${post.uiTokenAmount.uiAmount}`);
                        console.log(`Token decimals: ${pre.uiTokenAmount.decimals}`);
                    }
                }
            }

            // Decode instructions
            transactionDetails.transaction.message.instructions.forEach((instruction, index) => {
                console.log(`Instruction ${index}:`, {
                    programId: accountKeys[instruction.programIdIndex].toString(),
                    accounts: instruction.accounts.map(idx => accountKeys[idx].toString()),
                    data: instruction.data
                });

                // Decode System Program transfer instruction
                if (accountKeys[instruction.programIdIndex].equals(web3.SystemProgram.programId)) {
                    const decoded = web3.SystemInstruction.decodeTransfer({
                        programId: accountKeys[instruction.programIdIndex],
                        keys: instruction.accounts.map(idx => ({
                            pubkey: accountKeys[idx],
                            isSigner: false,
                            isWritable: true
                        })),
                        data: Buffer.from(bs58.decode(instruction.data))
                    });

                    console.log('Decoded transfer:', {
                        from: decoded.fromPubkey.toString(),
                        to: decoded.toPubkey.toString(),
                        amount: `${Number(decoded.lamports) / web3.LAMPORTS_PER_SOL} SOL`
                    });
                }
            });
        } else {
            console.log("Transaction not found after retries");
        }

        console.log("Confirming transaction...");
        const confirmation = await solana.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight
        });
        console.log("Transaction confirmation status:", confirmation);
    } catch (error) {
        console.error("Error sending transaction:", error);
    }
})();
