import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';

function renderTree(nodes, expandedFolders, onToggle, selectedNodeId, onSelectNode, depth = 0) {
  return nodes.map((node) => {
    const isFolder = node.type === 'folder';
    const isExpanded = expandedFolders.has(node.id);
    const isSelected = selectedNodeId === node.id;

    return (
      <Box key={node.id}>
        <ListItemButton
          selected={isSelected}
          onClick={() => {
            onSelectNode(node.id);

            if (isFolder) {
              onToggle(node.id);
            }
          }}
          sx={{
            pl: 2 + depth * 2,
            pr: 2,
            mx: 1,
            borderRadius: 1.5,
            color: 'var(--text-h, #08060d)',
            '&.Mui-selected': {
              backgroundColor: 'var(--interactive-bg, #e8def8)',
              color: 'var(--interactive-text, #35205a)',
            },
            '&.Mui-selected:hover, &:hover': {
              backgroundColor: 'var(--interactive-bg-hover, #ddd0f5)',
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>
            {isFolder ? (
              isExpanded ? <FolderOpenOutlinedIcon /> : <FolderOutlinedIcon />
            ) : (
              <InsertDriveFileOutlinedIcon />
            )}
          </ListItemIcon>
          <ListItemText
            primary={node.name}
            primaryTypographyProps={{
              fontSize: 14,
              fontWeight: isFolder ? 600 : 400,
            }}
          />
          {isFolder &&
            (isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />)}
        </ListItemButton>
        {isFolder && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List disablePadding>
              {renderTree(
                node.children,
                expandedFolders,
                onToggle,
                selectedNodeId,
                onSelectNode,
                depth + 1
              )}
            </List>
          </Collapse>
        )}
      </Box>
    );
  });
}

export default function SideBar({
  drawerWidth,
  open,
  treeData,
  selectedNodeId,
  onSelectNode,
}) {
  const [expandedFolders, setExpandedFolders] = useState(null);

  const defaultExpandedFolders = useMemo(() => {
    const nextFolders = new Set();
    const rootNode = treeData[0];

    if (rootNode?.type === 'folder') {
      nextFolders.add(rootNode.id);
    }

    const firstChild = rootNode?.children?.[0];
    if (firstChild?.type === 'folder') {
      nextFolders.add(firstChild.id);
    }

    return nextFolders;
  }, [treeData]);

  const activeExpandedFolders = expandedFolders ?? defaultExpandedFolders;

  const toggleFolder = (folderId) => {
    setExpandedFolders((currentFolders) => {
      const nextFolders = new Set(currentFolders ?? activeExpandedFolders);

      if (nextFolders.has(folderId)) {
        nextFolders.delete(folderId);
      } else {
        nextFolders.add(folderId);
      }

      return nextFolders;
    });
  };

  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={open}
      sx={(theme) => ({
        width: open ? drawerWidth : 0,
        flexShrink: 0,
        whiteSpace: 'nowrap',
        overflowX: 'hidden',
        transition: theme.transitions.create('width', {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          borderRight: '1px solid var(--border, #e5e4e7)',
          backgroundColor: 'var(--surface-raised, #ffffff)',
          color: 'var(--text-h, #08060d)',
        },
      })}
    >
      <Toolbar
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          color: 'var(--text-h, #08060d)',
        }}
      >
        <Typography variant="subtitle1" fontWeight={700}>
          Folder Tree
        </Typography>
      </Toolbar>
      <Divider sx={{ borderColor: 'var(--border, #e5e4e7)' }} />
      <Box
        sx={{
          overflowY: 'auto',
          py: 1,
          color: 'var(--text-h, #08060d)',
        }}
      >
        <List disablePadding>
          {renderTree(
            treeData,
            activeExpandedFolders,
            toggleFolder,
            selectedNodeId,
            onSelectNode
          )}
        </List>
      </Box>
    </Drawer>
  );
}
