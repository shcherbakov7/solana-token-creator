import { FC, useState, useEffect } from 'react';
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
  clusterApiUrl
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
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
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
    return `https://explorer.solana.com/${type}/${address}?cluster=devnet`;
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
        // Calculate rent-exempt balance
        const lamports = await connection.getMinimumBalanceForRentExemption(82);
        
        // Get associated token account address
        const associatedTokenAddress = await getAssociatedTokenAddress(
          mintKeypair.publicKey,
          publicKey
        );

        // Create a single transaction with all instructions
        const transaction = new Transaction();

        // Add create account instruction
        transaction.add(
          SystemProgram.createAccount({
            fromPubkey: publicKey,
            newAccountPubkey: mintKeypair.publicKey,
            space: 82,
            lamports,
            programId: TOKEN_PROGRAM_ID,
          })
        );

        // Add initialize mint instruction
        transaction.add(
          createInitializeMintInstruction(
            mintKeypair.publicKey,
            Number(decimals),
            publicKey,
            publicKey,
            TOKEN_PROGRAM_ID
          )
        );

        // Add create associated token account instruction
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            associatedTokenAddress,
            publicKey,
            mintKeypair.publicKey,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );

        // Add mint to instruction
        transaction.add(
          createMintToInstruction(
            mintKeypair.publicKey,
            associatedTokenAddress,
            publicKey,
            1000000000000,
            [],
            TOKEN_PROGRAM_ID
          )
        );

        // Add revoke freeze authority instruction if needed
        if (revokeFreeze) {
          transaction.add(
            createSetAuthorityInstruction(
              mintKeypair.publicKey,
              publicKey,
              AuthorityType.FreezeAccount,
              null,
              [],
              TOKEN_PROGRAM_ID
            )
          );
        }

        // Set recent blockhash and fee payer
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        transaction.feePayer = publicKey;
        
        // Sign with mint keypair
        transaction.sign(mintKeypair);

        // Sign with wallet
        const signedTx = await signTransaction(transaction);

        // Send and confirm transaction
        const signature = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(signature);

        console.log('Token created successfully:', {
          mintAddress: mintKeypair.publicKey.toString(),
          tokenAccountAddress: associatedTokenAddress.toString()
        });
        
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

      } catch (txError) {
        if (txError.message.includes('User rejected')) {
          setError('Transaction was rejected in wallet. Please approve the transaction to create the token.');
        } else {
          setError(`Transaction failed: ${txError.message}`);
        }
        console.error('Transaction error:', txError);
      }

    } catch (err) {
      console.error('Error creating token:', err);
      setError(err instanceof Error ? err.message : 'Failed to create token');
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
