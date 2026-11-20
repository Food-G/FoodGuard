import { Theme } from '@mui/material';
import { Components } from '@mui/material/styles/components';
import pxToRem from 'theme/functions/px-to-rem';

const TableCell: Components<Omit<Theme, 'components'>>['MuiTableCell'] = {
  defaultProps: {},
  styleOverrides: {
    root: ({ theme }) => ({
      paddingTop: theme.spacing(3.125),
      paddingBottom: theme.spacing(3.125),
      borderBottomWidth: pxToRem(0.5),
      borderBottomStyle: 'solid',
      borderBottomColor: theme.palette.divider,
    }),
    head: ({ theme }) => ({
      fontSize: theme.typography.pxToRem(13),
      fontWeight: 600,
      color: theme.palette.text.secondary,
      lineHeight: '20px',
    }),
    body: ({ theme }) => ({
      fontSize: theme.typography.pxToRem(15),
      fontWeight: theme.typography.body1.fontWeight,
      color: theme.palette.text.primary,
      lineHeight: '20px',
    }),
  },
};

export default TableCell;
