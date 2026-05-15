import { Link, ListItem, ListItemButton, ListItemIcon, ListItemText, Stack } from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';
import { useLocation } from 'react-router-dom';

interface NavItemProps {
  navItem: {
    title: string;
    path: string;
    icon: string;
    active: boolean;
    extraIcon?: string;
    blackIcon?: boolean;   // force black color for all icons in this item
  };
  open: boolean;
  onClick?: () => void;
}

const NavItem = ({ navItem, open, onClick }: NavItemProps) => {
  const { pathname } = useLocation();
  const isActive = pathname === navItem.path;

  // black-forced items always use #111; otherwise follow active/open logic
  const iconColor = navItem.blackIcon
    ? '#111111'
    : isActive
      ? open ? 'background.default' : 'primary.main'
      : 'text.primary';

  return (
    <ListItem
      disablePadding
      sx={(theme) => ({
        display: 'block',
        px: 5,
        borderRight: !open
          ? isActive
            ? `3px solid ${theme.palette.primary.main}`
            : '3px solid transparent'
          : '',
      })}
    >
      <ListItemButton
        component={Link}
        href={navItem.path}
        onClick={onClick}
        sx={{
          opacity: navItem.active ? 1 : 0.5,
          bgcolor: isActive && !navItem.blackIcon ? (open ? 'primary.main' : '') : 'background.default',
          '&:hover': {
            bgcolor: isActive && !navItem.blackIcon
              ? open ? 'primary.dark' : 'background.paper'
              : 'background.paper',
          },
          '& .MuiTouchRipple-root': {
            color: isActive ? 'primary.main' : 'text.disabled',
          },
        }}
      >
        <ListItemIcon
          sx={{
            width: navItem.extraIcon ? 'auto' : 20,
            height: 20,
            mr: open ? 'auto' : 0,
            color: iconColor,
            minWidth: 0,
          }}
        >
          {navItem.extraIcon ? (
            <Stack direction="row" alignItems="center" gap={0.5}>
              <IconifyIcon icon={navItem.icon} width={20} height={20} color={iconColor} />
              <IconifyIcon icon={navItem.extraIcon} width={18} height={18} color={iconColor} />
            </Stack>
          ) : (
            <IconifyIcon icon={navItem.icon} width={20} height={20} color={iconColor} />
          )}
        </ListItemIcon>
        <ListItemText
          primary={navItem.title}
          sx={{
            display: open ? 'inline-block' : 'none',
            opacity: open ? 1 : 0,
            color: isActive && open && !navItem.blackIcon ? 'background.default' : 'text.primary',
          }}
        />
      </ListItemButton>
    </ListItem>
  );
};

export default NavItem;
