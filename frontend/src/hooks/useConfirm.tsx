import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography,
} from '@mui/material';

interface ConfirmOptions {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  severity?: 'warning' | 'error' | 'info';
}

type ConfirmFn = (options: string | ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false));

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ message: '' });
  const [resolve, setResolve] = useState<(value: boolean) => void>(() => () => {});

  const confirm: ConfirmFn = useCallback((opts) => {
    const normalized = typeof opts === 'string' ? { message: opts } : opts;
    setOptions(normalized);
    setOpen(true);
    return new Promise<boolean>((res) => {
      setResolve(() => res);
    });
  }, []);

  const handleClose = (confirmed: boolean) => {
    setOpen(false);
    resolve(confirmed);
  };

  const confirmLabel = options.confirmLabel ?? '확인';
  const cancelLabel = options.cancelLabel ?? '취소';
  const confirmColor = options.severity === 'error' ? 'error' : 'primary';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={open} onClose={() => handleClose(false)} maxWidth="xs" fullWidth>
        <DialogTitle>확인</DialogTitle>
        <DialogContent>
          <Typography variant="body1">{options.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleClose(false)} color="inherit">{cancelLabel}</Button>
          <Button onClick={() => handleClose(true)} variant="contained" color={confirmColor}>
            {confirmLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext);
}
