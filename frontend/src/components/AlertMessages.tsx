import { Alert, Stack } from '@mui/material';

interface AlertMessagesProps {
  error?: string;
  success?: string;
  onClearError?: () => void;
  onClearSuccess?: () => void;
}

const AlertMessages = ({ error, success, onClearError, onClearSuccess }: AlertMessagesProps) => (
  <Stack gap={1}>
    {error && <Alert severity="error" onClose={onClearError}>{error}</Alert>}
    {success && <Alert severity="success" onClose={onClearSuccess}>{success}</Alert>}
  </Stack>
);

export default AlertMessages;
