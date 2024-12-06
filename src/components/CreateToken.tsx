import { FC, useState } from 'react';
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
} from '@solana/spl-token';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
  const [openDialog, setOpenDialog] = useState(false);

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setSuccess('Address copied to clipboard!');
  };

  const getExplorerUrl = (address: string, type: 'token' | 'address') => {
    const baseUrl = 'https://explorer.solana.com';
    const networkParam = connection.rpcEndpoint.includes('devnet') ? '?cluster=devnet' : '';
    return `${baseUrl}/${type}/${address}${networkParam}`;
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

      // Create mint account
      const mintKeypair = Keypair.generate();
      
      // Calculate rent-exempt balance
      const lamports = await connection.getMinimumBalanceForRentExemption(82);
      
      // Create account transaction
      const createAccountTx = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: 82,
          lamports,
          programId: TOKEN_PROGRAM_ID,
        })
      );

      createAccountTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      createAccountTx.feePayer = publicKey;
      createAccountTx.sign(mintKeypair);

      // Sign transaction with wallet
      const signedTx = await signTransaction(createAccountTx);

      // Send and confirm transaction
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature);

      // Initialize mint
      const initMintTx = new Transaction().add(
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          Number(decimals),
          publicKey,
          publicKey,
          TOKEN_PROGRAM_ID
        )
      );

      initMintTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      initMintTx.feePayer = publicKey;

      // Sign transaction with wallet
      const signedInitMintTx = await signTransaction(initMintTx);

      // Send and confirm transaction
      const initMintSignature = await connection.sendRawTransaction(signedInitMintTx.serialize());
      await connection.confirmTransaction(initMintSignature);

      // Get associated token account address
      const associatedTokenAddress = await getAssociatedTokenAddress(
        mintKeypair.publicKey,
        publicKey
      );

      // Create associated token account
      const createAtaTx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          publicKey,
          associatedTokenAddress,
          publicKey,
          mintKeypair.publicKey,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );

      createAtaTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      createAtaTx.feePayer = publicKey;

      // Sign transaction with wallet
      const signedAtaTx = await signTransaction(createAtaTx);

      // Send and confirm transaction
      const ataSignature = await connection.sendRawTransaction(signedAtaTx.serialize());
      await connection.confirmTransaction(ataSignature);

      // Mint initial supply
      const mintToTx = new Transaction().add(
        createMintToInstruction(
          mintKeypair.publicKey,
          associatedTokenAddress,
          publicKey,
          1000000000000,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      mintToTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      mintToTx.feePayer = publicKey;

      // Sign transaction with wallet
      const signedMintToTx = await signTransaction(mintToTx);

      // Send and confirm transaction
      const mintToSignature = await connection.sendRawTransaction(signedMintToTx.serialize());
      await connection.confirmTransaction(mintToSignature);

      // If revokeFreeze is true, remove freeze authority
      if (revokeFreeze) {
        const revokeTx = new Transaction().add(
          createSetAuthorityInstruction(
            mintKeypair.publicKey,
            publicKey,
            AuthorityType.FreezeAccount,
            null,
            [],
            TOKEN_PROGRAM_ID
          )
        );

        revokeTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        revokeTx.feePayer = publicKey;

        // Sign transaction with wallet
        const signedRevokeTx = await signTransaction(revokeTx);

        // Send and confirm transaction
        const revokeSignature = await connection.sendRawTransaction(signedRevokeTx.serialize());
        await connection.confirmTransaction(revokeSignature);
      }

      setSuccess('Token created successfully!');
      console.log('Token created:', {
        mintAddress: mintKeypair.publicKey.toString(),
        tokenAccountAddress: associatedTokenAddress.toString()
      });
      
      setTokenInfo({
        mintAddress: mintKeypair.publicKey.toString(),
        tokenAccountAddress: associatedTokenAddress.toString(),
      });
      console.log('Setting openDialog to true');
      setOpenDialog(true);
      console.log('Current openDialog state:', openDialog);

      // Reset form
      setTokenName('');
      setTokenSymbol('');
      setDecimals('9');
      setRevokeFreeze(false);
    } catch (err) {
      console.error('Error creating token:', err);
      setError(err instanceof Error ? err.message : 'Failed to create token');
    } finally {
      setLoading(false);
    }
  };

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
          zIndex: 1
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

      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)}
        sx={{ zIndex: 9999 }}
        PaperProps={{
          sx: {
            background: 'linear-gradient(145deg, rgba(30,30,30,0.95) 0%, rgba(45,45,45,0.95) 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
            minWidth: '400px',
            zIndex: 9999
          }
        }}
      >
        <DialogTitle sx={{ color: '#2196F3', fontWeight: 'bold', fontSize: '1.5rem' }}>Token Created Successfully!</DialogTitle>
        <DialogContent>
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
                {tokenInfo?.mintAddress}
              </Typography>
              <Button
                size="small"
                onClick={() => handleCopyAddress(tokenInfo?.mintAddress || '')}
                sx={{ minWidth: 'auto', ml: 1 }}
              >
                <ContentCopy sx={{ color: 'rgba(255,255,255,0.7)' }} />
              </Button>
              <Link
                href={getExplorerUrl(tokenInfo?.mintAddress || '', 'token')}
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
                {tokenInfo?.tokenAccountAddress}
              </Typography>
              <Button
                size="small"
                onClick={() => handleCopyAddress(tokenInfo?.tokenAccountAddress || '')}
                sx={{ minWidth: 'auto', ml: 1 }}
              >
                <ContentCopy sx={{ color: 'rgba(255,255,255,0.7)' }} />
              </Button>
              <Link
                href={getExplorerUrl(tokenInfo?.tokenAccountAddress || '', 'address')}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ display: 'flex', ml: 1 }}
              >
                <Launch sx={{ color: 'rgba(255,255,255,0.7)' }} />
              </Link>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setOpenDialog(false)}
            variant="contained"
            sx={{ 
              color: 'white',
              background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
              '&:hover': {
                background: 'linear-gradient(45deg, #1E88E5 30%, #1CB5E0 90%)',
              },
              m: 2
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

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
