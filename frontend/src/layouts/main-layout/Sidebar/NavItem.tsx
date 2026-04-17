import { Link, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';
import { useLocation } from 'react-router-dom';

interface NavItemProps {
  navItem: {
    title: string;
    path: string;
    icon: string;
    active: boolean;
  };
  open: boolean;
  onClick?: () => void;
}

const NavItem = ({ navItem, open, onClick }: NavItemProps) => {
  const { pathname } = useLocation();
  return (
    <ListItem
      disablePadding
      sx={(theme) => ({
        display: 'block',
        px: 5,
        borderRight: !open
          ? pathname === navItem.path
            ? `3px solid ${theme.palette.primary.main}`
            : `3px solid transparent`
          : '',
      })}
    >
      <ListItemButton
        component={Link}
        href={navItem.path}
        onClick={onClick}
        sx={{
          opacity: navItem.active ? 1 : 0.5,
          bgcolor: pathname === navItem.path ? (open ? 'primary.main' : '') : 'background.default',
          '&:hover': {
            bgcolor:
              pathname === navItem.path
                ? open
                  ? 'primary.dark'
                  : 'background.paper'
                : 'background.paper',
          },
          '& .MuiTouchRipple-root': {
            color: pathname === navItem.path ? 'primary.main' : 'text.disabled',
          },
        }}
      >
        <ListItemIcon
          sx={{
            width: 20,
            height: 20,
            mr: open ? 'auto' : 0,
            color:
              pathname === navItem.path
                ? open
                  ? 'background.default'
                  : 'primary.main'
                : 'text.primary',
          }}
        >
          <IconifyIcon icon={navItem.icon} width={20} height={20} />
        </ListItemIcon>
        <ListItemText
          primary={navItem.title}
          sx={{
            display: open ? 'inline-block' : 'none',
            opacity: open ? 1 : 0,
            color: pathname === navItem.path && open ? 'background.default' : '',
          }}
        />
      </ListItemButton>
    </ListItem>
  );
};

export default NavItem;
