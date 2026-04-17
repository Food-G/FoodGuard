import { teal, grey, stone } from './colors';

const palette = {
  primary: {
    main: teal[100],
    dark: teal[200],
    light: teal[50],
  },
  background: {
    default: stone[900],
    paper: grey[900],
  },
  text: {
    primary: stone[200],
    secondary: stone[500],
  },
  mode: 'dark' as const,
};

export default palette;
