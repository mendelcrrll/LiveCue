import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PresentToAllOutlinedIcon from '@mui/icons-material/PresentToAllOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import ButtonAppBar from '../components/AppBar';
import SideBar from '../components/SideBar';
import SlideBuilderPanel from '../components/SlideBuilderPanel';
import SlideNavigator from '../components/SlideNavigator';
import { findNodeById } from '../data/presentationTree';
import PresentationBuilderService from '../services/PresentationBuilderService';
import PresentationWorkflowService from '../services/PresentationWorkflowService';
import { sortSlidesByNumber } from '../utils/slideUtils';

const DRAWER_WIDTH = 320;
const NAVIGATOR_MIN_WIDTH = 180;
const NAVIGATOR_MAX_WIDTH = 560;
const BUILDER_MIN_WIDTH = 420;
const UNSAVED_CHANGES_MESSAGE =
  "You have unsaved builder schema changes. If you leave without saving, you'll lose your data.";
const builderToolbarButtonSx = {
  width: 60,
  height: 60,
  borderRadius: '50%',
  border: '1px solid var(--interactive-border, #8e72bf)',
  color: 'var(--text-h, #08060d)',
  backgroundColor: 'var(--surface, #f7f4fb)',
  '&:hover': {
    backgroundColor: 'var(--interactive-bg-hover, #ddd0f5)',
  },
  '&.Mui-disabled': {
    borderColor: 'var(--border, #3b3743)',
    color: 'var(--text-muted, #8d8599)',
    backgroundColor: 'var(--surface, #19161f)',
  },
};
function getClampedNavigatorWidth(width, gridWidth) {
  const maxWidth = Math.max(
    NAVIGATOR_MIN_WIDTH,
    Math.min(NAVIGATOR_MAX_WIDTH, gridWidth - BUILDER_MIN_WIDTH - 36)
  );

  return Math.min(maxWidth, Math.max(NAVIGATOR_MIN_WIDTH, width));
}

