import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import FullscreenOutlinedIcon from '@mui/icons-material/FullscreenOutlined';
import MenuOpenOutlinedIcon from '@mui/icons-material/MenuOpenOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ButtonAppBar from '../components/AppBar';
import FullPageSlide from '../components/FullPageSlide';
import PresenterWorkspace from '../components/PresenterWorkspace';
import SideBar from '../components/SideBar';
import { findNodeById } from '../data/presentationTree';
import PresentationBuilderService from '../services/PresentationBuilderService';
import TranscriptionService from '../services/TranscriptionService';
import PresentationWorkflowService from '../services/PresentationWorkflowService';
import { sortSlidesByNumber } from '../utils/slideUtils';

const DRAWER_WIDTH = 320;
const SLIDE_PANEL_MIN_WIDTH = 320;
const SLIDE_PANEL_MAX_WIDTH = 760;
const SLIDE_PANEL_COLLAPSE_WIDTH = 260;
const FEEDBACK_PANEL_MIN_WIDTH = 420;
const TRANSCRIPTION_CHUNK_MS = 5000;
const PRESENTER_CHROME_STORAGE_KEY = 'presentation-schema:show-presenter-chrome';
const FULLSCREEN_WORKSPACE_TOP_OFFSET = 32;
const CHROME_WORKSPACE_TOP_OFFSET = 92;
const themedDialogSx = {
  '& .MuiDialog-paper': {
    border: '1px solid var(--border, #cbbfda)',
    backgroundColor: 'var(--surface-raised, #ffffff)',
    color: 'var(--text, #352b45)',
    boxShadow: 'var(--shadow)',
  },
  '& .MuiDialogTitle-root': {
    color: 'var(--text-h, #1b1325)',
    fontWeight: 800,
    borderBottom: '1px solid var(--border, #cbbfda)',
  },
  '& .MuiDialogContent-root': {
    borderColor: 'var(--border, #cbbfda)',
    backgroundColor: 'var(--surface-raised, #ffffff)',
  },
  '& .MuiDialogActions-root': {
    gap: 1,
    px: 3,
    py: 2,
    borderTop: '1px solid var(--border, #cbbfda)',
  },
};
const themedTextButtonSx = {
  color: 'var(--interactive-text, #35205a)',
  '&:hover': {
    backgroundColor: 'var(--interactive-bg, #e8def8)',
  },
};
const themedContainedButtonSx = {
  color: 'var(--primary-contrast, #ffffff)',
  backgroundColor: 'var(--primary, #4f2d7f)',
  boxShadow: 'none',
  '&:hover': {
    backgroundColor: 'var(--accent, #6b39b0)',
    boxShadow: 'none',
  },
};

