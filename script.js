const web3 = require("@solana/web3.js");

(async () => {
  const solana = new web3.Connection("endpoint url here"); // Replace with the Solana endpoint URL
  
  console.log("Script is running...");

  while (true) {
    console.log(await solana.getSlot());
  }
})();