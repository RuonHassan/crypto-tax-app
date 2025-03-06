import { NextApiRequest, NextApiResponse } from 'next';
import { walletService } from '../../../services/walletService';
import { ApiError } from '../../../utils/errors';
import { Wallet } from '../../../types';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        switch (req.method) {
            case 'GET':
                return await handleGet(req, res);
            case 'POST':
                return await handlePost(req, res);
            case 'DELETE':
                return await handleDelete(req, res);
            default:
                return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Wallet API error:', error);
        
        const statusCode = error instanceof ApiError ? error.statusCode : 500;
        const message = error instanceof ApiError ? error.message : 'Internal server error';
        
        return res.status(statusCode).json({ error: message });
    }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
    const { userId } = req.query;

    if (!userId || Array.isArray(userId)) {
        throw new ApiError(400, 'Invalid user ID');
    }

    const wallets = await walletService.getUserWallets(userId);
    return res.status(200).json(wallets);
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
    const { userId, address, name } = req.body;

    if (!userId || !address) {
        throw new ApiError(400, 'Missing required parameters');
    }

    const wallet = await walletService.addWallet({
        user_id: userId,
        wallet_address: address,
        wallet_name: name,
        network: 'solana'
    });
    return res.status(201).json(wallet);
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
    const { walletId } = req.body;

    if (!walletId) {
        throw new ApiError(400, 'Missing required parameters');
    }

    await walletService.deleteWallet(walletId);
    return res.status(200).json({ message: 'Wallet deleted successfully' });
} 