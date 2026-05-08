import MuiAppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../services/apiClient';
import SearchBar from './SearchBar';
import ProfileButton from './ProfileButton';

export default function PrimarySearchAppBar({
  drawerWidth,
  sidebarOpen,
  onMenuClick,
  onBackClick,
  backDisabled = false,
  onHomeClick,
  onSelectNode,
  treeData,
}) {
  const navigate = useNavigate();
  const [session, setSession] = useState({
    isAuthenticated: false,
    userName: 'Guest',
  });
  const handleBackClick = onBackClick ?? (() => navigate(-1));
  const handleHomeClick = onHomeClick ?? (() => navigate('/'));

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/session`, {
          credentials: 'include',
        });

        if (!response.ok) {
          return;
        }

        const nextSession = await response.json();

        if (isMounted) {
          setSession({
            isAuthenticated: Boolean(nextSession.isAuthenticated),
            userName: nextSession.userName || 'Guest',
          });
        }
      } catch {
        // Leave the profile as Guest when the API is unavailable.
      }
    }

    loadSession();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleGoogleConnect() {
    window.location.href = `${API_BASE_URL}/api/auth/google/login`;
  }

  return (
    <>
      <MuiAppBar
        position="fixed"
        sx={(theme) => ({
          zIndex: theme.zIndex.drawer + 1,
          backgroundColor: 'var(--primary, #492e7d)',
          color: 'var(--primary-contrast, #ffffff)',
          transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
          ...(sidebarOpen && {
            ml: `${drawerWidth}px`,
            width: `calc(100% - ${drawerWidth}px)`,
            transition: theme.transitions.create(['margin', 'width'], {
              easing: theme.transitions.easing.easeOut,
              duration: theme.transitions.duration.enteringScreen,
            }),
          }),
          boxShadow: 'none',
        })}
      >
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label={sidebarOpen ? 'collapse sidebar' : 'expand sidebar'}
            sx={{ mr: 2 }}
            onClick={onMenuClick}
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{ display: { xs: 'none', sm: 'block' } }}
          >
            Live Cue
          </Typography>
          <SearchBar treeData={treeData} onSelectNode={onSelectNode} />
          <Box sx={{ flexGrow: 1 }} />
          <IconButton
            size="large"
            color="inherit"
            aria-label="go back"
            disabled={backDisabled}
            sx={{ mr: 1 }}
            onClick={handleBackClick}
          >
            <ArrowBackOutlinedIcon />
          </IconButton>
          <IconButton
            size="large"
            color="inherit"
            aria-label="go to file explorer"
            sx={{ mr: 1 }}
            onClick={handleHomeClick}
          >
            <HomeOutlinedIcon />
          </IconButton>
          <ProfileButton
            userName={session.userName}
            isAuthenticated={session.isAuthenticated}
            onGoogleConnect={handleGoogleConnect}
          />
        </Toolbar>
      </MuiAppBar>
    </>
  );
}
