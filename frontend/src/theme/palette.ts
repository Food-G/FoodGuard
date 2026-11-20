import { PaletteOptions } from '@mui/material/styles';
import { grey } from './colors';

export const palette: PaletteOptions = {
  mode: 'light',
  primary: {
    light: '#E9F1ED',
    main: '#1F4D3A', // 진한 숲 초록 (브랜드)
    dark: '#153829',
    contrastText: '#FFFFFF',
  },
  secondary: {
    light: '#EAF3EE',
    main: '#3D7A5E', // 밝은 숲 초록 (보조)
    dark: '#2C5A45',
    contrastText: '#FFFFFF',
  },
  info: {
    light: '#EAF2FA',
    main: '#2F6FA8',
    dark: '#22547F',
  },
  success: {
    light: '#E8F5EC',
    main: '#2E8A57',
    dark: '#216640',
  },
  warning: {
    light: '#FDF3E3',
    main: '#E08A1E', // 폐기 위험·임박 경고 (주황)
    dark: '#B86C0E',
  },
  error: {
    light: '#FDECEA',
    main: '#D9483B',
    dark: '#A8322A',
  },
  background: {
    default: '#F2F4F3', // 연회색 바탕 위에 흰 카드
    paper: '#FFFFFF',
  },
  text: {
    primary: '#191F28',
    secondary: '#6B7684',
    disabled: '#B0B8C1',
  },
  divider: '#E5E8EB',
  grey: grey,
};
