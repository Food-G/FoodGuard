import { Theme } from '@mui/material';
import { Components } from '@mui/material/styles/components';

const Button: Components<Omit<Theme, 'components'>>['MuiButton'] = {
  defaultProps: {
    variant: 'contained',
    size: 'medium',
  },
  styleOverrides: {
    root: ({ theme }) => ({
      borderRadius: theme.shape.borderRadius,
      boxShadow: 'none',
      textTransform: 'none',
    }),
    // 공공 포털형 시안에 맞춰 버튼을 작고 단정하게
    sizeSmall: () => ({
      padding: '5px 12px',
      fontSize: '0.8125rem',
      fontWeight: 600,
    }),
    sizeMedium: () => ({
      padding: '8px 18px',
      fontSize: '0.875rem',
      fontWeight: 700,
    }),
    sizeLarge: () => ({
      padding: '11px 24px',
      fontSize: '0.9375rem',
      fontWeight: 700,
    }),
    disabled: ({ theme }) => ({
      backgroundColor: theme.palette.action.disabled,
    }),
  },
};

export default Button;
