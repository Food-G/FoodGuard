import React, { createContext, useContext, ReactNode } from 'react';
import { useMediaQuery, Theme } from '@mui/material';

const BreakpointContext = createContext({
  up: (key: any) => false,
  down: (key: any) => false,
});

export const BreakpointsProvider = ({ children }: { children: ReactNode }) => {
  const up = (key: any) => useMediaQuery<Theme>((theme) => theme.breakpoints.up(key));
  const down = (key: any) => useMediaQuery<Theme>((theme) => theme.breakpoints.down(key));

  return (
    <BreakpointContext.Provider value={{ up, down }}>
      {children}
    </BreakpointContext.Provider>
  );
};

export const useBreakpoints = () => useContext(BreakpointContext);
export default BreakpointsProvider;
