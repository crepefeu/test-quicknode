const web3 = require("@solana/web3.js");
const splToken = require("@solana/spl-token");
const bs58 = require('bs58');

// Configuration
const privateKey = ""; // Sender's private key
const recipientAddress = ""; // Recipient's wallet address
const tokenMintAddress = ""; // Token mint address
const amount = 1; // Amount to send (will be adjusted for decimals)

(async () => {
    try {
        const solana = new web3.Connection(""); // Replace with the Solana endpoint URL
        const senderKeypair = web3.Keypair.fromSecretKey(bs58.decode(privateKey));
        
        // Get token mint info
        const mint = new web3.PublicKey(tokenMintAddress);
        const mintInfo = await splToken.getMint(solana, mint);

        console.log("Mint info:", mintInfo);
        
        // Get sender's token account
        const senderTokenAccount = await splToken.getAssociatedTokenAddress(
            mint,
            senderKeypair.publicKey
        );
        
        console.log("Sender token account:", senderTokenAccount.toString());

        // Get or create recipient's token account
        const recipientPublicKey = new web3.PublicKey(recipientAddress);
        const recipientTokenAccount = await splToken.getAssociatedTokenAddress(
            mint,
            recipientPublicKey
        );

        console.log("Recipient token account:", recipientTokenAccount.toString());

        // Check if recipient's token account exists
        const recipientAccountInfo = await solana.getAccountInfo(recipientTokenAccount);

        console.log("Sender token account:", senderTokenAccount.toString());
        
        console.log("Creating transaction...");
        const transaction = new web3.Transaction();

        // Get the latest blockhash
        const { blockhash, lastValidBlockHeight } = await solana.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = senderKeypair.publicKey;

        // If recipient's token account doesn't exist, create it
        if (!recipientAccountInfo) {
            transaction.add(
                splToken.createAssociatedTokenAccountInstruction(
                    senderKeypair.publicKey,
                    recipientTokenAccount,
                    recipientPublicKey,
                    mint
                )
            );
        }

        // Add transfer instruction
        transaction.add(
            splToken.createTransferInstruction(
                senderTokenAccount,
                recipientTokenAccount,
                senderKeypair.publicKey,
                amount * Math.pow(10, mintInfo.decimals) // Adjust for token decimals
            )
        );

        console.log("Sending transaction...");
        const signature = await solana.sendTransaction(transaction, [senderKeypair]);
        console.log(`Transaction sent! Signature: ${signature}`);

        console.log("Waiting for confirmation...");
        let done = false;
        for (let i = 0; i < 50 && !done; i++) {
            const status = await solana.getSignatureStatus(signature);
            console.log("Transaction status:", status);
            
            if (status.value && (status.value.confirmationStatus === 'confirmed' || status.value.confirmationStatus === 'finalized')) {
                console.log("Transaction confirmed!");
                done = true;
            } else {
                await new Promise(resolve => setTimeout(resolve, 1000));
                console.log("Waiting for confirmation...");
            }
        }

        if (!done) {
            throw new Error("Transaction confirmation timeout");
        }

        // Fetch and decode transaction details
        let transactionDetails = null;
        for (let i = 0; i < 50; i++) {
            transactionDetails = await solana.getTransaction(signature, { maxSupportedTransactionVersion: 0 });
            if (transactionDetails) {
                break;
            }
            console.log("Retrying to fetch transaction details...");
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (transactionDetails) {
            console.log("\nTransaction Details:");
            
            // Log token balance changes
            if (transactionDetails.meta.preTokenBalances && transactionDetails.meta.postTokenBalances) {
                const preBalances = transactionDetails.meta.preTokenBalances;
                const postBalances = transactionDetails.meta.postTokenBalances;

                console.log("\nToken Balance Changes:");
                for (let i = 0; i < preBalances.length; i++) {
                    const pre = preBalances[i];
                    const post = postBalances[i];
                    if (pre && post) {
                        console.log(`Account: ${pre.owner}`);
                        console.log(`Token: ${pre.mint}`);
                        console.log(`Previous Balance: ${pre.uiTokenAmount.uiAmount}`);
                        console.log(`New Balance: ${post.uiTokenAmount.uiAmount}`);
                        console.log(`Change: ${post.uiTokenAmount.uiAmount - pre.uiTokenAmount.uiAmount}`);
                        console.log('------------------------');
                    }
                }
            }

            // Log SOL balance changes
            const preBalances = transactionDetails.meta.preBalances;
            const postBalances = transactionDetails.meta.postBalances;
            console.log("\nSOL Balance Changes (for fees):");
            console.log(`Fee paid: ${(preBalances[0] - postBalances[0]) / web3.LAMPORTS_PER_SOL} SOL`);

            // Log program logs
            if (transactionDetails.meta.logMessages) {
                console.log("\nProgram Logs:");
                transactionDetails.meta.logMessages.forEach(log => console.log(log));
            }
        }
    } catch (error) {
        console.error("Error:", error);
    }
})();