function getClampedSlidePanelWidth(width, gridWidth) {
  const maxWidth = Math.max(
    SLIDE_PANEL_MIN_WIDTH,
    Math.min(
      SLIDE_PANEL_MAX_WIDTH,
      gridWidth * 0.5,
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
  const [slidePanelWidth, setSlidePanelWidth] = useState(640);
  const [slidePanelCollapsed, setSlidePanelCollapsed] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerPaused, setIsTimerPaused] = useState(true);
  const [isTranscriptionActive, setIsTranscriptionActive] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState('');
  const [transcriptDialogOpen, setTranscriptDialogOpen] = useState(false);
  const [fullTranscript, setFullTranscript] = useState(null);
  const [fullTranscriptLoading, setFullTranscriptLoading] = useState(false);
  const [fullTranscriptError, setFullTranscriptError] = useState('');
  const [sessionEndDialogOpen, setSessionEndDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPresenterChromeVisible, setIsPresenterChromeVisible] = useState(() =>
    readPresenterChromePreference()
  );
  const isSlideOnlyMode = searchParams.get('mode') === 'slide';
  const [initialSlideId] = useState(() => searchParams.get('slideId'));
  const panelGridRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const transcriptionWindowTimeoutRef = useRef(null);
  const transcriptionShouldContinueRef = useRef(false);
  const recordingStartedAtRef = useRef(0);
  const lastChunkEndedAtMsRef = useRef(0);
  const activeDeckIdRef = useRef('');
  const activeSlideIdRef = useRef('');
  const presentationDataRef = useRef(null);
  const feedbackDecisionStateRef = useRef({ inFlight: false, pending: null });

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
    writePresenterChromePreference(isPresenterChromeVisible);
  }, [isPresenterChromeVisible]);

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
    setIsTimerPaused(true);
  }, [activeSlideId, activeSlideTimingSeconds]);

  useEffect(() => {
    activeDeckIdRef.current = activeDeckId ?? '';
  }, [activeDeckId]);

  useEffect(() => {
    presentationDataRef.current = presentationData;
  }, [presentationData]);

  useEffect(() => {
    activeSlideIdRef.current = activeSlideId ?? '';
  }, [activeSlideId]);

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

      if (!slidePanelCollapsed) {
        setSlidePanelWidth((width) => getClampedSlidePanelWidth(width, gridWidth));
      }
    });

    resizeObserver.observe(panelGrid);

    return () => {
      resizeObserver.disconnect();
    };
  }, [slidePanelCollapsed]);

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
    return () => {
      stopTranscriptionCapture();
    };
  }, []);

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

  async function handleNavigateHome() {
    navigate('/');
  }

  async function handleTogglePresentation() {
    if (isTimerPaused) {
      const started = await startTranscriptionCapture();

      if (started) {
        setIsTimerPaused(false);
      }

      return;
    }

    setIsTimerPaused(true);
    stopTranscriptionCapture();
  }

  async function startTranscriptionCapture() {
    if (mediaRecorderRef.current?.state === 'recording') {
      setIsTranscriptionActive(true);
      return true;
    }

    if (!activeDeckIdRef.current || !activeSlideIdRef.current) {
      setTranscriptionError('Select a slide before starting presentation transcription.');
      return false;
    }

    try {
      setTranscriptionError('');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedAudioMimeType();

      mediaStreamRef.current = stream;
      transcriptionShouldContinueRef.current = true;
      recordingStartedAtRef.current = Date.now();
      lastChunkEndedAtMsRef.current = 0;

      startTranscriptionWindow(stream, mimeType);
      setIsTranscriptionActive(true);
      return true;
    } catch (recordingError) {
      setTranscriptionError(
        recordingError instanceof Error
          ? recordingError.message
          : 'Unable to start microphone transcription.'
      );
      setIsTranscriptionActive(false);
      return false;
    }
  }

  function startTranscriptionWindow(stream, mimeType) {
    const audioChunks = [];
    const presentationId = activeDeckIdRef.current;
    const slideId = activeSlideIdRef.current;
    const chunkStartedAtMs = lastChunkEndedAtMsRef.current;
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    recorder.onstop = () => {
      const chunkEndedAtMs = Date.now() - recordingStartedAtRef.current;
      const recordedMimeType = recorder.mimeType || mimeType || 'audio/webm';

      lastChunkEndedAtMsRef.current = chunkEndedAtMs;
      mediaRecorderRef.current = null;

      if (
        transcriptionShouldContinueRef.current &&
        mediaStreamRef.current &&
        mediaStreamRef.current.active
      ) {
        startTranscriptionWindow(mediaStreamRef.current, mimeType);
      } else {
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        setIsTranscriptionActive(false);
      }

      if (audioChunks.length > 0) {
        const audioBlob = new Blob(audioChunks, { type: recordedMimeType });
        void uploadTranscriptionChunk({
          audioBlob,
          mimeType: recordedMimeType,
          presentationId,
          slideId,
          chunkStartedAtMs,
          chunkEndedAtMs,
        });
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start();

    transcriptionWindowTimeoutRef.current = window.setTimeout(() => {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    }, TRANSCRIPTION_CHUNK_MS);
  }

  function stopTranscriptionCapture() {
    const recorder = mediaRecorderRef.current;

    transcriptionShouldContinueRef.current = false;
    window.clearTimeout(transcriptionWindowTimeoutRef.current);
    transcriptionWindowTimeoutRef.current = null;

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      return;
    }

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    setIsTranscriptionActive(false);
  }

  async function uploadTranscriptionChunk({
    audioBlob,
    mimeType,
    presentationId,
    slideId,
    chunkStartedAtMs,
    chunkEndedAtMs,
  }) {
    if (!presentationId || !slideId) {
      return;
    }

    const extension = getAudioExtension(mimeType);

    try {
      const transcriptChunk = await TranscriptionService.transcribeAudioChunk({
        audioBlob,
        filename: `presentation-${chunkStartedAtMs}-${chunkEndedAtMs}.${extension}`,
        presentationId,
        slideId,
        chunkStartedAtMs,
        chunkEndedAtMs,
      });

      if (transcriptChunk.saved) {
        await requestFeedbackDecision({ presentationId, slideId });
      }
    } catch (chunkError) {
      setTranscriptionError(
        chunkError instanceof Error
          ? chunkError.message
          : 'Unable to save a transcription chunk.'
      );
    }
  }

  async function requestFeedbackDecision({ presentationId, slideId }) {
    const decisionState = feedbackDecisionStateRef.current;

    if (decisionState.inFlight) {
      decisionState.pending = { presentationId, slideId };
      return;
    }

    decisionState.inFlight = true;

    try {
      let nextRequest = { presentationId, slideId };

      while (nextRequest) {
        const currentRequest = nextRequest;

        decisionState.pending = null;
        await runFeedbackDecision(currentRequest);
        nextRequest = decisionState.pending;
      }
    } finally {
      decisionState.inFlight = false;
    }
  }

  async function runFeedbackDecision({ presentationId, slideId }) {
    const currentPresentationData = presentationDataRef.current;
    const slide = currentPresentationData?.slides.find((candidate) => candidate.slideId === slideId);

    if (!slide?.buildData) {
      return;
    }

    const decision = await PresentationBuilderService.generateFeedbackDecision(
      presentationId,
      slideId,
      {
        buildData: slide.buildData,
        windowSize: 12,
      }
    );

    if (decision.updatedSlide) {
      setPresentationData((currentData) => {
        if (!currentData) {
          return currentData;
        }

        return {
          ...currentData,
          slides: currentData.slides.map((currentSlide) =>
            currentSlide.slideId === decision.updatedSlide.slideId
              ? decision.updatedSlide
              : currentSlide
          ),
        };
      });
    }

  }

  async function handleReviewTranscript() {
    const presentationId = activeDeckIdRef.current;

    if (!presentationId) {
      return;
    }

    try {
      setTranscriptDialogOpen(true);
      setFullTranscriptLoading(true);
      setFullTranscriptError('');
      const transcript = await TranscriptionService.getPresentationTranscript(presentationId);
      setFullTranscript(transcript);
    } catch (transcriptError) {
      setFullTranscript(null);
      setFullTranscriptError(
        transcriptError instanceof Error
          ? transcriptError.message
          : 'Unable to load the saved transcript.'
      );
    } finally {
      setFullTranscriptLoading(false);
    }
  }

  function handleViewPostFeedback() {
    const presentationId = activeDeckIdRef.current;
    if (presentationId) {
      navigate(`/feedback-page/${presentationId}`);
    }
  }

  function handleEndSession() {
    setIsTimerPaused(true);
    stopTranscriptionCapture();
    setSessionEndDialogOpen(true);
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
      const nextWidth = moveEvent.clientX - gridRect.left;

      if (nextWidth < SLIDE_PANEL_COLLAPSE_WIDTH) {
        setSlidePanelCollapsed(true);
        return;
      }

      setSlidePanelCollapsed(false);
      setSlidePanelWidth(clampSlidePanelWidth(nextWidth));
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
      setSlidePanelWidth((width) => {
        const nextWidth = width - step;
        if (nextWidth < SLIDE_PANEL_COLLAPSE_WIDTH) {
          setSlidePanelCollapsed(true);
          return width;
        }
        return clampSlidePanelWidth(nextWidth);
      });
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setSlidePanelCollapsed(false);
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
      {isPresenterChromeVisible && (
        <>
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
        </>
      )}

      <Box
        component="main"
        sx={(theme) => ({
          flexGrow: 1,
          minWidth: 0,
          height: '100vh',
          boxSizing: 'border-box',
          pl: isPresenterChromeVisible ? { xs: 2, sm: 2, md: 2 } : { xs: 1.5, sm: 2 },
          pr: isPresenterChromeVisible ? { xs: 2, sm: 3, md: 4 } : { xs: 1.5, sm: 2 },
          pt: isPresenterChromeVisible ? 0 : { xs: 1.5, sm: 2 },
          pb: isPresenterChromeVisible ? 2 : { xs: 1.5, sm: 2 },
          textAlign: 'left',
          overflow: { lg: 'hidden' },
          transition: theme.transitions.create(['padding'], {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
          }),
        })}
      >
        {isPresenterChromeVisible && <Toolbar />}

        <PresenterChromeToggle
          isVisible={isPresenterChromeVisible}
          onToggle={() => setIsPresenterChromeVisible((visible) => !visible)}
        />

        <PresenterWorkspace
          activeSlide={activeSlide}
          activeSlideTimingSeconds={activeSlideTimingSeconds}
          isTimerPaused={isTimerPaused}
          isTranscriptionActive={isTranscriptionActive}
          nextSlide={nextSlide}
          panelGridRef={panelGridRef}
          previousSlide={previousSlide}
          slidePanelMaxWidth={SLIDE_PANEL_MAX_WIDTH}
          slidePanelMinWidth={SLIDE_PANEL_MIN_WIDTH}
          slidePanelCollapsed={slidePanelCollapsed}
          slidePanelWidth={slidePanelWidth}
          timerSeconds={timerSeconds}
          topOffset={
            isPresenterChromeVisible ? CHROME_WORKSPACE_TOP_OFFSET : FULLSCREEN_WORKSPACE_TOP_OFFSET
          }
          transcriptionError={transcriptionError}
          onResetTimer={(nextTimerSeconds) => {
            setTimerSeconds(nextTimerSeconds);
            setIsTimerPaused(true);
            stopTranscriptionCapture();
          }}
          onEndSession={handleEndSession}
          onReviewTranscript={handleReviewTranscript}
          onResizeKeyDown={handleResizeKeyDown}
          onResizePointerDown={handleResizePointerDown}
          onSelectSlide={handleSelectSlide}
          onShowSlidePanel={() => setSlidePanelCollapsed(false)}
          onTogglePresentation={handleTogglePresentation}
        />
        <TranscriptReviewDialog
          open={transcriptDialogOpen}
          transcript={fullTranscript}
          isLoading={fullTranscriptLoading}
          error={fullTranscriptError}
          onClose={() => setTranscriptDialogOpen(false)}
        />
        <EndSessionDialog
          open={sessionEndDialogOpen}
          onClose={() => setSessionEndDialogOpen(false)}
          onGoHome={() => {
            setSessionEndDialogOpen(false);
            navigate('/');
          }}
          onReviewFeedback={() => {
            setSessionEndDialogOpen(false);
            handleViewPostFeedback();
          }}
        />
      </Box>
    </Box>
  );
}

