import { FC, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair,
  Connection
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
  const { publicKey, signTransaction } = useWallet();
  const connection = new Connection('https://rpc.helius.xyz/?api-key=c9e1fc7e-2bf8-4c9f-b2c3-67945d25d8b4', {
    commitment: 'confirmed',
    wsEndpoint: 'wss://rpc.helius.xyz/?api-key=c9e1fc7e-2bf8-4c9f-b2c3-67945d25d8b4'
  });
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
      // Use hardcoded values for rent exemption
      const mintRent = 1461600; // Standard rent exemption for token mint (82 bytes)
      const ataRent = 2039280;  // Standard rent exemption for ATA (165 bytes)
      
      // Create mint account
      const mintKeypair = Keypair.generate();

      // Get associated token account address
      const associatedTokenAddress = await getAssociatedTokenAddress(
        mintKeypair.publicKey,
        publicKey
      );

      alert(`Creating token with addresses:
Mint: ${mintKeypair.publicKey.toString()}
Token Account: ${associatedTokenAddress.toString()}`);
        
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
        
      alert('Please approve the first transaction in your wallet...');
      createMintTx.partialSign(mintKeypair);
      const signedMintTx = await signTransaction(createMintTx);

      alert('Sending first transaction...');
      const mintSignature = await connection.sendRawTransaction(signedMintTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'finalized',
        maxRetries: 5
      });

      alert(`First transaction sent: ${mintSignature}`);
        
      const mintConfirmation = await connection.confirmTransaction({
        blockhash: mintBlockhash,
        lastValidBlockHeight: mintLastValid,
        signature: mintSignature
      }, 'finalized');

      if (mintConfirmation.value.err) {
        throw new Error(`Mint creation failed: ${JSON.stringify(mintConfirmation.value.err)}`);
      }

      alert('First transaction confirmed. Starting second transaction...');
        
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

      alert('Please approve the second transaction in your wallet...');
      const signedTokenTx = await signTransaction(mintTokensTx);

      alert('Sending second transaction...');
      const tokenSignature = await connection.sendRawTransaction(signedTokenTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'finalized',
        maxRetries: 5
      });

      alert(`Second transaction sent: ${tokenSignature}`);
        
      const tokenConfirmation = await connection.confirmTransaction({
        blockhash: tokenBlockhash,
        lastValidBlockHeight: tokenLastValid,
        signature: tokenSignature
      }, 'finalized');

      if (tokenConfirmation.value.err) {
        throw new Error(`Token minting failed: ${JSON.stringify(tokenConfirmation.value.err)}`);
      }

      alert('Token creation completed successfully!');
        
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
