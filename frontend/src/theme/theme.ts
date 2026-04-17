import { createTheme } from '@mui/material';
import palette from './palette';

const theme = createTheme({
  palette,
  typography: {
    fontFamily: ['Inter', 'sans-serif'].join(', '),
    h1: { fontSize: '2.5rem', fontWeight: 700 },
    h4: { fontSize: '1.5rem', fontWeight: 600 },
  },
  shape: {
    borderRadius: 8,
  },
});

export default theme;
