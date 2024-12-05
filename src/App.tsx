import { FC } from 'react';
import { 
  Container, 
  CssBaseline, 
  AppBar, 
  Toolbar, 
  Typography, 
  Box,
  ThemeProvider,
  createTheme,
} from '@mui/material';
import { WalletContextProvider } from './contexts/WalletContextProvider';
import { WalletConnectButton } from './components/WalletConnectButton';
import { CreateToken } from './components/CreateToken';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#3f51b5',
    },
    secondary: {
      main: '#f50057',
    },
    background: {
      default: '#121212',
      paper: '#1E1E1E',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontSize: '1rem',
          padding: '10px 20px',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
          boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
        },
      },
    },
  },
});

const App: FC = () => {
  return (
    <ThemeProvider theme={darkTheme}>
      <WalletContextProvider>
        <CssBaseline />
        <Box 
          sx={{ 
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #1E1E1E 0%, #2D2D2D 100%)',
          }}
        >
          <AppBar position="static" elevation={0}>
            <Toolbar>
              <Typography 
                variant="h5" 
                component="div" 
                sx={{ 
                  flexGrow: 1,
                  fontWeight: 600,
                  background: 'linear-gradient(45deg, #FFF 30%, #A5D6FF 90%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Solana Token Creator
              </Typography>
              <WalletConnectButton />
            </Toolbar>
          </AppBar>
          <Container 
            sx={{ 
              mt: 4,
              pb: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <CreateToken />
          </Container>
        </Box>
      </WalletContextProvider>
    </ThemeProvider>
  );
};

export default App;
