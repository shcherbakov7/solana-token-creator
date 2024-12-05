import { FC } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export const WalletConnectButton: FC = () => {
  return (
    <WalletMultiButton 
      style={{
        background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
        border: 0,
        borderRadius: 8,
        boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
        color: 'white',
        height: '40px',
        padding: '0 30px',
        textTransform: 'none',
        fontSize: '1rem',
        fontWeight: 500,
      }}
    />
  );
};
