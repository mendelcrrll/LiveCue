import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import ButtonAppBar from '../components/AppBar';
import SideBar from '../components/SideBar';
import SlideBuilderPanel from '../components/SlideBuilderPanel';
import SlideNavigator from '../components/SlideNavigator';
import { findNodeById } from '../data/presentationTree';
import PresentationBuilderService from '../services/PresentationBuilderService';
import PresentationWorkflowService from '../services/PresentationWorkflowService';

const DRAWER_WIDTH = 320;

function BuilderSchema() {
  const { deckId } = useParams();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [treeData, setTreeData] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [presentationData, setPresentationData] = useState(null);
  const [activeSlideId, setActiveSlideId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadWorkflowTree() {
      try {
        const payload = await PresentationWorkflowService.getPresentationTree();
        const nextTree = Array.isArray(payload.tree) ? payload.tree : [];

        setTreeData(nextTree);
        setSelectedNodeId(findNodeIdByPresentationId(nextTree, deckId) ?? nextTree[0]?.id ?? '');
      } catch {
        setTreeData([]);
      }
    }

    loadWorkflowTree();
  }, [deckId]);

  useEffect(() => {
    async function loadBuilderData() {
      if (!deckId) {
        setError('No deck id was provided.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError('');

        const data = await PresentationBuilderService.getSlideDeckBuild(deckId);
        const slides = Array.isArray(data.slides) ? data.slides : [];
        const firstSlide = [...slides].sort((a, b) => a.slideNumber - b.slideNumber)[0];

        setPresentationData({
          ...data,
          slides,
        });
        setActiveSlideId(firstSlide?.slideId ?? null);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load builder data for this deck.'
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadBuilderData();
  }, [deckId]);

  const activeSlide = useMemo(() => {
    return (
      presentationData?.slides.find((slide) => slide.slideId === activeSlideId) ?? null
    );
  }, [presentationData, activeSlideId]);

  function handleSelectWorkflowNode(nodeId) {
    setSelectedNodeId(nodeId);

    const selectedContext = findNodeById(treeData, nodeId);
    const selectedNode = selectedContext?.node;

    if (selectedNode?.type === 'file' && selectedNode.presentationId) {
      navigate(`/builder/${selectedNode.presentationId}`);
    }
  }

  function handleUpdateSlide(slideId, updatedBuildData) {
    setPresentationData((currentData) => {
      if (!currentData) {
        return currentData;
      }

      return {
        ...currentData,
        slides: currentData.slides.map((slide) =>
          slide.slideId === slideId
            ? {
                ...slide,
                buildData: updatedBuildData,
              }
            : slide
        ),
      };
    });
  }

  if (isLoading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography>Loading builder schema...</Typography>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!presentationData) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 3 }}>
        <Alert severity="info">No builder data found for this deck.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      <ButtonAppBar
        drawerWidth={DRAWER_WIDTH}
        sidebarOpen={sidebarOpen}
        onMenuClick={() => setSidebarOpen((open) => !open)}
        onSelectNode={handleSelectWorkflowNode}
        treeData={treeData}
      />
      <SideBar
        drawerWidth={DRAWER_WIDTH}
        open={sidebarOpen}
        treeData={treeData}
        selectedNodeId={selectedNodeId}
        onSelectNode={handleSelectWorkflowNode}
      />

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
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, md: 3 },
              border: '1px solid var(--border, #e5e4e7)',
              backgroundColor: 'var(--surface-raised, #ffffff)',
            }}
          >
            <Typography variant="overline" sx={{ color: 'var(--text-muted)', fontWeight: 700 }}>
              Builder Schema
            </Typography>

            <Typography variant="h4" component="h1" sx={{ color: 'var(--text-h)' }}>
              {presentationData.deckTitle}
            </Typography>
          </Paper>

          <Box
            sx={{
              display: 'grid',
              gap: 3,
              gridTemplateColumns: {
                xs: '1fr',
                md: '280px minmax(0, 1fr)',
              },
              alignItems: 'start',
            }}
          >
            <Paper
              elevation={0}
              sx={{
                p: 2,
                border: '1px solid var(--border, #e5e4e7)',
                backgroundColor: 'var(--surface-raised, #ffffff)',
                position: { md: 'sticky' },
                top: { md: 88 },
              }}
            >
              <SlideNavigator
                slides={presentationData.slides}
                activeSlideId={activeSlideId}
                onSelectSlide={setActiveSlideId}
              />
            </Paper>

            <SlideBuilderPanel slide={activeSlide} onUpdateSlide={handleUpdateSlide} />
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}

function findNodeIdByPresentationId(nodes, presentationId) {
  for (const node of nodes) {
    if (node.presentationId === presentationId) {
      return node.id;
    }

    const childMatch = findNodeIdByPresentationId(node.children ?? [], presentationId);
    if (childMatch) {
      return childMatch;
    }
  }

  return null;
}

export default BuilderSchema;
