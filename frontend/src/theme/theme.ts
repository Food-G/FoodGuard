import { createTheme } from '@mui/material/styles';
import { palette } from './palette';
import typography from './typography';
import components from './component-overrides';
import breakpoints from './breakpoints';
import { shape } from './shape';
import { spacing } from './spacing';

const theme = createTheme({
  palette,
  typography,
  breakpoints,
  shape,
  spacing,
  components,
});

export default theme;
