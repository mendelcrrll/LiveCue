import { useEffect, useState } from 'react';
import MuiAppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import { useNavigate } from 'react-router-dom';
import { requestJson } from '../services/apiClient';
import SearchBar from './SearchBar';
import ProfileButton from './ProfileButton';

export default function PrimarySearchAppBar({
  drawerWidth,
  sidebarOpen,
  onMenuClick,
  onHomeClick,
  onSelectNode,
  treeData,
}) {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    userName: 'Guest',
  });
  const handleHomeClick = onHomeClick ?? (() => navigate('/'));
  const handleGoogleConnect = () => {
    window.location.assign('http://127.0.0.1:8000/api/auth/google/login');
  };

  useEffect(() => {
    let isActive = true;

    async function loadAuthState() {
      try {
        const session = await requestJson('http://127.0.0.1:8000/api/auth/session');

        if (isActive) {
          setAuthState({
            isAuthenticated: Boolean(session.isAuthenticated),
            userName: session.userName || 'Guest',
          });
        }
      } catch {
        if (isActive) {
          setAuthState({
            isAuthenticated: false,
            userName: 'Guest',
          });
        }
      }
    }

    loadAuthState();

    return () => {
      isActive = false;
    };
  }, []);

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
            aria-label="go to file explorer"
            sx={{ mr: 1 }}
            onClick={handleHomeClick}
          >
            <HomeOutlinedIcon />
          </IconButton>
          <ProfileButton
            isAuthenticated={authState.isAuthenticated}
            userName={authState.userName}
            onGoogleConnect={handleGoogleConnect}
          />
        </Toolbar>
      </MuiAppBar>
    </>
  );
}
