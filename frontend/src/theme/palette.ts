import { PaletteOptions } from '@mui/material/styles';

export const palette: PaletteOptions = {
  mode: 'light',
  primary: {
    main: '#2E7D32', // Forest Green
    light: '#4CAF50',
    dark: '#1B5E20',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: '#81C784', // Light Sage
    light: '#A5D6A7',
    dark: '#66BB6A',
    contrastText: '#000000',
  },
  info: {
    main: '#00796B', // Teal Green
    light: '#4DB6AC',
    dark: '#004D40',
  },
  success: {
    main: '#43A047',
    light: '#81C784',
    dark: '#2E7D32',
  },
  warning: {
    main: '#FFB300', // Earthy Yellow
    light: '#FFD54F',
    dark: '#FF8F00',
  },
  error: {
    main: '#D32F2F',
  },
  background: {
    default: '#F1F8E9',
    paper: '#FFFFFF',
  },
  text: {
    primary: '#1B5E20',
    secondary: '#4E6E4E',
  },
  divider: '#C8E6C9',
};
