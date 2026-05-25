import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import ButtonAppBar from '../components/AppBar';
import CollapsiblePanelRail from '../components/CollapsiblePanelRail';
import PaceCard from '../components/FeedbackCards/Pace';
import TimingCard from '../components/FeedbackCards/Timing';
import VignetteCard from '../components/FeedbackCards/VignetteCard';
import VignetteFeedbackCard from '../components/FeedbackCards/VignetteFeedbackCard';
import SideBar from '../components/SideBar';
import { findNodeById } from '../data/presentationTree';
import PostFeedbackService from '../services/PostFeedbackService';
import PresentationWorkflowService from '../services/PresentationWorkflowService';
import TranscriptionService from '../services/TranscriptionService';

const DRAWER_WIDTH = 320;
const VIGNETTE_PANEL_MIN_WIDTH = 280;
const VIGNETTE_PANEL_MAX_WIDTH = 520;
const VIGNETTE_PANEL_COLLAPSE_WIDTH = 240;
const FEEDBACK_GRID_MIN_WIDTH = 640;
const DEFAULT_CARD_ORDER = [
  'pace',
  'timing',
  'audienceTakeaway',
  'contentPriorities',
  'engagementConnection',
  'accessibilityDelivery',
];

const CARD_CONFIGS = {
  pace: { kind: 'pace', component: PaceCard },
  timing: { kind: 'timing', component: TimingCard },
  audienceTakeaway: { kind: 'vignette', title: 'Audience Takeaway' },
  contentPriorities: { kind: 'vignette', title: 'Content Priorities' },
  engagementConnection: { kind: 'vignette', title: 'Engagement' },
  accessibilityDelivery: { kind: 'vignette', title: 'Accessibility' },
};

const EMPTY_VIGNETTE = {
  id: 'draft-vignette-1',
  title: '',
  prompt: '',
  isDraft: true,
  isDirty: false,
};

