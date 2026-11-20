import { Theme } from '@mui/material';
import { Components } from '@mui/material/styles/components';
import pxToRem from 'theme/functions/px-to-rem';

const TableCell: Components<Omit<Theme, 'components'>>['MuiTableCell'] = {
  defaultProps: {},
  styleOverrides: {
    root: ({ theme }) => ({
      paddingTop: theme.spacing(3),
      paddingBottom: theme.spacing(3),
      borderBottomWidth: pxToRem(0.5),
      borderBottomStyle: 'solid',
      borderBottomColor: theme.palette.divider,
    }),
    head: ({ theme }) => ({
      fontSize: '0.8125rem',
      fontWeight: 700,
      color: theme.palette.text.secondary,
      backgroundColor: '#F6F7FA',
      borderTop: `1px solid ${theme.palette.divider}`,
      lineHeight: '20px',
    }),
    body: ({ theme }) => ({
      fontSize: '0.875rem',
      fontWeight: 500,
      color: theme.palette.text.primary,
      lineHeight: '20px',
    }),
  },
};

export default TableCell;
