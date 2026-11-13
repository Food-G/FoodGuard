import { Theme } from '@mui/material';
import { Components } from '@mui/material/styles/components';

// Paper 오버라이드(flexDirection: column)를 Alert 도 물려받아 아이콘과 문구가 세로로 쌓이므로 가로로 되돌린다
const Alert: Components<Omit<Theme, 'components'>>['MuiAlert'] = {
  styleOverrides: {
    root: {
      flexDirection: 'row',
      alignItems: 'center',
    },
  },
};

export default Alert;
