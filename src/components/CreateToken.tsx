import { FC, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair
} from '@solana/web3.js';
import {
  createInitializeMintInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createSetAuthorityInstruction,
  AuthorityType
} from '@solana/spl_token';
import {
  Button,
  TextField,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert,
  Box,
  IconButton,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

export const CreateToken: FC = () => {
  const { publicKey, signTransaction, connection } = useWallet();
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [decimals, setDecimals] = useState('9');
  const [revokeFreeze, setRevokeFreeze] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<{
    mintAddress: string;
    tokenAccountAddress: string;
  } | null>(null);

  const getAccountBalance = async (address: PublicKey): Promise<number> => {
    try {
      const response = await fetch('https://rpc.ankr.com/solana', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [
            address.toString()
          ]
        })
      });

      const data = await response.json();
      if (data.error) {
        console.error('RPC Error:', data.error);
        throw new Error(data.error.message);
      }

      return data.result?.value || 0;
    } catch (error) {
      console.error('Failed to get balance:', error);
      throw error;
    }
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    alert('Address copied to clipboard!');
  };

  const handleCreateToken = async () => {
    if (!publicKey || !signTransaction) {
      alert('Please connect your wallet first');
      return;
    }

    if (!tokenName || !tokenSymbol || !decimals) {
      alert('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setTokenInfo(null);

    try {
      alert('Starting token creation process...');
        
      // Use hardcoded values for rent exemption
      const mintRent = 1461600; // Standard rent exemption for token mint (82 bytes)
      const ataRent = 2039280;  // Standard rent exemption for ATA (165 bytes)
      
      console.log('Using hardcoded values - Mint rent:', mintRent, 'ATA rent:', ataRent);
      
      // Get balance using our custom function
      const balance = await getAccountBalance(publicKey);
      console.log('Wallet balance:', balance);

      const requiredBalance = mintRent + ataRent + 10000000; // Add extra for transaction fees
      
      alert(`Balance check:
Current balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL
Required balance: ${(requiredBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL
Mint rent: ${(mintRent / LAMPORTS_PER_SOL).toFixed(4)} SOL
ATA rent: ${(ataRent / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
      
      if (balance < requiredBalance) {
        throw new Error(`Insufficient balance. Please ensure you have at least ${(requiredBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL in your wallet. Current balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
      }

      // Create mint account
      const mintKeypair = Keypair.generate();

      // Get associated token account address
      const associatedTokenAddress = await getAssociatedTokenAddress(
        mintKeypair.publicKey,
        publicKey
      );

      alert(`Addresses:
Mint public key: ${mintKeypair.publicKey.toString()}
Associated token address: ${associatedTokenAddress.toString()}`);
        
      // First transaction: Create and initialize mint
      const createMintTx = new Transaction().add(
        // Create account for token mint
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: 82,
          lamports: mintRent,
          programId: TOKEN_PROGRAM_ID,
        }),
        // Initialize mint
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          Number(decimals),
          publicKey,
          publicKey,
          TOKEN_PROGRAM_ID
        )
      );

      // Get the latest blockhash
      const { blockhash: mintBlockhash, lastValidBlockHeight: mintLastValid } = 
        await connection.getLatestBlockhash('finalized');

      createMintTx.recentBlockhash = mintBlockhash;
      createMintTx.feePayer = publicKey;
        
      alert('Signing mint transaction...');
      createMintTx.partialSign(mintKeypair);
      const signedMintTx = await signTransaction(createMintTx);

      alert('Sending mint transaction...');
      const mintSignature = await connection.sendRawTransaction(signedMintTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'finalized',
        maxRetries: 5
      });

      alert(`Mint transaction sent: ${mintSignature}`);
        
      const mintConfirmation = await connection.confirmTransaction({
        blockhash: mintBlockhash,
        lastValidBlockHeight: mintLastValid,
        signature: mintSignature
      }, 'finalized');

      if (mintConfirmation.value.err) {
        throw new Error(`Mint creation failed: ${JSON.stringify(mintConfirmation.value.err)}`);
      }

      alert('Mint transaction confirmed. Waiting before next transaction...');
        
      // Add delay between transactions
      await new Promise(resolve => setTimeout(resolve, 5000));

      alert('Starting second transaction...');
        
      // Second transaction: Create ATA and mint tokens
      const mintTokensTx = new Transaction().add(
        // Create associated token account
        createAssociatedTokenAccountInstruction(
          publicKey,
          associatedTokenAddress,
          publicKey,
          mintKeypair.publicKey
        ),
        // Mint tokens
        createMintToInstruction(
          mintKeypair.publicKey,
          associatedTokenAddress,
          publicKey,
          1000000000000,
          []
        )
      );

      // Add revoke freeze authority if needed
      if (revokeFreeze) {
        mintTokensTx.add(
          createSetAuthorityInstruction(
            mintKeypair.publicKey,
            publicKey,
            AuthorityType.FreezeAccount,
            null
          )
        );
      }

      // Get fresh blockhash for second transaction
      const { blockhash: tokenBlockhash, lastValidBlockHeight: tokenLastValid } = 
        await connection.getLatestBlockhash('finalized');

      mintTokensTx.recentBlockhash = tokenBlockhash;
      mintTokensTx.feePayer = publicKey;

      alert('Signing token transaction...');
      const signedTokenTx = await signTransaction(mintTokensTx);

      alert('Sending token transaction...');
      const tokenSignature = await connection.sendRawTransaction(signedTokenTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'finalized',
        maxRetries: 5
      });

      alert(`Token transaction sent: ${tokenSignature}`);
        
      const tokenConfirmation = await connection.confirmTransaction({
        blockhash: tokenBlockhash,
        lastValidBlockHeight: tokenLastValid,
        signature: tokenSignature
      }, 'finalized');

      if (tokenConfirmation.value.err) {
        throw new Error(`Token minting failed: ${JSON.stringify(tokenConfirmation.value.err)}`);
      }

      alert('Token transaction confirmed!');
        
      const newTokenInfo = {
        mintAddress: mintKeypair.publicKey.toString(),
        tokenAccountAddress: associatedTokenAddress.toString(),
      };
        
      setTokenInfo(newTokenInfo);
      setSuccess('Token created successfully!');
        
      // Reset form
      setTokenName('');
      setTokenSymbol('');
      setDecimals('9');
      setRevokeFreeze(false);

    } catch (error: any) {
      console.error('Error creating token:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', p: 2 }}>
      <TextField
        fullWidth
        label="Token Name"
        value={tokenName}
        onChange={(e) => setTokenName(e.target.value)}
        margin="normal"
        disabled={isLoading}
      />
      <TextField
        fullWidth
        label="Token Symbol"
        value={tokenSymbol}
        onChange={(e) => setTokenSymbol(e.target.value)}
        margin="normal"
        disabled={isLoading}
      />
      <TextField
        fullWidth
        label="Decimals"
        type="number"
        value={decimals}
        onChange={(e) => setDecimals(e.target.value)}
        margin="normal"
        disabled={isLoading}
      />
      <FormControlLabel
        control={
          <Switch
            checked={revokeFreeze}
            onChange={(e) => setRevokeFreeze(e.target.checked)}
            disabled={isLoading}
          />
        }
        label="Revoke Freeze Authority"
      />
      <Button
        fullWidth
        variant="contained"
        onClick={handleCreateToken}
        disabled={isLoading || !publicKey}
        sx={{ mt: 2 }}
      >
        {isLoading ? <CircularProgress size={24} /> : 'Create Token'}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mt: 2 }}>
          {success}
        </Alert>
      )}

      {tokenInfo && (
        <Box sx={{ mt: 2 }}>
          <Alert
            severity="info"
            action={
              <IconButton
                color="inherit"
                size="small"
                onClick={() => handleCopyAddress(tokenInfo.mintAddress)}
              >
                <ContentCopyIcon />
              </IconButton>
            }
          >
            Mint Address: {tokenInfo.mintAddress}
          </Alert>
          <Alert
            severity="info"
            sx={{ mt: 1 }}
            action={
              <IconButton
                color="inherit"
                size="small"
                onClick={() => handleCopyAddress(tokenInfo.tokenAccountAddress)}
              >
                <ContentCopyIcon />
              </IconButton>
            }
          >
            Token Account: {tokenInfo.tokenAccountAddress}
          </Alert>
        </Box>
      )}
    </Box>
  );
};
