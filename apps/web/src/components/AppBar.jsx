import MuiAppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import MenuIcon from '@mui/icons-material/Menu';
import SearchBar from './SearchBar';
import ProfileButton from './ProfileButton';

export default function PrimarySearchAppBar({
  drawerWidth,
  sidebarOpen,
  onMenuClick,
  onSelectNode,
  treeData,
}) {
  return (
    <Box sx={{ flexGrow: 1 }}>
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
            Slide Signal
          </Typography>
          <SearchBar treeData={treeData} onSelectNode={onSelectNode} />
          <Box sx={{ flexGrow: 1 }} />
          <ProfileButton />
        </Toolbar>
      </MuiAppBar>
    </Box>
  );
}
