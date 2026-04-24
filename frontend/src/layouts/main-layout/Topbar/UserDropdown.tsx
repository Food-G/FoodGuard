import { Menu, Avatar, Button, Tooltip, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';
import { useState, MouseEvent, useCallback, ReactElement } from 'react';

interface UserDropdownProps {
  onLogout: () => void;
}

const UserDropdown = ({ onLogout }: UserDropdownProps): ReactElement => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const handleUserClick = useCallback((event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleUserClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleLogout = () => {
    handleUserClose();
    onLogout();
  };

  const userMenuItems = [
    { id: 1, title: '내 프로필', icon: 'mingcute:user-2-fill', color: 'text.primary' },
    { id: 2, title: '설정', icon: 'material-symbols:settings-account-box-rounded', color: 'text.primary' },
    { id: 3, title: '로그아웃', icon: 'material-symbols:logout', color: 'error.main', onClick: handleLogout },
  ];

  return (
    <>
      <Button
        color="inherit"
        variant="text"
        id="account-dropdown-menu"
        aria-controls={menuOpen ? 'account-dropdown-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={menuOpen ? 'true' : undefined}
        onClick={handleUserClick}
        disableRipple
        sx={{
          borderRadius: 2,
          gap: 3.75,
          px: { xs: 0, sm: 0.625 },
          py: 0.625,
          '&:hover': {
            bgcolor: 'transparent',
          },
        }}
      >
        <Tooltip title="Account" arrow placement="bottom">
          <Avatar sx={{ width: 44, height: 44, bgcolor: 'primary.main' }}>FG</Avatar>
        </Tooltip>
        <IconifyIcon
          color="common.white"
          icon="mingcute:down-fill"
          width={22.5}
          height={22.5}
          sx={(theme) => ({
            transform: menuOpen ? `rotate(180deg)` : `rotate(0deg)`,
            transition: theme.transitions.create('all', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.short,
            }),
          })}
        />
      </Button>
      <Menu
        id="account-dropdown-menu"
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleUserClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {userMenuItems.map((item) => (
          <MenuItem key={item.id} onClick={item.onClick || handleUserClose}>
            <ListItemIcon
              sx={{
                minWidth: `0 !important`,
                color: item.color,
                width: 14,
                height: 10,
                mb: 1.5,
                mr: 2
              }}
            >
              <IconifyIcon icon={item.icon} color={item.color} />
            </ListItemIcon>
            <ListItemText
              sx={(theme) => ({
                color: item.color,
                '& .MuiListItemText-primary': {
                  fontSize: theme.typography.subtitle2.fontSize,
                  fontWeight: theme.typography.subtitle2.fontWeight,
                },
              })}
            >
              {item.title}
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default UserDropdown;
