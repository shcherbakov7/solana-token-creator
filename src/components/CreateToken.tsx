import { FC, useState, useEffect, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
  createInitializeMintInstruction,
  createMintToInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl_token';
import { 
  Keypair, 
  Transaction, 
  SystemProgram, 
  sendAndConfirmTransaction, 
  PublicKey,
  Connection,
  clusterApiUrl,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import {
  Button,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Snackbar,
  Paper,
  Switch,
  FormControlLabel,
  Link,
} from '@mui/material';
import { ContentCopy, Launch } from '@mui/icons-material';

export const CreateToken: FC = () => {
  const { publicKey, signTransaction } = useWallet();
  const connection = useMemo(
    () => new Connection('https://rpc.ankr.com/solana', 'confirmed'),
    []
  );
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [decimals, setDecimals] = useState('9');
  const [revokeFreeze, setRevokeFreeze] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<{
    mintAddress: string;
    tokenAccountAddress: string;
  } | null>(null);

  useEffect(() => {
  }, []);

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setSuccess('Address copied to clipboard!');
  };

  const getExplorerUrl = (address: string, type: 'token' | 'address') => {
    return `https://solscan.io/${type}/${address}?cluster=mainnet`;
  };

  const handleCreateToken = async () => {
    if (!publicKey || !signTransaction) {
      setError('Please connect your wallet first');
      return;
    }

    if (!tokenName || !tokenSymbol) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      setTokenInfo(null);

      // Create mint account
      const mintKeypair = Keypair.generate();
      
      try {
        alert('Starting token creation process...');
        
        // Calculate required lamports
        const mintSpace = 82;
        const mintRent = await connection.getMinimumBalanceForRentExemption(mintSpace);
        const ataRent = await connection.getMinimumBalanceForRentExemption(165);
        
        // Check wallet balance
        const balance = await connection.getBalance(publicKey);
        const requiredBalance = mintRent + ataRent + 10000000; // Add extra for transaction fees
        
        alert(`Balance check:
Current balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL
Required balance: ${(requiredBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL
Mint rent: ${(mintRent / LAMPORTS_PER_SOL).toFixed(4)} SOL
ATA rent: ${(ataRent / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
        
        if (balance < requiredBalance) {
          throw new Error(`Insufficient balance. Please ensure you have at least ${(requiredBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL in your wallet. Current balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
        }

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
            space: mintSpace,
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

      } catch (txError: any) {
        console.error('Transaction error:', txError);
        alert(`Transaction error: ${txError.message}`);
        
        if (txError.message.includes('User rejected')) {
          setError('Transaction was rejected in wallet. Please approve the transaction to create the token.');
        } else {
          let errorMessage = 'Transaction failed';
          
          if (txError.logs) {
            console.error('Transaction logs:', txError.logs);
            errorMessage += `: ${txError.logs.join('\n')}`;
          } else {
            errorMessage += `: ${txError.message}`;
          }
          
          setError(errorMessage);
        }
      }

    } catch (err: any) {
      console.error('Error creating token:', err);
      alert(`Error creating token: ${err.message}`);
      setError(err.message || 'Failed to create token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tokenInfo) {
      console.log('TokenInfo in effect:', tokenInfo);
    }
  }, [tokenInfo]);

  return (
    <>
      <Paper 
        elevation={3} 
        sx={{ 
          p: 4, 
          maxWidth: 500, 
          mx: 'auto',
          background: 'linear-gradient(145deg, rgba(30,30,30,0.9) 0%, rgba(45,45,45,0.9) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
          position: 'relative',
          zIndex: 1,
          mb: tokenInfo ? 4 : 0
        }}
      >
        <Typography 
          variant="h4" 
          gutterBottom 
          align="center"
          sx={{
            fontWeight: 600,
            mb: 4,
            background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Create Token
        </Typography>
        <Box component="form" noValidate autoComplete="off">
          <TextField
            fullWidth
            label="Token Name"
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            margin="normal"
            required
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'rgba(255,255,255,0.1)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(255,255,255,0.2)',
                },
              },
            }}
          />
          <TextField
            fullWidth
            label="Token Symbol"
            value={tokenSymbol}
            onChange={(e) => setTokenSymbol(e.target.value)}
            margin="normal"
            required
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'rgba(255,255,255,0.1)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(255,255,255,0.2)',
                },
              },
            }}
          />
          <TextField
            fullWidth
            label="Decimals"
            type="number"
            value={decimals}
            onChange={(e) => setDecimals(e.target.value)}
            margin="normal"
            inputProps={{ min: 0, max: 9 }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'rgba(255,255,255,0.1)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(255,255,255,0.2)',
                },
              },
            }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={revokeFreeze}
                onChange={(e) => setRevokeFreeze(e.target.checked)}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#2196F3',
                    '&:hover': {
                      backgroundColor: 'rgba(33, 150, 243, 0.08)',
                    },
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#2196F3',
                  },
                }}
              />
            }
            label={
              <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
                Revoke Freeze Authority
              </Typography>
            }
            sx={{ mt: 2, mb: 1 }}
          />
          <Button
            fullWidth
            variant="contained"
            onClick={handleCreateToken}
            disabled={!publicKey || loading}
            sx={{ 
              mt: 4, 
              mb: 2,
              background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
              boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
              color: 'white',
              '&:hover': {
                background: 'linear-gradient(45deg, #1E88E5 30%, #1CB5E0 90%)',
              },
            }}
          >
            {loading ? <CircularProgress size={24} /> : 'Create Token'}
          </Button>
        </Box>
      </Paper>

      {tokenInfo && (
        <Paper
          elevation={3}
          sx={{
            p: 4,
            maxWidth: 500,
            mx: 'auto',
            mt: 4,
            background: 'linear-gradient(145deg, rgba(30,30,30,0.95) 0%, rgba(45,45,45,0.95) 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
          }}
        >
          <Typography
            variant="h5"
            sx={{
              color: '#2196F3',
              fontWeight: 'bold',
              mb: 3,
              textAlign: 'center'
            }}
          >
            Token Created Successfully!
          </Typography>

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" sx={{ color: 'rgba(255,255,255,0.9)', mb: 1, fontWeight: 'bold' }}>
              Token Address:
            </Typography>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              backgroundColor: 'rgba(255,255,255,0.05)',
              p: 2,
              borderRadius: 1,
              wordBreak: 'break-all'
            }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', flexGrow: 1 }}>
                {tokenInfo.mintAddress}
              </Typography>
              <Button
                size="small"
                onClick={() => handleCopyAddress(tokenInfo.mintAddress)}
                sx={{ minWidth: 'auto', ml: 1 }}
              >
                <ContentCopy sx={{ color: 'rgba(255,255,255,0.7)' }} />
              </Button>
              <Link
                href={getExplorerUrl(tokenInfo.mintAddress, 'token')}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ display: 'flex', ml: 1 }}
              >
                <Launch sx={{ color: 'rgba(255,255,255,0.7)' }} />
              </Link>
            </Box>
          </Box>

          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" sx={{ color: 'rgba(255,255,255,0.9)', mb: 1, fontWeight: 'bold' }}>
              Token Account:
            </Typography>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              backgroundColor: 'rgba(255,255,255,0.05)',
              p: 2,
              borderRadius: 1,
              wordBreak: 'break-all'
            }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', flexGrow: 1 }}>
                {tokenInfo.tokenAccountAddress}
              </Typography>
              <Button
                size="small"
                onClick={() => handleCopyAddress(tokenInfo.tokenAccountAddress)}
                sx={{ minWidth: 'auto', ml: 1 }}
              >
                <ContentCopy sx={{ color: 'rgba(255,255,255,0.7)' }} />
              </Button>
              <Link
                href={getExplorerUrl(tokenInfo.tokenAccountAddress, 'address')}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ display: 'flex', ml: 1 }}
              >
                <Launch sx={{ color: 'rgba(255,255,255,0.7)' }} />
              </Link>
            </Box>
          </Box>
        </Paper>
      )}

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert 
          severity="error" 
          onClose={() => setError(null)}
          sx={{ 
            backgroundColor: 'rgba(211, 47, 47, 0.9)',
            color: 'white',
          }}
        >
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
      >
        <Alert 
          severity="success" 
          onClose={() => setSuccess(null)}
          sx={{ 
            backgroundColor: 'rgba(46, 125, 50, 0.9)',
            color: 'white',
          }}
        >
          {success}
        </Alert>
      </Snackbar>
    </>
  );
};