function BuilderSchema() {
  const { deckId } = useParams();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [treeData, setTreeData] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [presentationData, setPresentationData] = useState(null);
  const [activeSlideId, setActiveSlideId] = useState(null);
  const [navigatorWidth, setNavigatorWidth] = useState(360);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dirtySlideIds, setDirtySlideIds] = useState(() => new Set());
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const panelGridRef = useRef(null);
  const dirtyVersionsRef = useRef({});

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
        const slides = sortSlidesByNumber(Array.isArray(data.slides) ? data.slides : []);
        const firstSlide = slides[0];

        setPresentationData({
          ...data,
          slides,
        });
        setActiveSlideId(firstSlide?.slideId ?? null);
        setDirtySlideIds(new Set());
        setSaveError('');
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

  useEffect(() => {
    if (dirtySlideIds.size === 0) {
      return undefined;
    }

    function handleBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = UNSAVED_CHANGES_MESSAGE;
      return UNSAVED_CHANGES_MESSAGE;
    }

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [dirtySlideIds.size]);

  useEffect(() => {
    const panelGrid = panelGridRef.current;

    if (!panelGrid || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      const gridWidth = entry.contentRect.width;

      setNavigatorWidth((width) => getClampedNavigatorWidth(width, gridWidth));
    });

    resizeObserver.observe(panelGrid);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const activeSlide = useMemo(() => {
    return (
      presentationData?.slides.find((slide) => slide.slideId === activeSlideId) ?? null
    );
  }, [presentationData, activeSlideId]);

  function handleSelectWorkflowNode(nodeId) {
    const selectedContext = findNodeById(treeData, nodeId);
    const selectedNode = selectedContext?.node;

    if (
      selectedNode?.type === 'file' &&
      selectedNode.presentationId &&
      selectedNode.presentationId !== deckId &&
      !confirmDiscardUnsavedChanges()
    ) {
      return;
    }

    setSelectedNodeId(nodeId);

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

    dirtyVersionsRef.current[slideId] = (dirtyVersionsRef.current[slideId] ?? 0) + 1;
    setDirtySlideIds((currentSlideIds) => new Set(currentSlideIds).add(slideId));
    setSaveError('');
  }

  async function handleSaveBuilderSchema() {
    if (!presentationData || dirtySlideIds.size === 0 || isSaving) {
      return;
    }

    const dirtySlides = presentationData.slides.filter((slide) => dirtySlideIds.has(slide.slideId));
    const savedVersions = Object.fromEntries(
      dirtySlides.map((slide) => [slide.slideId, dirtyVersionsRef.current[slide.slideId] ?? 0])
    );

    try {
      setIsSaving(true);
      setSaveError('');

      const savedSlides = await Promise.all(
        dirtySlides.map((slide) =>
          PresentationBuilderService.updateSlideBuildData(deckId, slide.slideId, slide.buildData)
        )
      );
      const savedSlideById = new Map(savedSlides.map((slide) => [slide.slideId, slide]));

      setPresentationData((currentData) => {
        if (!currentData) {
          return currentData;
        }

        return {
          ...currentData,
          slides: currentData.slides.map((slide) => {
            const savedSlide = savedSlideById.get(slide.slideId);
            const slideWasEditedAgain =
              dirtyVersionsRef.current[slide.slideId] !== savedVersions[slide.slideId];

            return savedSlide && !slideWasEditedAgain ? savedSlide : slide;
          }),
        };
      });

      setDirtySlideIds((currentSlideIds) => {
        const nextSlideIds = new Set(currentSlideIds);

        Object.entries(savedVersions).forEach(([slideId, savedVersion]) => {
          if (dirtyVersionsRef.current[slideId] === savedVersion) {
            nextSlideIds.delete(slideId);
          }
        });

        return nextSlideIds;
      });
    } catch (saveBuilderError) {
      setSaveError(
        saveBuilderError instanceof Error
          ? saveBuilderError.message
          : 'Unable to save builder schema changes.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  function confirmDiscardUnsavedChanges() {
    if (dirtySlideIds.size === 0) {
      return true;
    }

    return window.confirm(UNSAVED_CHANGES_MESSAGE);
  }

  function handleNavigateHome() {
    if (confirmDiscardUnsavedChanges()) {
      navigate('/');
    }
  }

  function handleLaunchPresentationMode() {
    const slideParam = activeSlideId ? `?slideId=${encodeURIComponent(activeSlideId)}` : '';
    const slideOnlyParam = activeSlideId
      ? `?mode=slide&slideId=${encodeURIComponent(activeSlideId)}`
      : '?mode=slide';

    window.open(`/presentation-schema/${deckId}${slideOnlyParam}`, '_blank', 'noopener,noreferrer');
    navigate(`/presentation-schema/${deckId}${slideParam}`);
  }

  function clampNavigatorWidth(width) {
    const gridWidth = panelGridRef.current?.clientWidth ?? NAVIGATOR_MAX_WIDTH + BUILDER_MIN_WIDTH;
    return getClampedNavigatorWidth(width, gridWidth);
  }

  function handleResizePointerDown(event) {
    if (!panelGridRef.current) {
      return;
    }

    event.preventDefault();
    const gridRect = panelGridRef.current.getBoundingClientRect();

    function handlePointerMove(moveEvent) {
      setNavigatorWidth(clampNavigatorWidth(moveEvent.clientX - gridRect.left));
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }

  function handleResizeKeyDown(event) {
    const step = event.shiftKey ? 40 : 16;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setNavigatorWidth((width) => clampNavigatorWidth(width - step));
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setNavigatorWidth((width) => clampNavigatorWidth(width + step));
    }
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
        onHomeClick={handleNavigateHome}
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
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            justifyContent="space-between"
            useFlexGap
            flexWrap="wrap"
            sx={{ width: '100%' }}
          >
            <Box sx={{ minWidth: 0, textAlign: 'left', flex: '1 1 auto' }}>
              <Typography
                variant="h6"
                component="h1"
                noWrap
                sx={{ color: 'var(--text-h)', fontWeight: 700 }}
              >
                {presentationData.deckTitle}
              </Typography>

              <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                {isSaving
                  ? 'Saving...'
                  : dirtySlideIds.size > 0
                    ? `${dirtySlideIds.size} slide${dirtySlideIds.size === 1 ? '' : 's'} with unsaved changes`
                    : 'All changes saved'}
              </Typography>
            </Box>

            <Stack
              direction="row"
              spacing={1}
              justifyContent="flex-end"
              sx={{ flexShrink: 0, ml: 'auto' }}
            >
              <Tooltip
                title={dirtySlideIds.size > 0 ? 'Save builder schema' : 'No changes to save'}
                placement="bottom"
                arrow
              >
                <span>
                  <IconButton
                    aria-label="save builder schema"
                    onClick={handleSaveBuilderSchema}
                    disabled={dirtySlideIds.size === 0 || isSaving}
                    sx={builderToolbarButtonSx}
                  >
                    <SaveOutlinedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip title="Launch presentation mode">
                <span>
                  <IconButton
                    aria-label="launch presentation mode"
                    onClick={handleLaunchPresentationMode}
                    sx={builderToolbarButtonSx}
                  >
                    <PresentToAllOutlinedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Stack>

          {saveError && <Alert severity="error">{saveError}</Alert>}

          <Box
            ref={panelGridRef}
            sx={{
              display: 'grid',
              gap: { xs: 2, md: 0 },
              gridTemplateColumns: {
                xs: '1fr',
                md: `${navigatorWidth}px 16px minmax(0, 1fr)`,
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
                maxHeight: { md: 'calc(100vh - 112px)' },
                overflowY: 'auto',
              }}
            >
              <SlideNavigator
                slides={presentationData.slides}
                activeSlideId={activeSlideId}
                onSelectSlide={setActiveSlideId}
              />
            </Paper>

            <Box
              role="separator"
              aria-label="Resize slide navigator"
              aria-orientation="vertical"
              aria-valuemin={NAVIGATOR_MIN_WIDTH}
              aria-valuemax={NAVIGATOR_MAX_WIDTH}
              aria-valuenow={navigatorWidth}
              tabIndex={0}
              onPointerDown={handleResizePointerDown}
              onKeyDown={handleResizeKeyDown}
              sx={{
                display: { xs: 'none', md: 'flex' },
                alignSelf: 'stretch',
                justifyContent: 'center',
                minHeight: 360,
                cursor: 'col-resize',
                touchAction: 'none',
                outline: 'none',
                '&::before': {
                  content: '""',
                  width: 4,
                  borderRadius: 999,
                  backgroundColor: 'var(--border, #cbbfda)',
                  transition: 'background-color 120ms ease, width 120ms ease',
                },
                '&:hover::before, &:focus-visible::before': {
                  width: 6,
                  backgroundColor: 'var(--interactive-border, #8e72bf)',
                },
              }}
            />

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
