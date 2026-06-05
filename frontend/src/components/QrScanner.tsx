import { useEffect, useRef } from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton, Stack, Typography, Box } from '@mui/material';
import { Html5Qrcode } from 'html5-qrcode';
import IconifyIcon from './base/IconifyIcon';

interface QrScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
  title?: string;
}

const QrScanner = ({ onScan, onClose, title = 'QR 코드 스캔' }: QrScannerProps) => {
  const qrId = useRef('qr-scanner-' + Math.random().toString(36).slice(2));
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const id = qrId.current;
    const scanner = new Html5Qrcode(id);
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        onScan(decodedText);
        scanner.stop().catch(() => {});
      },
      () => {}
    ).catch(() => {});

    return () => {
      scanner.stop().catch(() => {}).finally(() => {
        try { scanner.clear(); } catch {}
      });
    };
  }, []);

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography fontWeight={700}>{title}</Typography>
          <IconButton size="small" onClick={onClose}>
            <IconifyIcon icon="mingcute:close-line" width={18} />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack gap={1.5} alignItems="center">
          <Typography variant="body2" color="text.secondary" textAlign="center">
            카메라를 QR 코드에 맞춰주세요
          </Typography>
          <Box id={qrId.current} sx={{ width: '100%' }} />
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default QrScanner;
