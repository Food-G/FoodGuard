import { Dialog, DialogTitle, DialogContent, IconButton, Stack, Typography, Button, Box } from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import IconifyIcon from './base/IconifyIcon';

interface QrCodeDisplayProps {
  data: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
}

const QrCodeDisplay = ({ data, title = 'QR 코드', subtitle, onClose }: QrCodeDisplayProps) => {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><body style="display:flex;justify-content:center;align-items:center;height:100vh;">
        <div id="qr-print"></div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

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
        <Stack gap={2} alignItems="center">
          {subtitle && (
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {subtitle}
            </Typography>
          )}
          <Box sx={{ p: 2, border: '2px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'white' }}>
            <QRCodeSVG value={data} size={220} />
          </Box>
          <Typography variant="caption" color="text.secondary" textAlign="center">
            배달기사/가맹점주가 이 QR 코드를 스캔하여 검수 완료 처리합니다
          </Typography>
          <Button variant="outlined" size="small" startIcon={<IconifyIcon icon="mingcute:print-line" width={16} />}
            onClick={handlePrint}>
            인쇄
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default QrCodeDisplay;
