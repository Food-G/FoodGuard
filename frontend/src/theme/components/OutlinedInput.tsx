import { Theme } from '@mui/material';
import { Components } from '@mui/material/styles/components';

const OutlinedInput: Components<Omit<Theme, 'components'>>['MuiOutlinedInput'] = {
  defaultProps: { autoComplete: 'off' },
  styleOverrides: {
    root: ({ theme }) => ({
      paddingLeft: 0,
      borderRadius: theme.shape.borderRadius * 2.5,
      backgroundColor: theme.palette.background.paper,
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: theme.palette.text.disabled,
        borderWidth: 1,
      },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: theme.palette.primary.main,
        borderWidth: 1.5,
      },
      '&.MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline > legend': {
        width: 0,
      },
    }),
    input: ({ theme }) => ({
      marginLeft: theme.spacing(3),
      color: theme.palette.common.black,
      '&::placeholder': {
        opacity: 1,
        color: theme.palette.text.secondary,
      },
    }),
    notchedOutline: ({ theme }) => ({
      borderColor: '#D1D6DB',
      '&:hover': {
        borderColor: theme.palette.text.secondary,
      },
    }),
  },
};

export default OutlinedInput;
