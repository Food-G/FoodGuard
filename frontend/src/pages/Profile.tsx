import React, { useState, useRef } from 'react';
import {
  Box, Typography, Paper, Stack, Avatar, Button, TextField,
  Divider, Chip, Alert, IconButton,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { decodeToken } from '../utils/jwt';
import IconifyIcon from '../components/base/IconifyIcon';

const PHOTO_KEY = 'profile_photo';
const NAME_KEY = 'profile_name';

const roleLabel: Record<string, { label: string; color: any }> = {
  OWNER: { label: '점주', color: 'primary' },
  HQ_ADMIN: { label: '본사 관리자', color: 'success' },
};

const Profile = () => {
  const navigate = useNavigate();
  const token = authService.getToken();
  const decoded = token ? decodeToken(token) : null;
  const email: string = decoded?.sub ?? '';
  const role: string = decoded?.role ?? '';

  const [photo, setPhoto] = useState<string>(() => localStorage.getItem(PHOTO_KEY) ?? '');
  const [displayName, setDisplayName] = useState(() => localStorage.getItem(NAME_KEY) ?? '');
  const [editName, setEditName] = useState(false);
  const [tempName, setTempName] = useState(displayName);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMsg('사진 파일은 2MB 이하여야 합니다.');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const result = ev.target?.result as string;
      setPhoto(result);
      localStorage.setItem(PHOTO_KEY, result);
      setMsg('프로필 사진이 변경되었습니다.');
      setTimeout(() => setMsg(''), 2000);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveName = () => {
    setDisplayName(tempName);
    localStorage.setItem(NAME_KEY, tempName);
    setEditName(false);
    setMsg('이름이 저장되었습니다.');
    setTimeout(() => setMsg(''), 2000);
  };

  const handleRemovePhoto = () => {
    setPhoto('');
    localStorage.removeItem(PHOTO_KEY);
    setMsg('프로필 사진이 삭제되었습니다.');
    setTimeout(() => setMsg(''), 2000);
  };

  return (
    <Box maxWidth={560}>
      <Stack direction="row" alignItems="center" gap={1} mb={0.5}>
        <Button
          startIcon={<IconifyIcon icon="mingcute:arrow-left-line" />}
          onClick={() => navigate(-1)}
          sx={{ borderRadius: 2 }}
        >
          뒤로가기
        </Button>
      </Stack>

      <Box mb={3}>
        <Typography variant="h2" color="primary.main" fontWeight={800}>내 프로필</Typography>
        <Typography variant="body2" color="text.secondary">계정 정보를 확인하고 수정하세요</Typography>
      </Box>

      {msg && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>{msg}</Alert>}

      {/* Photo section */}
      <Paper sx={{ p: 4, borderRadius: 3, mb: 3 }}>
        <Stack alignItems="center" gap={3}>
          <Box sx={{ position: 'relative' }}>
            <Avatar
              src={photo || undefined}
              sx={{ width: 120, height: 120, bgcolor: 'primary.main', fontSize: 40, cursor: 'pointer', border: '4px solid', borderColor: 'primary.light' }}
              onClick={() => fileRef.current?.click()}
            >
              {!photo && (displayName ? displayName[0].toUpperCase() : email[0]?.toUpperCase() ?? 'U')}
            </Avatar>
            <IconButton
              size="small"
              sx={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                bgcolor: 'primary.main',
                color: 'white',
                '&:hover': { bgcolor: 'primary.dark' },
                width: 32,
                height: 32,
              }}
              onClick={() => fileRef.current?.click()}
            >
              <IconifyIcon icon="mingcute:camera-fill" width={16} />
            </IconButton>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoChange}
            />
          </Box>
          <Stack direction="row" gap={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<IconifyIcon icon="mingcute:upload-2-line" />}
              onClick={() => fileRef.current?.click()}
              sx={{ borderRadius: 2 }}
            >
              사진 변경
            </Button>
            {photo && (
              <Button
                variant="outlined"
                size="small"
                color="error"
                onClick={handleRemovePhoto}
                sx={{ borderRadius: 2 }}
              >
                삭제
              </Button>
            )}
          </Stack>
          <Typography variant="caption" color="text.disabled">
            JPG, PNG (최대 2MB)
          </Typography>
        </Stack>
      </Paper>

      {/* Info section */}
      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={700} mb={2.5}>계정 정보</Typography>

        <Stack gap={2.5}>
          {/* Display name */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.75 }}>
              표시 이름
            </Typography>
            {editName ? (
              <Stack direction="row" gap={1}>
                <TextField
                  value={tempName}
                  onChange={e => setTempName(e.target.value)}
                  size="small"
                  fullWidth
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                />
                <Button variant="contained" size="small" onClick={handleSaveName} sx={{ borderRadius: 2 }}>저장</Button>
                <Button variant="outlined" size="small" onClick={() => setEditName(false)} sx={{ borderRadius: 2 }}>취소</Button>
              </Stack>
            ) : (
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography variant="body1" fontWeight={600}>
                  {displayName || '(미설정)'}
                </Typography>
                <IconButton size="small" onClick={() => { setTempName(displayName); setEditName(true); }}>
                  <IconifyIcon icon="mingcute:edit-2-line" width={16} />
                </IconButton>
              </Stack>
            )}
          </Box>

          <Divider />

          {/* Email */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.75 }}>
              이메일
            </Typography>
            <Stack direction="row" alignItems="center" gap={1}>
              <IconifyIcon icon="mingcute:mail-line" color="text.disabled" width={18} />
              <Typography variant="body1" color="text.primary">{email}</Typography>
            </Stack>
          </Box>

          <Divider />

          {/* Role */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.75 }}>
              역할
            </Typography>
            <Chip
              label={roleLabel[role]?.label ?? role}
              color={roleLabel[role]?.color ?? 'default'}
              variant="outlined"
              size="medium"
              icon={<IconifyIcon icon="mingcute:user-crown-line" />}
            />
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
};

export default Profile;
