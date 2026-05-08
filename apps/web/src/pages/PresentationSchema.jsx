import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import ButtonAppBar from '../components/AppBar';
import FullPageSlide from '../components/FullPageSlide';
import PresenterFeedbackPanel from '../components/PresenterFeedbackPanel';
import PresenterSlidePanel from '../components/PresenterSlidePanel';
import SideBar from '../components/SideBar';
import { findNodeById } from '../data/presentationTree';
import PresentationBuilderService from '../services/PresentationBuilderService';
import PresentationWorkflowService from '../services/PresentationWorkflowService';
import { sortSlidesByNumber } from '../utils/slideUtils';

const DRAWER_WIDTH = 320;
const SLIDE_PANEL_MIN_WIDTH = 320;
const SLIDE_PANEL_MAX_WIDTH = 760;
const FEEDBACK_PANEL_MIN_WIDTH = 420;
const PRESENTER_WORKSPACE_SCALE = 0.95;
const PRESENTER_WORKSPACE_TOP_OFFSET = 92;

function getClampedSlidePanelWidth(width, gridWidth) {
  const maxWidth = Math.max(
    SLIDE_PANEL_MIN_WIDTH,
    Math.min(
      SLIDE_PANEL_MAX_WIDTH,
      gridWidth * 0.4,
      gridWidth - FEEDBACK_PANEL_MIN_WIDTH - 36
    )
  );

  return Math.min(maxWidth, Math.max(SLIDE_PANEL_MIN_WIDTH, width));
}

