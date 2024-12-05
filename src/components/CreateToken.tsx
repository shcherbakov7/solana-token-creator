import { FC, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  createSetAuthorityInstruction,
  AuthorityType,
} from '@solana/spl-token';
import { Keypair, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
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
} from '@mui/material';

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
          programId: SystemProgram.programId,
        })
      );

      createAccountTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      createAccountTx.feePayer = publicKey;

      // Sign transaction
      const signedTx = await signTransaction(createAccountTx);
      signedTx.partialSign(mintKeypair);

      // Send and confirm transaction
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature);

      // Initialize mint
      await createMint(
        connection,
        {
          publicKey: publicKey,
          secretKey: mintKeypair.secretKey,
        },
        publicKey,
        publicKey,
        Number(decimals)
      );

      // Get token account
      const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        {
          publicKey: publicKey,
          secretKey: mintKeypair.secretKey,
        },
        mintKeypair.publicKey,
        publicKey
      );

      // Mint initial supply
      await mintTo(
        connection,
        {
          publicKey: publicKey,
          secretKey: mintKeypair.secretKey,
        },
        mintKeypair.publicKey,
        tokenAccount.address,
        mintKeypair,
        1000000000000 // Initial supply
      );

      // If revokeFreeze is true, remove freeze authority
      if (revokeFreeze) {
        const instruction = createSetAuthorityInstruction(
          mintKeypair.publicKey, // mint account
          publicKey, // current authority
          AuthorityType.FreezeAccount, // authority type
          null // new authority (null to remove)
        );

        const transaction = new Transaction().add(instruction);
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        transaction.feePayer = publicKey;

        const signedTransaction = await signTransaction(transaction);
        const revokeSignature = await connection.sendRawTransaction(signedTransaction.serialize());
        await connection.confirmTransaction(revokeSignature);
      }

      setSuccess('Token created successfully!');
      console.log('Mint address:', mintKeypair.publicKey.toString());
      console.log('Token account:', tokenAccount.address.toString());

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
    </Paper>
  );
};
