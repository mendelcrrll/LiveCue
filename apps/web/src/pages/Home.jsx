import { useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import ButtonAppBar from '../components/AppBar';
import SideBar from '../components/SideBar';
import {
  countFiles,
  findNodeById,
  presentationTree,
} from '../data/presentationTree';

const DRAWER_WIDTH = 280;

function getFileExtension(name) {
  const parts = name.split('.');
  return parts.length > 1 ? parts.at(-1).toUpperCase() : 'FILE';
}

function getItemLabel(node) {
  if (node.type === 'folder') {
    return `${node.children.length} item${node.children.length === 1 ? '' : 's'}`;
  }

  return getFileExtension(node.name);
}

function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState('lectures');

  const selectedContext =
    findNodeById(presentationTree, selectedNodeId) ??
    findNodeById(presentationTree, 'lectures');

  const selectedNode = selectedContext.node;
  const selectedParent = selectedContext.parent;
  const breadcrumb = selectedContext.path.map((node) => node.name).join(' / ');
  const visibleItems =
    selectedNode.type === 'folder'
      ? selectedNode.children
      : selectedParent?.children ?? [selectedNode];

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      <ButtonAppBar
        drawerWidth={DRAWER_WIDTH}
        sidebarOpen={sidebarOpen}
        onMenuClick={() => setSidebarOpen((open) => !open)}
        onSelectNode={setSelectedNodeId}
        treeData={presentationTree}
      />
      <SideBar
        drawerWidth={DRAWER_WIDTH}
        open={sidebarOpen}
        treeData={presentationTree}
        selectedNodeId={selectedNode.id}
        onSelectNode={setSelectedNodeId}
      />
      <Box
        component="main"
        sx={(theme) => ({
          flexGrow: 1,
          minWidth: 0,
          px: { xs: 2, sm: 3, md: 4 },
          pb: 4,
          transition: theme.transitions.create(['padding'], {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
          }),
        })}
      >
        <Toolbar />
        <Stack spacing={3} sx={{ mt: 3 }}>
          <Paper
            elevation={0}
            sx={{
              border: '1px solid var(--border, #e5e4e7)',
              backgroundColor: 'var(--surface-raised, #ffffff)',
              borderRadius: 3,
              p: { xs: 3, md: 4 },
            }}
          >
            <Stack spacing={2}>
              <Typography
                variant="overline"
                sx={{
                  color: 'var(--accent, #492e7d)',
                  letterSpacing: 1.5,
                  fontWeight: 700,
                }}
              >
                Current Selection
              </Typography>
              <Typography variant="h3" component="h1" sx={{ color: 'var(--text-h)' }}>
                {selectedNode.name}
              </Typography>
              <Typography variant="body1" sx={{ color: 'var(--text)' }}>
                {selectedNode.type === 'folder'
                  ? 'Browse the presentations and support files inside this folder.'
                  : 'You are viewing a file inside the current presentation group.'}
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip
                  label={selectedNode.type === 'folder' ? 'Folder' : 'File'}
                  sx={{
                    color: 'var(--text-h)',
                    borderColor: 'var(--interactive-border, #8e72bf)',
                    backgroundColor: 'var(--surface, #f7f4fb)',
                    fontWeight: 700,
                  }}
                />
                <Chip
                  label={getItemLabel(selectedNode)}
                  variant="outlined"
                  sx={{
                    color: 'var(--text-h)',
                    borderColor: 'var(--interactive-border, #8e72bf)',
                    backgroundColor: 'var(--surface, #f7f4fb)',
                  }}
                />
                <Chip
                  label={breadcrumb}
                  variant="outlined"
                  sx={{
                    color: 'var(--text-h)',
                    borderColor: 'var(--interactive-border, #8e72bf)',
                    backgroundColor: 'var(--surface, #f7f4fb)',
                  }}
                />
              </Stack>
            </Stack>
          </Paper>

          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(3, minmax(0, 1fr))',
              },
            }}
          >
            <Paper
              elevation={0}
              sx={{
                border: '1px solid var(--border, #e5e4e7)',
                borderRadius: 3,
                p: 3,
                backgroundColor: 'var(--surface-raised, #fcfbff)',
              }}
            >
              <Typography variant="overline" sx={{ color: 'var(--text-muted)', fontWeight: 700 }}>
                Visible Items
              </Typography>
              <Typography variant="h4" sx={{ color: 'var(--text-h)' }}>
                {visibleItems.length}
              </Typography>
            </Paper>
            <Paper
              elevation={0}
              sx={{
                border: '1px solid var(--border, #e5e4e7)',
                borderRadius: 3,
                p: 3,
                backgroundColor: 'var(--surface-raised, #fcfbff)',
              }}
            >
              <Typography variant="overline" sx={{ color: 'var(--text-muted)', fontWeight: 700 }}>
                Total Files
              </Typography>
              <Typography variant="h4" sx={{ color: 'var(--text-h)' }}>
                {countFiles(selectedNode)}
              </Typography>
            </Paper>
            <Paper
              elevation={0}
              sx={{
                border: '1px solid var(--border, #e5e4e7)',
                borderRadius: 3,
                p: 3,
                backgroundColor: 'var(--surface-raised, #fcfbff)',
              }}
            >
              <Typography variant="overline" sx={{ color: 'var(--text-muted)', fontWeight: 700 }}>
                Viewing From
              </Typography>
              <Typography variant="h5" sx={{ color: 'var(--text-h)' }}>
                {selectedNode.type === 'folder'
                  ? 'Folder overview'
                  : selectedParent?.name ?? 'File preview'}
              </Typography>
            </Paper>
          </Box>

          <Paper
            elevation={0}
              sx={{
                border: '1px solid var(--border, #e5e4e7)',
                borderRadius: 3,
                p: { xs: 2, md: 3 },
                backgroundColor: 'var(--surface-raised, #ffffff)',
              }}
            >
            <Stack spacing={2}>
              <Typography variant="h5" sx={{ color: 'var(--text-h)' }}>
                {selectedNode.type === 'folder'
                  ? 'Contents'
                  : 'Related files in this folder'}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    xl: 'repeat(3, minmax(0, 1fr))',
                  },
                }}
              >
                {visibleItems.map((item) => {
                  const isSelected = item.id === selectedNode.id;

                  return (
                    <Paper
                      key={item.id}
                      elevation={0}
                      onClick={() => setSelectedNodeId(item.id)}
                      sx={{
                        p: 2.5,
                        borderRadius: 3,
                        cursor: 'pointer',
                        border: isSelected
                          ? '2px solid var(--primary, #492e7d)'
                          : '1px solid var(--border, #e5e4e7)',
                        backgroundColor: isSelected
                          ? 'var(--interactive-bg, #e8def8)'
                          : 'var(--surface-raised, #fcfbff)',
                        transition: 'transform 180ms ease, border-color 180ms ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          borderColor: 'var(--primary, #492e7d)',
                          backgroundColor: isSelected
                            ? 'var(--interactive-bg-hover, #ddd0f5)'
                            : 'var(--surface, #f7f4fb)',
                        },
                      }}
                    >
                      <Stack spacing={1.5}>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          justifyContent="space-between"
                        >
                          <Chip
                            size="small"
                            label={item.type === 'folder' ? 'Folder' : getFileExtension(item.name)}
                            sx={{
                              backgroundColor: 'var(--interactive-bg, #e8def8)',
                              color: 'var(--interactive-text, #35205a)',
                              fontWeight: 700,
                            }}
                          />
                          <Typography variant="caption" sx={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                            {getItemLabel(item)}
                          </Typography>
                        </Stack>
                        <Typography variant="h6" sx={{ color: 'var(--text-h)' }}>
                          {item.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'var(--text)' }}>
                          {item.type === 'folder'
                            ? 'Open this folder to explore its presentations and supporting files.'
                            : 'Select this file to inspect it in the workspace context.'}
                        </Typography>
                      </Stack>
                    </Paper>
                  );
                })}
              </Box>
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </Box>
  );
}

export default Home;
