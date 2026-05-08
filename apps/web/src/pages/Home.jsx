import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import CreateNewFolderOutlinedIcon from '@mui/icons-material/CreateNewFolderOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import LaunchOutlinedIcon from '@mui/icons-material/LaunchOutlined';
import SlideshowOutlinedIcon from '@mui/icons-material/SlideshowOutlined';
import ButtonAppBar from '../components/AppBar';
import SideBar from '../components/SideBar';
import SlidePreview from '../components/SlidePreview';
import WorkflowActionButtons from '../components/WorkflowActionButtons';
import WorkflowRequestDialog from '../components/WorkflowRequestDialog';
import { findNodeById } from '../data/presentationTree';
import PresentationWorkflowService from '../services/PresentationWorkflowService';

const DRAWER_WIDTH = 320;

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
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [actionMode, setActionMode] = useState(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionFeedback, setActionFeedback] = useState('');
  const [actionError, setActionError] = useState('');

  const loadPresentationTree = useCallback(async (preferredNodeId = null) => {
    try {
      setLoading(true);
      setErrorMessage('');

      const payload = await PresentationWorkflowService.getPresentationTree();
      const nextTree = Array.isArray(payload.tree) ? payload.tree : [];
      const fallbackNodeId =
        preferredNodeId ?? nextTree[0]?.id ?? nextTree[0]?.children?.[0]?.id ?? '';

      setTreeData(nextTree);
      setSelectedNodeId(fallbackNodeId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load presentation data from the API.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPresentationTree();
  }, [loadPresentationTree]);

  useEffect(() => {
    if (!actionFeedback && !actionError) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setActionFeedback('');
      setActionError('');
    }, 10000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [actionFeedback, actionError]);

  const selectedContext =
    findNodeById(treeData, selectedNodeId) ??
    findNodeById(treeData, treeData[0]?.id ?? '');

  const selectedNode = selectedContext?.node ?? null;
  const selectedParent = selectedContext?.parent ?? null;
  const targetFolder = selectedNode?.type === 'folder' ? selectedNode : selectedParent;
  const canCreate = Boolean(targetFolder);
  const canRemove = Boolean(selectedNode && selectedParent);

  async function createNode(mode, values) {
    if (!targetFolder) {
      return;
    }

    setSubmittingAction(true);
    setActionError('');
    setActionFeedback('');

    try {
      const payload =
        mode === 'folder'
          ? await PresentationWorkflowService.createFolder({
              parentId: targetFolder.id,
              name: values.name,
            })
          : await PresentationWorkflowService.createFile({
              parentId: targetFolder.id,
              name: values.name,
              sourceKind: mode === 'slides' ? 'google_slides_request' : 'manual',
              googlePresentationId: mode === 'slides' ? values.googlePresentationId : undefined,
            });

      setActionMode(null);
      setActionFeedback(
        mode === 'folder'
          ? 'Folder created successfully.'
          : mode === 'slides'
            ? 'Google Slides request added to the workflow.'
            : 'File created successfully.'
      );
      await loadPresentationTree(payload.id);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Unable to complete the workflow action.'
      );
    } finally {
      setSubmittingAction(false);
    }
  }

  async function removeSelectedNode() {
    if (!selectedNode || !selectedParent) {
      return;
    }

    const confirmed = window.confirm(`Remove "${selectedNode.name}" from the workflow?`);
    if (!confirmed) {
      return;
    }

    setSubmittingAction(true);
    setActionError('');
    setActionFeedback('');

    try {
      await PresentationWorkflowService.deleteNode(selectedNode.id);

      setActionFeedback('Item removed successfully.');
      await loadPresentationTree(selectedParent.id);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Unable to remove the selected item.'
      );
    } finally {
      setSubmittingAction(false);
    }
  }

  function openWorkflowItem(item) {
    setSelectedNodeId(item.id);
  }

  function openBuilderSchema(item) {
    if (!item?.presentationId) {
      return;
    }

    navigate(`/builder/${item.presentationId}`);
  }

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          px: 3,
          backgroundColor: 'var(--surface, #f7f4fb)',
        }}
      >
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography variant="h6" sx={{ color: 'var(--text-h)' }}>
            Loading workflow data from the API...
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (errorMessage) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          px: 3,
          backgroundColor: 'var(--surface, #f7f4fb)',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            maxWidth: 520,
            p: 4,
            borderRadius: 3,
            border: '1px solid var(--border, #e5e4e7)',
            backgroundColor: 'var(--surface-raised, #ffffff)',
          }}
        >
          <Stack spacing={1.5}>
            <Typography variant="h5" sx={{ color: 'var(--text-h)' }}>
              Could not load workflow data
            </Typography>
            <Typography variant="body1" sx={{ color: 'var(--text)' }}>
              Start the Python API from `apps/api` with
              ` .\\.venv\\Scripts\\python.exe -m uvicorn backend.main:app --reload`, then refresh
              this page.
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
              {errorMessage}
            </Typography>
          </Stack>
        </Paper>
      </Box>
    );
  }

  if (!selectedContext || !selectedNode) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          px: 3,
          backgroundColor: 'var(--surface, #f7f4fb)',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            maxWidth: 520,
            p: 4,
            borderRadius: 3,
            border: '1px solid var(--border, #e5e4e7)',
            backgroundColor: 'var(--surface-raised, #ffffff)',
          }}
        >
          <Stack spacing={1.5}>
            <Typography variant="h5" sx={{ color: 'var(--text-h)' }}>
              No workflow items in the database yet
            </Typography>
            <Typography variant="body1" sx={{ color: 'var(--text)' }}>
              Seed the database with
              ` .\\.venv\\Scripts\\python.exe scripts\\seed_mock_presentation.py` from `apps/api`,
              then refresh this page.
            </Typography>
          </Stack>
        </Paper>
      </Box>
    );
  }

  const breadcrumb = selectedContext.path.map((node) => node.name).join(' / ');
  const activeFolder = selectedNode.type === 'folder' ? selectedNode : selectedParent;
  const visibleItems = activeFolder?.children ?? [];
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      <ButtonAppBar
        drawerWidth={DRAWER_WIDTH}
        sidebarOpen={sidebarOpen}
        onMenuClick={() => setSidebarOpen((open) => !open)}
        backDisabled
        onSelectNode={setSelectedNodeId}
        treeData={treeData}
        canCreate={canCreate}
        canRemove={canRemove}
        onAddFolder={() => setActionMode('folder')}
        onAddFile={() => setActionMode('file')}
        onRequestSlides={() => setActionMode('slides')}
        onRemove={removeSelectedNode}
      />
      <SideBar
        drawerWidth={DRAWER_WIDTH}
        open={sidebarOpen}
        treeData={treeData}
        selectedNodeId={selectedNode.id}
        onSelectNode={setSelectedNodeId}
      />
      {(actionFeedback || actionError) && (
        <Alert
          severity={actionError ? 'error' : 'success'}
          onClose={() => {
            setActionFeedback('');
            setActionError('');
          }}
          sx={{
            position: 'fixed',
            right: 20,
            bottom: 20,
            zIndex: 1500,
            width: 'min(420px, calc(100vw - 32px))',
            backgroundColor: 'rgba(255, 255, 255, 0.72)',
            color: 'var(--text-h)',
            border: '1px solid rgba(203, 191, 218, 0.72)',
            boxShadow: '0 14px 36px rgba(25, 18, 35, 0.18)',
            backdropFilter: 'blur(12px)',
            '& .MuiAlert-icon': {
              color: actionError ? 'error.main' : 'success.main',
            },
          }}
        >
          {actionError || actionFeedback}
        </Alert>
      )}
      <Box
        component="main"
        sx={(theme) => ({
          flexGrow: 1,
          minWidth: 0,
          pl: { xs: 2, sm: 2, md: 2 },
          pr: { xs: 2, sm: 3, md: 4 },
          pb: 4,
          transition: theme.transitions.create(['padding'], {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
          }),
        })} 
      >
        <Toolbar />
        <Stack spacing={3} sx={{ mt: 3 }}>
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            justifyContent="space-between"
            useFlexGap
            flexWrap="wrap"
            sx={{ width: '100%' }}
          >
            <Box sx={{ minWidth: 0, mr: 'auto', textAlign: 'left' }}>
              <Typography
                component="h1"
                variant="overline"
                sx={{
                  color: 'var(--text-muted)',
                  fontWeight: 700,
                  letterSpacing: 0.8,
                }}
              >
                {breadcrumb}
              </Typography>
            </Box>

            <Box sx={{ flexShrink: 0, ml: 'auto' }}>
              <WorkflowActionButtons
                canCreate={canCreate}
                canRemove={canRemove}
                onAddFolder={() => setActionMode('folder')}
                onAddFile={() => setActionMode('file')}
                onRequestSlides={() => setActionMode('slides')}
                onRemove={removeSelectedNode}
              />
            </Box>
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gap: 2.5,
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 0.58fr))',
                xl: 'repeat(3, minmax(150px, 0.58fr))',
              },
              justifyContent: 'start',
            }}
          >
            {visibleItems.map((item) => {
              const isSelected = item.id === selectedNode.id;
              const isFolder = item.type === 'folder';

              return (
                <Paper
                  key={item.id}
                  elevation={0}
                  onClick={() => openWorkflowItem(item)}
                  sx={{
                    overflow: 'hidden',
                    borderRadius: 2,
                    cursor: 'pointer',
                    border: isSelected
                      ? '2px solid var(--primary, #492e7d)'
                      : '1px solid var(--border, #e5e4e7)',
                    backgroundColor: isSelected
                      ? 'var(--interactive-bg, #e8def8)'
                      : 'var(--surface-raised, #ffffff)',
                    transition: 'transform 180ms ease, border-color 180ms ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      borderColor: 'var(--primary, #492e7d)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      aspectRatio: '16 / 9',
                      borderBottom: '1px solid var(--border, #e5e4e7)',
                      backgroundColor: isFolder
                        ? 'var(--accent-bg, #efe7fb)'
                        : 'var(--surface, #f7f4fb)',
                      display: 'grid',
                      placeItems: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {!isFolder && item.thumbnailUrl ? (
                      <SlidePreview
                        slide={{
                          slideNumber: 1,
                          thumbnailUrl: item.thumbnailUrl,
                        }}
                        borderRadius={0}
                        sx={{
                          border: 0,
                          borderRadius: 0,
                        }}
                      />
                    ) : (
                      <Stack spacing={1} alignItems="center">
                        {isFolder ? (
                          <FolderOutlinedIcon sx={{ fontSize: 52, color: 'var(--primary)' }} />
                        ) : (
                          <SlideshowOutlinedIcon sx={{ fontSize: 52, color: 'var(--primary)' }} />
                        )}
                        <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
                          {isFolder ? `${item.children.length} items` : 'Preview'}
                        </Typography>
                      </Stack>
                    )}
                  </Box>

                  <Stack spacing={0.85} sx={{ p: 1.1, textAlign: 'left' }}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Chip
                        size="small"
                        label={isFolder ? 'Folder' : getFileExtension(item.name)}
                        icon={isFolder ? <FolderOutlinedIcon /> : <SlideshowOutlinedIcon />}
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

                    <Typography variant="body1" sx={{ color: 'var(--text-h)', fontWeight: 700 }}>
                      {item.name}
                    </Typography>

                    {isSelected && !isFolder && (
                      <Box
                        sx={{
                          pt: 1.25,
                          mt: 0.25,
                          borderTop: '1px solid var(--border, #e5e4e7)',
                        }}
                      >
                        <Stack spacing={1.25}>
                          <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
                            {item.presentationId
                              ? 'Open this deck in BuilderSchema to configure slide goals, timing, and accessibility checks.'
                              : 'This file is not linked to a presentation yet.'}
                          </Typography>
                          <Button
                            variant="contained"
                            startIcon={<LaunchOutlinedIcon />}
                            disabled={!item.presentationId}
                            onClick={(event) => {
                              event.stopPropagation();
                              openBuilderSchema(item);
                            }}
                            sx={{ alignSelf: 'flex-start' }}
                          >
                            Edit
                          </Button>
                        </Stack>
                      </Box>
                    )}

                    {isFolder && (
                      <Button
                        variant="outlined"
                        startIcon={<CreateNewFolderOutlinedIcon />}
                        onClick={(event) => {
                          event.stopPropagation();
                          openWorkflowItem(item);
                        }}
                        fullWidth
                      >
                        Open Folder
                      </Button>
                    )}
                  </Stack>
                </Paper>
              );
            })}
          </Box>
        </Stack>
      </Box>
      {actionMode && (
        <WorkflowRequestDialog
          key={`${actionMode}-${targetFolder?.id ?? 'none'}`}
          mode={actionMode}
          open
          onClose={() => setActionMode(null)}
          onSubmit={(values) => createNode(actionMode, values)}
          submitting={submittingAction}
          targetFolderName={targetFolder?.name ?? ''}
        />
      )}
    </Box>
  );
}

export default Home;
