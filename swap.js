const { ethers } = require('ethers')
const { NftSwap } = require('@traderxyz/nft-swap-sdk')
const config = require('./config')

// Sets the ethers provider using the Polygon RPC.
// Has to be set in .env
const provider = new ethers.providers.JsonRpcProvider(config.POLYGON_RPC)

// makerSign refers to the object/variable that triggers the sellers signature request
// Please note that the pvt_key has to set in .env
const makerSign = new ethers.Wallet(config.MAKER_PVT_KEY, provider)

// takerSign refers to the object/variable that triggers the buyers signature request
// Please note that the pvt_key has to set in .env
const takerSign = new ethers.Wallet(config.TAKER_PVT_KEY, provider)

// Creates NFT sdk objects for both the buyer and seller( maker and taker)
const nftSwapSdk_maker = new NftSwap(provider, makerSign, 137)
const nftSwapSdk_taker = new NftSwap(provider, takerSign, 137)

async function script() {
    // Creates the Seller/Makers Asset Data - This represents the NFT
    // NFT contract address needs to be set in the .env
    // Token ID is the NFT token ID of the NFT to swap
    const TEST_NFT = {
        tokenAddress: config.NFT_CONTRACT,
        // For now, the seller holds NFT with Id - 10,20,30 Only
        tokenId: '10',
        type: 'ERC721',
    }

    // Seller/Maker Address - Can be replaced with any other address which has NFT
    const walletAddressUserA = '0xDDdAb2483562e88425d1b14D56766B6d25110FD9'
    const assetsToSwapUserA = [TEST_NFT]

    // Creates the Buyer/Taker Asset Data - This represents the ERC20 Token
    // ERC20 contract address needs to be set in the .env
    const ONE_USDT = {
        tokenAddress: config.ERC20_CONTRACT,
        // Amount is the amount of ERC20 to be swapped. It includes all decimals - 6 in the case of USDT
        amount: '1000000',
        type: 'ERC20',
    }

    // Buyer/Taker Address - Can be replaced with any other address which has ERC20 Token
    const walletAddressUserB = '0xBE10750c194408Fb3cB62FAA6F5D8a07E365037D'
    const assetsToSwapUserB = [ONE_USDT]

    // Ox contracts needs to be given approval before they act as a mediator for the swap
    // Before granting approval, we check the approval status.
    const approvalStatusForUserA = await nftSwapSdk_maker.loadApprovalStatus(
        assetsToSwapUserA[0],
        walletAddressUserA
    )

    // If there is no approval, then approval has to be given to 0x by interacting with the NFT contract.
    // Seller/Maker initiates this operation
    if (!approvalStatusForUserA.contractApproved) {
        console.log('maker approving !!')
        const approvalTx = await nftSwapSdk_maker.approveTokenOrNftByAsset(
            assetsToSwapUserA[0],
            walletAddressUserA,
            {
                // These fees can be obtained from the Polygon gas station API - https://gasstation-mainnet.matic.network/v2
                maxPriorityFeePerGas: '44426392484',
                maxFeePerGas: '45426392484',
            }
        )

        // Once the approval tx is confirmed on the blockchain, the receipt is obtained.
        const approvalTxReceipt = await approvalTx.wait()
        console.log(
            `Approved ${assetsToSwapUserA[0].tokenAddress} contract to swap with 0x (txHash: ${approvalTxReceipt.transactionHash})`
        )
    } else {
        // If already approved, we can proceed with order signing. Approval is always a one time process for the user
        // as unilimited approval is given to the  0x contracts in the first approval itself. This design is followed to save gas and improve UX.
        console.log('already approved !!')

        // First build the order object in a format the 0x protocol understands.
        const order = nftSwapSdk_maker.buildOrder(
            assetsToSwapUserA,
            assetsToSwapUserB,
            walletAddressUserA
        )

        // Try uncommenting below to understand order object schema
        // console.log('Order', order)

        // Seller/Makers has to sign this order object.
        const signedOrder = await nftSwapSdk_maker.signOrder(
            order,
            walletAddressUserA
        )

        // The above process is call offchain order creation. Once this is done, the signed order can be stored in a database and server to the buyers on a listing page.
        // All the attirbutes needed to be displayed on the UI can be obtained from this signed order itself.

        //Try uncommenting below to understand signed order object schema
        // console.log('signedOrder', signedOrder)

        // From here, the buyer parts begins.
        // Buyer also needs to approve the 0x protocol to swap his ERC20 tokens on his behalf
        const approvalStatusForUserB =
            await nftSwapSdk_taker.loadApprovalStatus(
                assetsToSwapUserB[0],
                walletAddressUserB
            )

        // If there is no approval, then approval has to be given to 0x by interacting with the ERC20 contract.
        // Buyer/Taker initiates this operation
        if (!approvalStatusForUserB.contractApproved) {
            console.log('taker approving !!!!')
            const approvalTx = await nftSwapSdk_taker.approveTokenOrNftByAsset(
                assetsToSwapUserB[0],
                walletAddressUserB,
                {
                    // These fees can be obtained from the Polygon gas station API - https://gasstation-mainnet.matic.network/v2
                    maxPriorityFeePerGas: '44426392484',
                    maxFeePerGas: '45426392484',
                }
            )

            // Once the approval tx is confirmed on the blockchain, the receipt is obtained
            const approvalTxReceipt = await approvalTx.wait()
            console.log(
                `Approved ${assetsToSwapUserB[0].tokenAddress} contract to swap with 0x. TxHash: ${approvalTxReceipt.transactionHash})`
            )
        } else {
            // If already approved, we can proceed with order filling/swap execution. Approval is always a one time process for the buyer too
            // as unilimited approval is given to the  0x contracts in the first approval itself. This design is followed to save gas and improve UX.
            console.log('ready to swap !!!')

            const fillTx = await nftSwapSdk_taker.fillSignedOrder(
                signedOrder,
                {},
                {
                    // These fees can be obtained from the Polygon gas station API - https://gasstation-mainnet.matic.network/v2
                    maxPriorityFeePerGas: '44426392484',
                    maxFeePerGas: '45426392484',
                }
            )

            // The above is called Order filling or Swap execution. This on chain order settlement.
            // The operation is executed and the buyer needs to pay gas fees for this. The swap is facilitated by the 0x protocol
            const fillTxReceipt = await fillTx.wait()
            console.log(
                `🎉 🥳 Order filled. TxHash: ${fillTxReceipt.transactionHash}`
            )
        }
    }
}

script().catch((err) => {
    console.log(err)
})
