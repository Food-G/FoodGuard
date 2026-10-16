import { useEffect, useRef } from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton, Stack, Typography, Box, Divider } from '@mui/material';
import { Html5Qrcode } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';
import IconifyIcon from './base/IconifyIcon';

interface DisplayQr {
  data: string;
  label: string;
}

interface QrScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
  title?: string;
  displayQrCodes?: DisplayQr[];
}

const QrScanner = ({ onScan, onClose, title = 'QR 코드 스캔', displayQrCodes }: QrScannerProps) => {
  const qrId = useRef('qr-scanner-' + Math.random().toString(36).slice(2));
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const id = qrId.current;
    let scanner: Html5Qrcode | null = null;

    // Dialog(Portal) 렌더링 완료 후 DOM 요소가 생길 때까지 대기
    const timer = setTimeout(() => {
      scanner = new Html5Qrcode(id);
      scannerRef.current = scanner;
      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          onScan(decodedText);
          scanner?.stop().catch(() => {});
        },
        () => {}
      ).catch(() => {});
    }, 300);

    return () => {
      clearTimeout(timer);
      scannerRef.current?.stop().catch(() => {});
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

          {displayQrCodes && displayQrCodes.length > 0 && (
            <>
              <Divider sx={{ width: '100%' }} />
              <Typography variant="caption" color="text.secondary" textAlign="center" fontWeight={600}>
                아래 QR 코드를 카메라로 스캔하세요
              </Typography>
              {displayQrCodes.map((qr, i) => (
                <Stack key={i} alignItems="center" gap={0.75}>
                  <Box sx={{ p: 1.5, border: '2px solid', borderColor: 'primary.main', borderRadius: 2, bgcolor: 'white' }}>
                    <QRCodeSVG value={qr.data} size={180} />
                  </Box>
                  <Typography variant="caption" fontWeight={700} color="primary.main">
                    {qr.label}
                  </Typography>
                </Stack>
              ))}
            </>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default QrScanner;