function FeedbackPage() {
  const { deckId } = useParams();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [treeData, setTreeData] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [cadenceSummary, setCadenceSummary] = useState(null);
  const [cadenceLoading, setCadenceLoading] = useState(false);
  const [cadenceError, setCadenceError] = useState('');
  const [timingSummary, setTimingSummary] = useState(null);
  const [timingLoading, setTimingLoading] = useState(false);
  const [timingError, setTimingError] = useState('');
  const [cardOrder, setCardOrder] = useState(DEFAULT_CARD_ORDER);
  const [draggedCardId, setDraggedCardId] = useState(null);
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [vignettePanelWidth, setVignettePanelWidth] = useState(360);
  const [vignettePanelCollapsed, setVignettePanelCollapsed] = useState(false);
  const [activeVignetteId, setActiveVignetteId] = useState(EMPTY_VIGNETTE.id);
  const [vignettes, setVignettes] = useState([EMPTY_VIGNETTE]);
  const [deckTitle, setDeckTitle] = useState('');
  const [postFeedback, setPostFeedback] = useState(null);
  const [postFeedbackLoading, setPostFeedbackLoading] = useState(false);
  const [postFeedbackError, setPostFeedbackError] = useState('');
  const [savingVignetteId, setSavingVignetteId] = useState('');
  const [generatingFeedback, setGeneratingFeedback] = useState(false);
  const panelGridRef = useRef(null);

  useEffect(() => {
    let isActive = true;

    async function loadWorkflowTree() {
      try {
        const payload = await PresentationWorkflowService.getPresentationTree();
        const nextTree = Array.isArray(payload.tree) ? payload.tree : [];

        if (!isActive) {
          return;
        }

        setTreeData(nextTree);
        setSelectedNodeId(findNodeIdByPresentationId(nextTree, deckId) ?? nextTree[0]?.id ?? '');
      } catch {
        if (isActive) {
          setTreeData([]);
          setSelectedNodeId('');
        }
      }
    }

    loadWorkflowTree();

    return () => {
      isActive = false;
    };
  }, [deckId]);

  useEffect(() => {
    let isActive = true;

    async function loadPostFeedback() {
      if (!deckId) {
        setPostFeedback(null);
        setVignettes([EMPTY_VIGNETTE]);
        setActiveVignetteId(EMPTY_VIGNETTE.id);
        return;
      }

      try {
        setPostFeedbackLoading(true);
        setPostFeedbackError('');
        const payload = await PostFeedbackService.getPostFeedback(deckId);

        if (!isActive) {
          return;
        }

        const savedVignettes = normalizeVignettes(payload.vignettes);
        setDeckTitle(payload.deckTitle ?? '');
        setPostFeedback(payload.feedback ?? null);
        setVignettes(savedVignettes.length > 0 ? savedVignettes : [EMPTY_VIGNETTE]);
        setActiveVignetteId(savedVignettes[0]?.id ?? EMPTY_VIGNETTE.id);
      } catch (error) {
        if (isActive) {
          setPostFeedback(null);
          setPostFeedbackError(
            error instanceof Error ? error.message : 'Unable to load audience feedback.'
          );
        }
      } finally {
        if (isActive) {
          setPostFeedbackLoading(false);
        }
      }
    }

    loadPostFeedback();

    return () => {
      isActive = false;
    };
  }, [deckId]);

  useEffect(() => {
    let isActive = true;

    async function loadTimingSummary() {
      if (!deckId) {
        setTimingSummary(null);
        setTimingError('');
        return;
      }

      try {
        setTimingLoading(true);
        setTimingError('');
        const summary = await TranscriptionService.getPresentationTiming(deckId);

        if (isActive) {
          setTimingSummary(summary);
        }
      } catch (error) {
        if (isActive) {
          setTimingSummary(null);
          setTimingError(error instanceof Error ? error.message : 'Unable to load timing summary.');
        }
      } finally {
        if (isActive) {
          setTimingLoading(false);
        }
      }
    }

    loadTimingSummary();

    return () => {
      isActive = false;
    };
  }, [deckId]);

  useEffect(() => {
    let isActive = true;

    async function loadCadenceSummary() {
      if (!deckId) {
        setCadenceSummary(null);
        setCadenceError('');
        return;
      }

      try {
        setCadenceLoading(true);
        setCadenceError('');
        const summary = await TranscriptionService.getPresentationCadence(deckId);

        if (isActive) {
          setCadenceSummary(summary);
        }
      } catch (error) {
        if (isActive) {
          setCadenceSummary(null);
          setCadenceError(
            error instanceof Error ? error.message : 'Unable to load cadence summary.'
          );
        }
      } finally {
        if (isActive) {
          setCadenceLoading(false);
        }
      }
    }

    loadCadenceSummary();

    return () => {
      isActive = false;
    };
  }, [deckId]);

  function handleNavigateHome() {
    navigate('/');
  }

  function handleSelectWorkflowNode(nodeId) {
    const selectedContext = findNodeById(treeData, nodeId);
    const selectedNode = selectedContext?.node;

    setSelectedNodeId(nodeId);

    if (selectedNode?.type === 'file' && selectedNode.presentationId) {
      navigate(`/feedback-page/${selectedNode.presentationId}`);
    }
  }

  function handleCardDragStart(event, cardId) {
    setDraggedCardId(cardId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', cardId);
  }

  function handleCardDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  function handleCardDrop(event, targetCardId) {
    event.preventDefault();
    const sourceCardId = draggedCardId || event.dataTransfer.getData('text/plain');

    if (!sourceCardId || sourceCardId === targetCardId) {
      setDraggedCardId(null);
      return;
    }

    setCardOrder((currentOrder) => {
      const sourceIndex = currentOrder.indexOf(sourceCardId);
      const targetIndex = currentOrder.indexOf(targetCardId);

      if (sourceIndex < 0 || targetIndex < 0) {
        return currentOrder;
      }

      const nextOrder = [...currentOrder];
      const [movedCard] = nextOrder.splice(sourceIndex, 1);
      nextOrder.splice(targetIndex, 0, movedCard);
      return nextOrder;
    });
    setDraggedCardId(null);
  }

  function handleToggleCardExpand(cardId) {
    setExpandedCardId((currentCardId) => (currentCardId === cardId ? null : cardId));
  }

  function handleAddVignette() {
    const nextId = `draft-vignette-${Date.now()}`;
    setVignettes((currentVignettes) => [
      ...currentVignettes,
      { id: nextId, title: '', prompt: '', isDraft: true, isDirty: false },
    ]);
    setActiveVignetteId(nextId);
  }

  function handleChangeVignette(vignetteId, prompt) {
    setVignettes((currentVignettes) =>
      currentVignettes.map((vignette) =>
        vignette.id === vignetteId ? { ...vignette, prompt, isDirty: true } : vignette
      )
    );
  }

  async function handleRemoveVignette(vignetteId) {
    const vignette = vignettes.find((candidate) => candidate.id === vignetteId);
    if (!vignette) {
      return;
    }

    if (!vignette.isDraft && deckId) {
      try {
        await PostFeedbackService.deleteVignette(deckId, vignetteId);
        setPostFeedback(null);
      } catch (error) {
        setPostFeedbackError(
          error instanceof Error ? error.message : 'Unable to delete audience vignette.'
        );
        return;
      }
    }

    setVignettes((currentVignettes) => {
      const nextVignettes = currentVignettes.filter((vignette) => vignette.id !== vignetteId);
      const resolvedVignettes = nextVignettes.length > 0 ? nextVignettes : [EMPTY_VIGNETTE];

      if (activeVignetteId === vignetteId) {
        setActiveVignetteId(resolvedVignettes[0]?.id ?? EMPTY_VIGNETTE.id);
      }

      return resolvedVignettes;
    });
  }

  async function handleSaveVignette(vignetteId) {
    if (!deckId) {
      setPostFeedbackError('No deck id was provided.');
      return;
    }

    const vignette = vignettes.find((candidate) => candidate.id === vignetteId);
    if (!vignette || !vignette.prompt.trim()) {
      return;
    }

    try {
      setSavingVignetteId(vignetteId);
      setPostFeedbackError('');
      const savedVignette = vignette.isDraft
        ? await PostFeedbackService.createVignette(deckId, {
            title: vignette.title ?? '',
            prompt: vignette.prompt,
          })
        : await PostFeedbackService.updateVignette(deckId, vignette.id, {
            title: vignette.title ?? '',
            prompt: vignette.prompt,
          });

      const normalizedVignette = normalizeVignette(savedVignette);
      setVignettes((currentVignettes) =>
        currentVignettes.map((candidate) =>
          candidate.id === vignetteId ? normalizedVignette : candidate
        )
      );
      setActiveVignetteId(normalizedVignette.id);
      setPostFeedback(null);
    } catch (error) {
      setPostFeedbackError(
        error instanceof Error ? error.message : 'Unable to save audience vignette.'
      );
    } finally {
      setSavingVignetteId('');
    }
  }

  async function handleGeneratePostFeedback() {
    if (!deckId || generatingFeedback) {
      return;
    }

    try {
      setGeneratingFeedback(true);
      setPostFeedbackError('');
      const report = await PostFeedbackService.generatePostFeedback(deckId);
      setPostFeedback(report);
    } catch (error) {
      setPostFeedbackError(
        error instanceof Error ? error.message : 'Unable to generate audience feedback.'
      );
    } finally {
      setGeneratingFeedback(false);
    }
  }

  function clampVignettePanelWidth(width) {
    const gridWidth = panelGridRef.current?.clientWidth ?? VIGNETTE_PANEL_MAX_WIDTH + FEEDBACK_GRID_MIN_WIDTH;
    const maxWidth = Math.max(
      VIGNETTE_PANEL_MIN_WIDTH,
      Math.min(VIGNETTE_PANEL_MAX_WIDTH, gridWidth - FEEDBACK_GRID_MIN_WIDTH - 24)
    );

    return Math.min(maxWidth, Math.max(VIGNETTE_PANEL_MIN_WIDTH, width));
  }

  function handleResizePointerDown(event) {
    if (!panelGridRef.current) {
      return;
    }

    event.preventDefault();
    const gridRect = panelGridRef.current.getBoundingClientRect();

    function handlePointerMove(moveEvent) {
      const nextWidth = moveEvent.clientX - gridRect.left;

      if (nextWidth < VIGNETTE_PANEL_COLLAPSE_WIDTH) {
        setVignettePanelCollapsed(true);
        return;
      }

      setVignettePanelCollapsed(false);
      setVignettePanelWidth(clampVignettePanelWidth(nextWidth));
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
      setVignettePanelWidth((width) => {
        const nextWidth = width - step;
        if (nextWidth < VIGNETTE_PANEL_COLLAPSE_WIDTH) {
          setVignettePanelCollapsed(true);
          return width;
        }
        return clampVignettePanelWidth(nextWidth);
      });
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setVignettePanelCollapsed(false);
      setVignettePanelWidth((width) => clampVignettePanelWidth(width + step));
    }
  }

  const savedVignettes = vignettes.filter(
    (vignette) => !vignette.isDraft && vignette.prompt.trim().length > 0
  );
  const feedbackThemesById = new Map(
    (postFeedback?.themes ?? []).map((theme) => [theme.id, theme])
  );

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
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
          pl: { xs: 1.5, md: 2 },
          pr: { xs: 1.5, md: 2 },
          pb: 4,
          transition: theme.transitions.create(['padding'], {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
          }),
        })}
      >
        <Toolbar />
        <Box
          sx={{
            width: '100%',
            minHeight: 'calc(100vh - 64px)',
            px: { xs: 0.5, md: 1 },
            py: { xs: 2, md: 1.25 },
            boxSizing: 'border-box',
          }}
        >
          <Box
            ref={panelGridRef}
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: vignettePanelCollapsed
                  ? '64px minmax(0, 1fr)'
                  : `${vignettePanelWidth}px 16px minmax(0, 1fr)`,
              },
              gap: { xs: 2, md: vignettePanelCollapsed ? 2 : 0 },
              alignItems: 'start',
              minHeight: 0,
            }}
          >
            {vignettePanelCollapsed ? (
              <CollapsiblePanelRail
                label="Audience vignettes"
                onExpand={() => setVignettePanelCollapsed(false)}
              />
            ) : (
              <>
                <VignetteCard
                  vignettes={vignettes}
                  activeVignetteId={activeVignetteId}
                  onAdd={handleAddVignette}
                  onChange={handleChangeVignette}
                  onGenerateFeedback={handleGeneratePostFeedback}
                  onRemove={handleRemoveVignette}
                  onSave={handleSaveVignette}
                  onSelect={setActiveVignetteId}
                  isLoading={postFeedbackLoading}
                  savingVignetteId={savingVignetteId}
                  generating={generatingFeedback}
                />

                <Box
                  role="separator"
                  aria-label="Resize audience vignette panel"
                  aria-orientation="vertical"
                  aria-valuemin={VIGNETTE_PANEL_MIN_WIDTH}
                  aria-valuemax={VIGNETTE_PANEL_MAX_WIDTH}
                  aria-valuenow={vignettePanelWidth}
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
                      backgroundColor: 'var(--border)',
                      transition: 'background-color 120ms ease, width 120ms ease',
                    },
                    '&:hover::before, &:focus-visible::before': {
                      width: 6,
                      backgroundColor: 'var(--interactive-border)',
                    },
                  }}
                />
              </>
            )}

          <Stack spacing={1.5} sx={{ minHeight: 0 }}>
            <FeedbackDeckHeader
              deckTitle={deckTitle}
              savedVignetteCount={savedVignettes.length}
              overallScore={postFeedback?.overallScore}
              isLoading={postFeedbackLoading}
              isGenerating={generatingFeedback}
              hasFeedback={Boolean(postFeedback)}
            />
            {postFeedbackError && <Alert severity="error">{postFeedbackError}</Alert>}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                },
                gap: 1.5,
                alignItems: 'stretch',
              }}
            >
              {cardOrder.map((cardId) => {
                const cardConfig = CARD_CONFIGS[cardId];
                const CardComponent = cardConfig.component;
                const expanded = expandedCardId === cardId;

                return cardConfig.kind === 'vignette' ? (
                  <VignetteFeedbackCard
                    key={cardId}
                    id={cardId}
                    title={cardConfig.title}
                    theme={feedbackThemesById.get(cardId)}
                    score={feedbackThemesById.get(cardId)?.score ?? 0}
                    vignetteCount={savedVignettes.length}
                    hasFeedback={feedbackThemesById.has(cardId)}
                    isGenerating={generatingFeedback}
                    expanded={expanded}
                    onToggleExpand={() => handleToggleCardExpand(cardId)}
                    onDragStart={handleCardDragStart}
                    onDragOver={handleCardDragOver}
                    onDrop={handleCardDrop}
                  />
                ) : (
                  <CardComponent
                    key={cardId}
                    id={cardId}
                    expanded={expanded}
                    onToggleExpand={() => handleToggleCardExpand(cardId)}
                    onDragStart={handleCardDragStart}
                    onDragOver={handleCardDragOver}
                    onDrop={handleCardDrop}
                    summary={cadenceSummary}
                    isLoading={cadenceLoading}
                    error={cadenceError}
                    hasDeck={Boolean(deckId)}
                    timingSummary={timingSummary}
                    timingLoading={timingLoading}
                    timingError={timingError}
                  />
                );
              })}
            </Box>
          </Stack>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function FeedbackDeckHeader({
  deckTitle,
  savedVignetteCount,
  overallScore,
  isLoading,
  isGenerating,
  hasFeedback,
}) {
  const statusText = isGenerating
    ? 'Generating audience feedback...'
    : isLoading
      ? 'Loading feedback context...'
      : hasFeedback
        ? 'Feedback ready'
        : savedVignetteCount > 0
          ? 'Ready to generate'
          : 'Add and save an audience vignette';

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        border: '1px solid var(--border)',
        backgroundColor: 'var(--surface-raised)',
        color: 'var(--text)',
      }}
    >
      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        justifyContent="space-between"
        useFlexGap
        flexWrap="wrap"
        sx={{ textAlign: 'left' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h6"
            component="h1"
            noWrap
            sx={{ color: 'var(--text-h)', fontWeight: 800 }}
          >
            {deckTitle || 'Post-Presentation Feedback'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
            {statusText}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexShrink: 0 }}>
          {(isLoading || isGenerating) && <CircularProgress size={20} color="inherit" />}
          <HeaderStat label="Overall" value={overallScore == null ? '--' : `${overallScore}/100`} />
          <HeaderStat label="Audiences" value={savedVignetteCount} />
        </Stack>
      </Stack>
    </Paper>
  );
}

function HeaderStat({ label, value }) {
  return (
    <Box
      sx={{
        minWidth: 104,
        p: 1,
        border: '1px solid var(--border)',
        borderRadius: 2,
        backgroundColor: 'var(--surface)',
        textAlign: 'left',
      }}
    >
      <Typography variant="caption" sx={{ color: 'var(--text-muted)', fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography variant="subtitle1" sx={{ color: 'var(--text-h)', fontWeight: 900 }}>
        {value}
      </Typography>
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

export default FeedbackPage;

function normalizeVignettes(vignettes) {
  return (Array.isArray(vignettes) ? vignettes : []).map(normalizeVignette);
}

function normalizeVignette(vignette) {
  return {
    id: vignette.id,
    title: vignette.title ?? '',
    prompt: vignette.prompt ?? '',
    sortOrder: vignette.sortOrder ?? 0,
    isDraft: false,
    isDirty: false,
  };
}