async function getFirstPresentationId() {
  const payload = await PresentationWorkflowService.getPresentationTree();
  const tree = Array.isArray(payload.tree) ? payload.tree : [];

  return findFirstPresentationId(tree);
}

function EndSessionDialog({ onClose, onGoHome, onReviewFeedback, open }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" sx={themedDialogSx}>
      <DialogTitle>Presentation session ended</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body1" sx={{ color: 'var(--text)', py: 1 }}>
          Your transcript chunks have been saved for this deck. You can review audience feedback now
          or return to the file explorer.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onGoHome} sx={themedTextButtonSx}>
          Go home
        </Button>
        <Button variant="contained" onClick={onReviewFeedback} sx={themedContainedButtonSx}>
          Review feedback
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function TranscriptReviewDialog({ error, isLoading, onClose, open, transcript }) {
  const chunks = transcript?.chunks ?? [];
  const fullText = transcript?.text?.trim() ?? '';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" sx={themedDialogSx}>
      <DialogTitle>Saved transcript</DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
            <CircularProgress />
            <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
              Loading saved transcript...
            </Typography>
          </Stack>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : fullText ? (
          <Stack spacing={2}>
            <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
              {chunks.length} saved chunk{chunks.length === 1 ? '' : 's'}
            </Typography>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 2,
                maxHeight: '55vh',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                border: '1px solid var(--border, #e5e4e7)',
                borderRadius: 1,
                backgroundColor: 'var(--surface, #f7f4fb)',
                color: 'var(--text-h)',
                fontFamily: 'inherit',
                fontSize: '0.95rem',
                lineHeight: 1.6,
              }}
            >
              {fullText}
            </Box>
          </Stack>
        ) : (
          <Alert severity="info">No saved transcript chunks are available yet.</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={themedTextButtonSx}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function PresenterChromeToggle({ isVisible, onToggle }) {
  return (
    <Tooltip title={isVisible ? 'Hide navigation' : 'Show navigation'} placement="left" arrow>
      <IconButton
        aria-label={isVisible ? 'hide navigation' : 'show navigation'}
        onClick={onToggle}
        sx={(theme) => ({
          position: 'fixed',
          top: isVisible ? 72 : 12,
          right: 16,
          zIndex: theme.zIndex.drawer + 2,
          width: 40,
          height: 40,
          color: 'var(--text-h)',
          backgroundColor: 'var(--surface-raised, #ffffff)',
          border: '1px solid var(--border, #e5e4e7)',
          boxShadow: '0 8px 24px rgba(28, 22, 38, 0.14)',
          '&:hover': {
            backgroundColor: 'var(--interactive-bg, #e8def8)',
          },
        })}
      >
        {isVisible ? <FullscreenOutlinedIcon /> : <MenuOpenOutlinedIcon />}
      </IconButton>
    </Tooltip>
  );
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

function getTimingGoalSeconds(timingGoal = { minutes: 0, seconds: 0 }) {
  return Math.max(
    0,
    Number(timingGoal.minutes ?? 0) * 60 + Number(timingGoal.seconds ?? 0)
  );
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

function getSupportedAudioMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];

  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function getAudioExtension(mimeType = '') {
  if (mimeType.includes('mp4')) {
    return 'mp4';
  }

  if (mimeType.includes('ogg')) {
    return 'ogg';
  }

  return 'webm';
}

function readPresenterChromePreference() {
  try {
    return window.localStorage.getItem(PRESENTER_CHROME_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writePresenterChromePreference(isVisible) {
  try {
    window.localStorage.setItem(PRESENTER_CHROME_STORAGE_KEY, isVisible ? 'true' : 'false');
  } catch {
    // If browser storage is unavailable, the toggle still works for this session.
  }
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
