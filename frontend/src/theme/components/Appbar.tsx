import { Theme } from '@mui/material';
import { Components } from '@mui/material/styles/components';

const AppBar: Components<Omit<Theme, 'components'>>['MuiAppBar'] = {
  defaultProps: {},
  styleOverrides: {
    root: ({ theme }) => ({
      boxShadow: 'none',
      backgroundColor: '#FFFFFF',
      borderBottom: `1px solid ${theme.palette.divider}`,
    }),
  },
};

export default AppBar;
