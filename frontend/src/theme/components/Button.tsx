import { Theme } from '@mui/material';
import { Components } from '@mui/material/styles/components';

const Button: Components<Omit<Theme, 'components'>>['MuiButton'] = {
  defaultProps: {
    variant: 'contained',
    size: 'medium',
    disableElevation: true,
  },
  styleOverrides: {
    root: ({ theme }) => ({
      borderRadius: theme.shape.borderRadius * 1.5,
      textTransform: 'none',
      fontWeight: 600,
    }),
    // 보조 버튼은 연회색 면 + 진한 글씨 (주 행동만 초록으로 눈에 띄게)
    outlinedPrimary: ({ theme }) => ({
      color: theme.palette.text.primary,
      borderColor: 'transparent',
      backgroundColor: '#F2F4F6',
      '&:hover': {
        borderColor: 'transparent',
        backgroundColor: '#E5E8EB',
      },
    }),
    sizeSmall: ({ theme }) => ({
      padding: theme.spacing(1.5, 3),
      fontSize: theme.typography.pxToRem(14),
    }),
    sizeMedium: ({ theme }) => ({
      padding: theme.spacing(2.75, 5),
      fontSize: theme.typography.pxToRem(15),
    }),
    sizeLarge: ({ theme }) => ({
      padding: theme.spacing(2.5, 6),
      fontSize: theme.typography.h5.fontSize,
      fontWeight: theme.typography.h5.fontWeight,
    }),
    disabled: ({ theme }) => ({
      backgroundColor: theme.palette.action.disabled,
    }),
  },
};

export default Button;
