import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import ButtonAppBar from '../components/AppBar';
import SideBar from '../components/SideBar';
import WorkflowActionButtons from '../components/WorkflowActionButtons';
import WorkflowRequestDialog from '../components/WorkflowRequestDialog';
import { countFiles, findNodeById } from '../data/presentationTree';

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

      const response = await fetch('/api/presentations/tree');
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = await response.json();
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

    const endpoint =
      mode === 'folder' ? '/api/presentations/folders' : '/api/presentations/files';
    const body =
      mode === 'folder'
        ? {
            parent_id: targetFolder.id,
            name: values.name,
          }
        : {
            parent_id: targetFolder.id,
            name: values.name,
            source_kind: mode === 'slides' ? 'google_slides_request' : 'manual',
            google_presentation_id:
              mode === 'slides' ? values.googlePresentationId : undefined,
          };

    setSubmittingAction(true);
    setActionError('');
    setActionFeedback('');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.detail ?? `Request failed with status ${response.status}`);
      }

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
      const response = await fetch(`/api/presentations/nodes/${selectedNode.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        let detail = `Request failed with status ${response.status}`;

        try {
          const payload = await response.json();
          detail = payload.detail ?? detail;
        } catch {
          // Ignore empty response bodies for delete actions.
        }

        throw new Error(detail);
      }

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
              ` .\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --reload`, then refresh
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
          {(actionFeedback || actionError) && (
            <Alert
              severity={actionError ? 'error' : 'success'}
              onClose={() => {
                setActionFeedback('');
                setActionError('');
              }}
            >
              {actionError || actionFeedback}
            </Alert>
          )}

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
                  ? 'Browse the workflow items inside this folder and create new requests.'
                  : 'You are viewing a file or Google Slides request in the current workflow.'}
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
              <WorkflowActionButtons
                canCreate={canCreate}
                canRemove={canRemove}
                onAddFolder={() => setActionMode('folder')}
                onAddFile={() => setActionMode('file')}
                onRequestSlides={() => setActionMode('slides')}
                onRemove={removeSelectedNode}
              />
              <Typography variant="body2" sx={{ color: 'var(--text-muted, #6b6577)' }}>
                {targetFolder
                  ? `New items will be added to ${targetFolder.name}.`
                  : 'Select a folder to add new workflow items.'}
              </Typography>
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
                {selectedNode.type === 'folder' ? 'Contents' : 'Related files in this folder'}
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
                          <Typography
                            variant="caption"
                            sx={{ color: 'var(--text-muted)', fontWeight: 600 }}
                          >
                            {getItemLabel(item)}
                          </Typography>
                        </Stack>
                        <Typography variant="h6" sx={{ color: 'var(--text-h)' }}>
                          {item.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'var(--text)' }}>
                          {item.type === 'folder'
                            ? 'Open this folder to explore and manage its workflow items.'
                            : 'Select this file to inspect it and manage it from the workflow.'}
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
