import { Theme } from '@mui/material';
import { Components } from '@mui/material/styles/components';

const Paper: Components<Omit<Theme, 'components'>>['MuiPaper'] = {
  defaultProps: { elevation: 0 },
  styleOverrides: {
    root: ({ theme }) => ({
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: theme.palette.background.paper,
      borderRadius: theme.shape.borderRadius * 2,
      border: `1px solid ${theme.palette.divider}`,
    }),
    elevation0: {
      boxShadow: 'none',
    },
    elevation1: {
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    },
    elevation2: {
      boxShadow: '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.05)',
    },
    elevation3: {
      boxShadow: '0 10px 15px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.05)',
    },
    elevation4: {
      boxShadow: '0 20px 25px rgba(0,0,0,0.1), 0 10px 10px rgba(0,0,0,0.04)',
    },
  },
};

export default Paper;
