import { PaletteOptions } from '@mui/material/styles';
import { grey } from './colors';

export const palette: PaletteOptions = {
  mode: 'light',
  primary: {
    light: '#E8F5F1',
    main: '#1D9E75', // Emerald Green
    dark: '#147A5A',
    contrastText: '#FFFFFF',
  },
  secondary: {
    light: '#E8EBF5',
    main: '#2D3A6E', // Navy (공공 포털형 시안의 보조색)
    dark: '#1F2B5B',
    contrastText: '#FFFFFF',
  },
  info: {
    light: '#E0F2F1',
    main: '#00897B',
    dark: '#00695C',
  },
  success: {
    light: '#E8F5E9',
    main: '#43A047',
    dark: '#2E7D32',
  },
  warning: {
    light: '#FFF8E1',
    main: '#FFB300',
    dark: '#FFA000',
  },
  error: {
    light: '#FFEBEE',
    main: '#E53935',
    dark: '#B71C1C',
  },
  background: {
    default: '#FFFFFF', // Pure white background
    paper: '#FFFFFF',
  },
  text: {
    primary: '#1A1C1E', // Very dark grey for readability
    secondary: '#44474E',
    disabled: '#8E9199',
  },
  divider: '#C4C7CF',
  grey: grey,
};
