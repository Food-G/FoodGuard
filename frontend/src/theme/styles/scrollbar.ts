import { Theme } from '@mui/material';

const scrollbar = (theme: Theme) => ({
  '@supports (-moz-appearance:none)': {
    scrollbarColor: `${theme.palette.text.disabled} transparent`,
  },
  '*::-webkit-scrollbar': {
    visibility: 'hidden',
    WebkitAppearance: 'none',
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
  },
  '*::-webkit-scrollbar-thumb': {
    visbility: 'hidden',
    borderRadius: 3,
    backgroundColor: theme.palette.text.disabled,
  },
  '&:hover, &:focus': {
    '*::-webkit-scrollbar, *::-webkit-scrollbar-thumb': {
      visibility: 'visible',
    },
  },
});

export default scrollbar;