function PresentationSchemaPage() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [treeData, setTreeData] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [presentationData, setPresentationData] = useState(null);
  const [activeSlideId, setActiveSlideId] = useState('');
  const [slidePanelWidth, setSlidePanelWidth] = useState(520);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const isSlideOnlyMode = searchParams.get('mode') === 'slide';
  const [initialSlideId] = useState(() => searchParams.get('slideId'));
  const panelGridRef = useRef(null);

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
    async function loadPresentationData() {
      try {
        setIsLoading(true);
        setError('');

        const resolvedDeckId = deckId ?? (await getFirstPresentationId());

        if (!resolvedDeckId) {
          setError('No linked presentation was found. Create or import a presentation first.');
          return;
        }

        const data = await PresentationBuilderService.getSlideDeckBuild(resolvedDeckId);
        const slides = sortSlidesByNumber(data.slides ?? []);
        const nextActiveSlideId = slides.some((slide) => slide.slideId === initialSlideId)
          ? initialSlideId
          : slides[0]?.slideId ?? '';

        setPresentationData({
          ...data,
          slides,
        });
        setActiveSlideId(nextActiveSlideId);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load presentation feedback data.'
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadPresentationData();
  }, [deckId, initialSlideId]);

  const activeSlide = useMemo(() => {
    return presentationData?.slides.find((slide) => slide.slideId === activeSlideId) ?? null;
  }, [presentationData, activeSlideId]);

  const activeSlideIndex = useMemo(() => {
    return presentationData?.slides.findIndex((slide) => slide.slideId === activeSlideId) ?? -1;
  }, [presentationData, activeSlideId]);

  const previousSlide = activeSlideIndex > 0 ? presentationData?.slides[activeSlideIndex - 1] : null;
  const nextSlide =
    activeSlideIndex >= 0 && activeSlideIndex < (presentationData?.slides.length ?? 0) - 1
      ? presentationData?.slides[activeSlideIndex + 1]
      : null;
  const activeDeckId = presentationData?.deckId ?? deckId;

  const activeSlideTimingSeconds = useMemo(() => {
    return getTimingGoalSeconds(activeSlide?.buildData?.timingGoal);
  }, [activeSlide]);

  useEffect(() => {
    setTimerSeconds(activeSlideTimingSeconds);
    setIsTimerPaused(false);
  }, [activeSlideId, activeSlideTimingSeconds]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTimerSeconds((seconds) => (isTimerPaused ? seconds : seconds - 1));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isTimerPaused]);

  useEffect(() => {
    if (!activeDeckId || !activeSlideId) {
      return;
    }

    writeActiveSlideToStorage(activeDeckId, activeSlideId);
  }, [activeDeckId, activeSlideId]);

  useEffect(() => {
    const panelGrid = panelGridRef.current;

    if (!panelGrid || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      const gridWidth = entry.contentRect.width;

      setSlidePanelWidth((width) => getClampedSlidePanelWidth(width, gridWidth));
    });

    resizeObserver.observe(panelGrid);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!activeDeckId || !presentationData) {
      return undefined;
    }

    function handleStorage(event) {
      if (event.key !== getActiveSlideStorageKey(activeDeckId) || !event.newValue) {
        return;
      }

      if (presentationData.slides.some((slide) => slide.slideId === event.newValue)) {
        setActiveSlideId(event.newValue);
      }
    }

    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [activeDeckId, presentationData]);

  useEffect(() => {
    if (!activeDeckId || isSlideOnlyMode) {
      return undefined;
    }

    function requestSlideOnlyTabClose() {
      writeSlideOnlyCommandToStorage(activeDeckId, {
        type: 'close',
        createdAt: Date.now(),
      });
    }

    window.addEventListener('beforeunload', requestSlideOnlyTabClose);

    return () => {
      window.removeEventListener('beforeunload', requestSlideOnlyTabClose);
      requestSlideOnlyTabClose();
    };
  }, [activeDeckId, isSlideOnlyMode]);

  useEffect(() => {
    if (!activeDeckId || !isSlideOnlyMode) {
      return undefined;
    }

    function handleStorage(event) {
      if (event.key !== getSlideOnlyCommandStorageKey(activeDeckId) || !event.newValue) {
        return;
      }

      try {
        const command = JSON.parse(event.newValue);

        if (command.type === 'close') {
          window.close();
        }
      } catch {
        // Ignore malformed storage events from older tabs.
      }
    }

    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [activeDeckId, isSlideOnlyMode]);

  useEffect(() => {
    function selectSlide(nextSlideId) {
      if (!nextSlideId) {
        return;
      }

      const nextParams = new URLSearchParams(searchParams);

      nextParams.set('slideId', nextSlideId);
      setActiveSlideId(nextSlideId);
      writeActiveSlideToStorage(activeDeckId, nextSlideId);
      setSearchParams(nextParams, { replace: true });
    }

    function handleKeyDown(event) {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (previousSlide?.slideId) {
          selectSlide(previousSlide.slideId);
        }
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (nextSlide?.slideId) {
          selectSlide(nextSlide.slideId);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [previousSlide, nextSlide, searchParams, activeDeckId, setSearchParams]);

  useEffect(() => {
    if (!deckId || isSlideOnlyMode) {
      return undefined;
    }

    function requestSlideOnlyTabClose() {
      writeSlideOnlyCommandToStorage(deckId, {
        type: 'close',
        createdAt: Date.now(),
      });
    }

    window.addEventListener('beforeunload', requestSlideOnlyTabClose);

    return () => {
      window.removeEventListener('beforeunload', requestSlideOnlyTabClose);
      requestSlideOnlyTabClose();
    };
  }, [deckId, isSlideOnlyMode]);

  useEffect(() => {
    if (!deckId || !isSlideOnlyMode) {
      return undefined;
    }

    function handleStorage(event) {
      if (event.key !== getSlideOnlyCommandStorageKey(deckId) || !event.newValue) {
        return;
      }

      try {
        const command = JSON.parse(event.newValue);

        if (command.type === 'close') {
          window.close();
        }
      } catch {
        // Ignore malformed storage events from older tabs.
      }
    }

    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [deckId, isSlideOnlyMode]);

  function handleSelectSlide(nextSlideId) {
    if (!nextSlideId) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);

    nextParams.set('slideId', nextSlideId);
    setActiveSlideId(nextSlideId);
    writeActiveSlideToStorage(activeDeckId, nextSlideId);
    setSearchParams(nextParams, { replace: true });
  }

  function handleSelectWorkflowNode(nodeId) {
    const selectedContext = findNodeById(treeData, nodeId);
    const selectedNode = selectedContext?.node;

    setSelectedNodeId(nodeId);

    if (selectedNode?.type === 'file' && selectedNode.presentationId) {
      navigate(`/presentation-schema/${selectedNode.presentationId}`);
    }
  }

  function handleNavigateHome() {
    navigate('/');
  }

  function clampSlidePanelWidth(width) {
    const gridWidth = panelGridRef.current?.clientWidth ?? SLIDE_PANEL_MAX_WIDTH + FEEDBACK_PANEL_MIN_WIDTH;
    return getClampedSlidePanelWidth(width, gridWidth);
  }

  function handleResizePointerDown(event) {
    if (!panelGridRef.current) {
      return;
    }

    event.preventDefault();
    const gridRect = panelGridRef.current.getBoundingClientRect();

    function handlePointerMove(moveEvent) {
      setSlidePanelWidth(clampSlidePanelWidth(moveEvent.clientX - gridRect.left));
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
      setSlidePanelWidth((width) => clampSlidePanelWidth(width - step));
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setSlidePanelWidth((width) => clampSlidePanelWidth(width + step));
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 3 }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography>Loading presentation schema...</Typography>
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

  if (isSlideOnlyMode) {
    return <FullPageSlide slide={activeSlide} slideCount={presentationData?.slides.length ?? 0} />;
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
          height: '100vh',
          pl: { xs: 2, sm: 2, md: 2 },
          pr: { xs: 2, sm: 3, md: 4 },
          pb: 2,
          textAlign: 'left',
          overflow: { lg: 'hidden' },
          transition: theme.transitions.create(['padding'], {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
          }),
        })}
      >
        <Toolbar />

        <Stack
          spacing={0}
          sx={{
            width: {
              xs: '100%',
              lg: `${100 / PRESENTER_WORKSPACE_SCALE}%`,
            },
            maxWidth: {
              xs: 1440,
              lg: 1440 / PRESENTER_WORKSPACE_SCALE,
            },
            mx: 'auto',
            mt: 1,
            minHeight: 0,
            transform: { lg: `scale(${PRESENTER_WORKSPACE_SCALE})` },
            transformOrigin: 'top left',
          }}
        >
          <Box
            ref={panelGridRef}
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                lg: `${slidePanelWidth}px 16px minmax(0, 1fr)`,
              },
              gap: { xs: 2, lg: 0 },
              alignItems: 'stretch',
              height: {
                lg: `calc((100vh - ${PRESENTER_WORKSPACE_TOP_OFFSET}px) / ${PRESENTER_WORKSPACE_SCALE})`,
              },
              minHeight: { lg: 0 },
              maxHeight: {
                lg: `calc((100vh - ${PRESENTER_WORKSPACE_TOP_OFFSET}px) / ${PRESENTER_WORKSPACE_SCALE})`,
              },
              overflow: { lg: 'hidden' },
            }}
          >
            {activeSlide ? (
              <>
                <PresenterSlidePanel
                  slide={activeSlide}
                  previousSlide={previousSlide}
                  nextSlide={nextSlide}
                  timerSeconds={timerSeconds}
                  isTimerPaused={isTimerPaused}
                  onToggleTimer={() => setIsTimerPaused((paused) => !paused)}
                  onResetTimer={() => {
                    setTimerSeconds(activeSlideTimingSeconds);
                    setIsTimerPaused(false);
                  }}
                  onSelectSlide={handleSelectSlide}
                />

                <Box
                  role="separator"
                  aria-label="Resize presenter panels"
                  aria-orientation="vertical"
                  aria-valuemin={SLIDE_PANEL_MIN_WIDTH}
                  aria-valuemax={SLIDE_PANEL_MAX_WIDTH}
                  aria-valuenow={slidePanelWidth}
                  tabIndex={0}
                  onPointerDown={handleResizePointerDown}
                  onKeyDown={handleResizeKeyDown}
                  sx={{
                    display: { xs: 'none', lg: 'flex' },
                    alignSelf: 'stretch',
                    justifyContent: 'center',
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

                <PresenterFeedbackPanel slide={activeSlide} />
              </>
            ) : (
              <Alert severity="info">Select a slide to view presenter mode.</Alert>
            )}
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}

async function getFirstPresentationId() {
  const payload = await PresentationWorkflowService.getPresentationTree();
  const tree = Array.isArray(payload.tree) ? payload.tree : [];

  return findFirstPresentationId(tree);
}

function findFirstPresentationId(nodes) {
  for (const node of nodes) {
    if (node.presentationId) {
      return node.presentationId;
    }

    const childPresentationId = findFirstPresentationId(node.children ?? []);

    if (childPresentationId) {
      return childPresentationId;
    }
  }

  return null;
}

function getTimingGoalSeconds(timingGoal = { minutes: 0, seconds: 0 }) {
  return Math.max(
    0,
    Number(timingGoal.minutes ?? 0) * 60 + Number(timingGoal.seconds ?? 0)
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

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select'
  );
}

function getActiveSlideStorageKey(deckId) {
  return `presentation-schema:${deckId}:active-slide`;
}

function getSlideOnlyCommandStorageKey(deckId) {
  return `presentation-schema:${deckId}:slide-window-command`;
}

function writeActiveSlideToStorage(deckId, slideId) {
  if (!deckId || !slideId) {
    return;
  }

  try {
    window.localStorage.setItem(getActiveSlideStorageKey(deckId), slideId);
  } catch {
    // If browser storage is unavailable, the current tab still works normally.
  }
}

function writeSlideOnlyCommandToStorage(deckId, command) {
  if (!deckId) {
    return;
  }

  try {
    window.localStorage.setItem(
      getSlideOnlyCommandStorageKey(deckId),
      JSON.stringify(command)
    );
  } catch {
    // If browser storage is unavailable, users can still close the slide tab manually.
  }
}

export default PresentationSchemaPage;
