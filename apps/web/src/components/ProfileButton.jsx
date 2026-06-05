import * as React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import AccountCircle from '@mui/icons-material/AccountCircle';
import MoreIcon from '@mui/icons-material/MoreVert';

export default function ProfileButton({
  userName = 'Guest',
  isAuthenticated = false,
  onProfileClick,
  onAccountClick,
  onGoogleConnect,
  onLogout,
}) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [mobileMoreAnchorEl, setMobileMoreAnchorEl] = React.useState(null);

  const isMenuOpen = Boolean(anchorEl);
  const isMobileMenuOpen = Boolean(mobileMoreAnchorEl);
  const menuId = 'primary-search-account-menu';
  const mobileMenuId = 'primary-search-account-menu-mobile';

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMobileMenuOpen = (event) => {
    setMobileMoreAnchorEl(event.currentTarget);
  };

  const handleMobileMenuClose = () => {
    setMobileMoreAnchorEl(null);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    handleMobileMenuClose();
  };

  const handleOpenProfileMenuFromMobile = (event) => {
    handleMobileMenuClose();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuAction = (action) => () => {
    action?.();
    handleMenuClose();
  };

  return (
    <>
      <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1 }}>
        <Typography
          variant="body2"
          sx={{
            color: 'inherit',
            fontWeight: 600,
          }}
        >
          {userName}
        </Typography>
        <IconButton
          size="large"
          edge="end"
          aria-label="account of current user"
          aria-controls={menuId}
          aria-haspopup="true"
          onClick={handleProfileMenuOpen}
          color="inherit"
        >
          <AccountCircle />
        </IconButton>
      </Box>

      <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
        <IconButton
          size="large"
          aria-label="show account options"
          aria-controls={mobileMenuId}
          aria-haspopup="true"
          onClick={handleMobileMenuOpen}
          color="inherit"
        >
          <MoreIcon />
        </IconButton>
      </Box>

      <Menu
        anchorEl={mobileMoreAnchorEl}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        id={mobileMenuId}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={isMobileMenuOpen}
        onClose={handleMobileMenuClose}
        slotProps={{
          paper: {
            sx: {
              backgroundColor: 'var(--surface-raised)',
              color: 'var(--text-h)',
              border: '1px solid var(--border)',
            },
          },
        }}
      >
        <MenuItem onClick={handleOpenProfileMenuFromMobile}>
          <AccountCircle sx={{ mr: 1.5 }} />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {userName}
            </Typography>
            <Typography variant="caption" sx={{ color: 'var(--text-muted, #6b6577)' }}>
              Open account menu
            </Typography>
          </Box>
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        id={menuId}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={isMenuOpen}
        onClose={handleMenuClose}
        slotProps={{
          paper: {
            sx: {
              backgroundColor: 'var(--surface-raised)',
              color: 'var(--text-h)',
              border: '1px solid var(--border)',
              minWidth: 220,
            },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {userName}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--text-muted, #6b6577)' }}>
            {isAuthenticated ? 'Signed in' : 'Not connected yet'}
          </Typography>
        </Box>
        <MenuItem onClick={handleMenuAction(onProfileClick)}>Profile</MenuItem>
        <MenuItem onClick={handleMenuAction(onAccountClick)}>My account</MenuItem>
        <MenuItem onClick={handleMenuAction(onGoogleConnect)}>
          {isAuthenticated ? 'Manage Google connection' : 'Connect Google account'}
        </MenuItem>
        {isAuthenticated && <MenuItem onClick={handleMenuAction(onLogout)}>Sign out</MenuItem>}
      </Menu>
    </>
  );
}
