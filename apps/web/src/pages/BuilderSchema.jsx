import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
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
import CollapsiblePanelRail from '../components/CollapsiblePanelRail';
import SideBar from '../components/SideBar';
import SlideBuilderPanel from '../components/SlideBuilderPanel';
import SlideNavigator from '../components/SlideNavigator';
import { findNodeById } from '../data/presentationTree';
import PresentationBuilderService from '../services/PresentationBuilderService';
import TranscriptionService from '../services/TranscriptionService';
import PresentationWorkflowService from '../services/PresentationWorkflowService';
import { sortSlidesByNumber } from '../utils/slideUtils';

const DRAWER_WIDTH = 320;
const NAVIGATOR_MIN_WIDTH = 180;
const NAVIGATOR_MAX_WIDTH = 560;
const NAVIGATOR_COLLAPSE_WIDTH = 150;
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
  const [navigatorCollapsed, setNavigatorCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingBuilderSchema, setIsGeneratingBuilderSchema] = useState(false);
  const [deckGenerationProgress, setDeckGenerationProgress] = useState({
    completed: 0,
    total: 0,
  });
  const [generatingSlideSchemaId, setGeneratingSlideSchemaId] = useState(null);
  const [isRefreshingContext, setIsRefreshingContext] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [demoTranscriptsBySlideId, setDemoTranscriptsBySlideId] = useState({});
  const [recordingDemoSlideId, setRecordingDemoSlideId] = useState(null);
  const [transcribingDemoSlideId, setTranscribingDemoSlideId] = useState(null);
  const [demoTranscriptError, setDemoTranscriptError] = useState('');
  const [dirtySlideIds, setDirtySlideIds] = useState(() => new Set());
  const [dirtyNoteSlideIds, setDirtyNoteSlideIds] = useState(() => new Set());
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const panelGridRef = useRef(null);
  const dirtyVersionsRef = useRef({});
  const demoMediaRecorderRef = useRef(null);
  const demoMediaStreamRef = useRef(null);
  const demoAudioChunksRef = useRef([]);
  const demoRecordingSlideIdRef = useRef(null);
  const demoShouldTranscribeRef = useRef(false);
  const demoTranscriptSaveTimeoutsRef = useRef({});

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
        setDemoTranscriptsBySlideId(getDemoTranscriptsBySlideId(slides));
        setActiveSlideId(firstSlide?.slideId ?? null);
        setDirtySlideIds(new Set());
        setDirtyNoteSlideIds(new Set());
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
    if (dirtySlideIds.size === 0 && dirtyNoteSlideIds.size === 0) {
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
  }, [dirtySlideIds.size, dirtyNoteSlideIds.size]);

  useEffect(() => {
    const panelGrid = panelGridRef.current;

    if (!panelGrid || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      const gridWidth = entry.contentRect.width;

      if (!navigatorCollapsed) {
        setNavigatorWidth((width) => getClampedNavigatorWidth(width, gridWidth));
      }
    });

    resizeObserver.observe(panelGrid);

    return () => {
      resizeObserver.disconnect();
    };
  }, [navigatorCollapsed]);

  useEffect(() => {
    const saveTimeouts = demoTranscriptSaveTimeoutsRef.current;

    return () => {
      stopDemoTranscriptRecording({ shouldTranscribe: false });
      Object.values(saveTimeouts).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
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

  function handleUpdateSlideNotes(slideId, speakerNotes) {
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
                speakerNotes,
              }
            : slide
        ),
      };
    });

    setDirtyNoteSlideIds((currentSlideIds) => new Set(currentSlideIds).add(slideId));
    setSaveError('');
  }

  async function handleSaveSlideNotes(slideId) {
    const slide = presentationData?.slides.find((candidate) => candidate.slideId === slideId);

    if (!slide || isSavingNotes) {
      return;
    }

    try {
      setIsSavingNotes(true);
      setSaveError('');

      const savedSlide = await PresentationBuilderService.updateSlideNotes(
        deckId,
        slideId,
        slide.speakerNotes ?? ''
      );

      setPresentationData((currentData) => {
        if (!currentData) {
          return currentData;
        }

        return {
          ...currentData,
          slides: currentData.slides.map((currentSlide) =>
            currentSlide.slideId === savedSlide.slideId ? savedSlide : currentSlide
          ),
        };
      });
      setDirtyNoteSlideIds((currentSlideIds) => {
        const nextSlideIds = new Set(currentSlideIds);
        nextSlideIds.delete(slideId);
        return nextSlideIds;
      });
    } catch (saveNotesError) {
      setSaveError(
        saveNotesError instanceof Error
          ? saveNotesError.message
          : 'Unable to save speaker notes to Google.'
      );
    } finally {
      setIsSavingNotes(false);
    }
  }

  async function handleGenerateBuilderSchema() {
    if (!presentationData?.slides.length || isGeneratingBuilderSchema) {
      return;
    }

    try {
      setIsGeneratingBuilderSchema(true);
      setDeckGenerationProgress({
        completed: 0,
        total: presentationData.slides.length,
      });
      setSaveError('');

      const generatedSlides = [];

      for (const slide of presentationData.slides) {
        const generatedBuildData = await PresentationBuilderService.generateSlideBuildData(
          deckId,
          slide.slideId,
          {
            speakerNotes: slide.speakerNotes ?? '',
            demoTranscript: demoTranscriptsBySlideId[slide.slideId] ?? '',
          }
        );

        generatedSlides.push({
          slideId: slide.slideId,
          buildData: generatedBuildData,
        });
        setDeckGenerationProgress({
          completed: generatedSlides.length,
          total: presentationData.slides.length,
        });
      }

      const generatedBySlideId = new Map(
        generatedSlides.map((slide) => [slide.slideId, slide.buildData])
      );

      setPresentationData((currentData) => {
        if (!currentData) {
          return currentData;
        }

        return {
          ...currentData,
          slides: currentData.slides.map((slide) => ({
            ...slide,
            buildData: generatedBySlideId.get(slide.slideId) ?? slide.buildData,
          })),
        };
      });

      generatedSlides.forEach((slide) => {
        dirtyVersionsRef.current[slide.slideId] =
          (dirtyVersionsRef.current[slide.slideId] ?? 0) + 1;
      });
      setDirtySlideIds((currentSlideIds) => {
        const nextSlideIds = new Set(currentSlideIds);
        generatedSlides.forEach((slide) => nextSlideIds.add(slide.slideId));
        return nextSlideIds;
      });
    } catch (generateError) {
      setSaveError(
        generateError instanceof Error
          ? generateError.message
          : 'Unable to generate builder schema from notes.'
      );
    } finally {
      setIsGeneratingBuilderSchema(false);
      setDeckGenerationProgress({ completed: 0, total: 0 });
    }
  }

  async function handleGenerateSlideSchema(slideId) {
    const slide = presentationData?.slides.find((candidate) => candidate.slideId === slideId);

    if (!slide || generatingSlideSchemaId) {
      return;
    }

    try {
      setGeneratingSlideSchemaId(slideId);
      setSaveError('');

      const generatedBuildData = await PresentationBuilderService.generateSlideBuildData(
        deckId,
        slideId,
        {
          speakerNotes: slide.speakerNotes ?? '',
          demoTranscript: demoTranscriptsBySlideId[slideId] ?? '',
        }
      );

      handleUpdateSlide(slideId, generatedBuildData);
    } catch (generateError) {
      setSaveError(
        generateError instanceof Error
          ? generateError.message
          : 'Unable to generate builder schema from notes.'
      );
    } finally {
      setGeneratingSlideSchemaId(null);
    }
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

  async function handleRefreshGoogleContext() {
    if (!deckId || isRefreshingContext || isSaving) {
      return;
    }

    if (dirtySlideIds.size > 0 || dirtyNoteSlideIds.size > 0) {
      setSaveError('Save builder schema and note changes before refreshing Google notes.');
      return;
    }

    try {
      setIsRefreshingContext(true);
      setSaveError('');

      const data = await PresentationBuilderService.refreshGoogleContext(deckId);
      const slides = sortSlidesByNumber(Array.isArray(data.slides) ? data.slides : []);
      const nextActiveSlideId = slides.some((slide) => slide.slideId === activeSlideId)
        ? activeSlideId
        : slides[0]?.slideId ?? null;

      setPresentationData({
        ...data,
        slides,
      });
      setDemoTranscriptsBySlideId(getDemoTranscriptsBySlideId(slides));
      setActiveSlideId(nextActiveSlideId);
      setDirtyNoteSlideIds(new Set());
    } catch (refreshError) {
      setSaveError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Unable to refresh Google slide notes.'
      );
    } finally {
      setIsRefreshingContext(false);
    }
  }

  function confirmDiscardUnsavedChanges() {
    if (dirtySlideIds.size === 0 && dirtyNoteSlideIds.size === 0) {
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

  function handleChangeDemoTranscript(slideId, transcript) {
    setDemoTranscriptsBySlideId((currentTranscripts) => ({
      ...currentTranscripts,
      [slideId]: transcript,
    }));
    setPresentationDataDemoTranscript(slideId, transcript);
    queueSaveDemoTranscript(slideId, transcript);
    setDemoTranscriptError('');
  }

  function handleClearDemoTranscript(slideId) {
    setDemoTranscriptsBySlideId((currentTranscripts) => {
      const nextTranscripts = { ...currentTranscripts };

      delete nextTranscripts[slideId];
      return nextTranscripts;
    });
    setPresentationDataDemoTranscript(slideId, '');
    queueSaveDemoTranscript(slideId, '');
    setDemoTranscriptError('');
  }

  function setPresentationDataDemoTranscript(slideId, demoTranscript) {
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
                demoTranscript,
              }
            : slide
        ),
      };
    });
  }

  function queueSaveDemoTranscript(slideId, demoTranscript) {
    window.clearTimeout(demoTranscriptSaveTimeoutsRef.current[slideId]);
    demoTranscriptSaveTimeoutsRef.current[slideId] = window.setTimeout(() => {
      void saveDemoTranscript(slideId, demoTranscript, { source: 'manual' });
      delete demoTranscriptSaveTimeoutsRef.current[slideId];
    }, 700);
  }

  async function saveDemoTranscript(slideId, demoTranscript, { source = 'manual' } = {}) {
    if (!deckId || !slideId) {
      return;
    }

    try {
      await PresentationBuilderService.updateSlideDemoTranscript(
        deckId,
        slideId,
        demoTranscript,
        { source }
      );
    } catch (saveTranscriptError) {
      setDemoTranscriptError(
        saveTranscriptError instanceof Error
          ? saveTranscriptError.message
          : 'Unable to save demo transcript.'
      );
    }
  }

  async function handleStartDemoTranscriptRecording(slideId) {
    if (demoMediaRecorderRef.current?.state === 'recording') {
      return;
    }

    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setDemoTranscriptError('Microphone recording is not supported in this browser.');
      return;
    }

    try {
      setDemoTranscriptError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      demoAudioChunksRef.current = [];
      demoMediaStreamRef.current = stream;
      demoRecordingSlideIdRef.current = slideId;
      demoShouldTranscribeRef.current = true;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          demoAudioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const recordedMimeType = recorder.mimeType || mimeType || 'audio/webm';
        const chunks = demoAudioChunksRef.current;
        const recordingSlideId = demoRecordingSlideIdRef.current;

        demoMediaRecorderRef.current = null;
        demoAudioChunksRef.current = [];
        demoRecordingSlideIdRef.current = null;
        demoMediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        demoMediaStreamRef.current = null;
        setRecordingDemoSlideId(null);

        if (demoShouldTranscribeRef.current && chunks.length > 0 && recordingSlideId) {
          void transcribeDemoRecording({
            audioBlob: new Blob(chunks, { type: recordedMimeType }),
            mimeType: recordedMimeType,
            slideId: recordingSlideId,
          });
        }
      };

      demoMediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingDemoSlideId(slideId);
    } catch (recordingError) {
      setDemoTranscriptError(
        recordingError instanceof Error
          ? recordingError.message
          : 'Unable to start demo recording.'
      );
      setRecordingDemoSlideId(null);
    }
  }

  function stopDemoTranscriptRecording({ shouldTranscribe = true } = {}) {
    const recorder = demoMediaRecorderRef.current;

    demoShouldTranscribeRef.current = shouldTranscribe;

    if (!shouldTranscribe) {
      demoAudioChunksRef.current = [];
      demoRecordingSlideIdRef.current = null;
    }

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      return;
    }

    demoMediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    demoMediaStreamRef.current = null;
    demoMediaRecorderRef.current = null;
    setRecordingDemoSlideId(null);
  }

  async function transcribeDemoRecording({ audioBlob, mimeType, slideId }) {
    const extension = getAudioExtension(mimeType);

    try {
      setTranscribingDemoSlideId(slideId);
      setDemoTranscriptError('');

      const payload = await TranscriptionService.transcribeAudio(
        audioBlob,
        `demo-transcript.${extension}`
      );
      const text = String(payload.text ?? '').trim();

      setDemoTranscriptsBySlideId((currentTranscripts) => ({
        ...currentTranscripts,
        [slideId]: text,
      }));
      setPresentationDataDemoTranscript(slideId, text);
      window.clearTimeout(demoTranscriptSaveTimeoutsRef.current[slideId]);
      delete demoTranscriptSaveTimeoutsRef.current[slideId];
      await saveDemoTranscript(slideId, text, { source: 'whisper' });
    } catch (transcriptionError) {
      setDemoTranscriptError(
        transcriptionError instanceof Error
          ? transcriptionError.message
          : 'Unable to transcribe demo audio.'
      );
    } finally {
      setTranscribingDemoSlideId(null);
    }
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
      const nextWidth = moveEvent.clientX - gridRect.left;

      if (nextWidth < NAVIGATOR_COLLAPSE_WIDTH) {
        setNavigatorCollapsed(true);
        return;
      }

      setNavigatorCollapsed(false);
      setNavigatorWidth(clampNavigatorWidth(nextWidth));
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
      setNavigatorWidth((width) => {
        const nextWidth = width - step;
        if (nextWidth < NAVIGATOR_COLLAPSE_WIDTH) {
          setNavigatorCollapsed(true);
          return width;
        }
        return clampNavigatorWidth(nextWidth);
      });
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setNavigatorCollapsed(false);
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
                {isRefreshingContext
                  ? 'Refreshing Google notes...'
                  : isGeneratingBuilderSchema
                    ? `Generating deck schema ${deckGenerationProgress.completed}/${deckGenerationProgress.total}`
                  : isSaving
                  ? 'Saving...'
                  : dirtySlideIds.size > 0
                    ? `${dirtySlideIds.size} slide${dirtySlideIds.size === 1 ? '' : 's'} with unsaved changes`
                    : dirtyNoteSlideIds.size > 0
                      ? `${dirtyNoteSlideIds.size} slide${dirtyNoteSlideIds.size === 1 ? '' : 's'} with unsaved note changes`
                    : 'All changes saved'}
              </Typography>
            </Box>

            <Stack
              direction="row"
              spacing={1}
              justifyContent="flex-end"
              alignItems="center"
              sx={{ flexShrink: 0, ml: 'auto' }}
            >
              {isGeneratingBuilderSchema && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mr: 1,
                    color: 'var(--text-muted)',
                  }}
                >
                  <CircularProgress size={20} color="inherit" />
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    {deckGenerationProgress.completed}/{deckGenerationProgress.total}
                  </Typography>
                </Box>
              )}

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

              <Tooltip
                title={
                  isGeneratingBuilderSchema
                    ? 'Generating builder schema for deck'
                    : 'Generate builder schema for full deck'
                }
                placement="bottom"
                arrow
              >
                <span>
                  <IconButton
                    aria-label="generate builder schema for slide deck"
                    onClick={handleGenerateBuilderSchema}
                    disabled={!presentationData.slides.length || isGeneratingBuilderSchema}
                    sx={builderToolbarButtonSx}
                  >
                    {isGeneratingBuilderSchema ? (
                      <CircularProgress size={22} color="inherit" />
                    ) : (
                      <AutoFixHighOutlinedIcon fontSize="small" />
                    )}
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
                md: navigatorCollapsed
                  ? '64px minmax(0, 1fr)'
                  : `${navigatorWidth}px 16px minmax(0, 1fr)`,
              },
              columnGap: { md: navigatorCollapsed ? 2 : 0 },
              alignItems: 'start',
            }}
          >
            {navigatorCollapsed ? (
              <CollapsiblePanelRail
                label="Slides"
                onExpand={() => setNavigatorCollapsed(false)}
              />
            ) : (
              <>
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
              </>
            )}

            <SlideBuilderPanel
              slide={activeSlide}
              onUpdateSlide={handleUpdateSlide}
              onRefreshGoogleContext={handleRefreshGoogleContext}
              onGenerateSlideSchema={handleGenerateSlideSchema}
              onUpdateSlideNotes={handleUpdateSlideNotes}
              onChangeDemoTranscript={handleChangeDemoTranscript}
              onStartDemoTranscriptRecording={handleStartDemoTranscriptRecording}
              onStopDemoTranscriptRecording={() => stopDemoTranscriptRecording()}
              onClearDemoTranscript={handleClearDemoTranscript}
              onSaveSlideNotes={handleSaveSlideNotes}
              demoTranscript={activeSlide ? demoTranscriptsBySlideId[activeSlide.slideId] ?? '' : ''}
              demoTranscriptError={demoTranscriptError}
              canRefreshGoogleContext={
                dirtySlideIds.size === 0 && dirtyNoteSlideIds.size === 0 && !isSaving
              }
              isRefreshingGoogleContext={isRefreshingContext}
              canSaveSlideNotes={!isSaving && !isRefreshingContext}
              isSavingSlideNotes={isSavingNotes}
              hasUnsavedSlideNotes={Boolean(activeSlide && dirtyNoteSlideIds.has(activeSlide.slideId))}
              isGeneratingSlideSchema={activeSlide?.slideId === generatingSlideSchemaId}
              isRecordingDemoTranscript={activeSlide?.slideId === recordingDemoSlideId}
              isTranscribingDemoTranscript={activeSlide?.slideId === transcribingDemoSlideId}
            />
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

function getDemoTranscriptsBySlideId(slides) {
  return Object.fromEntries(
    slides.map((slide) => [slide.slideId, String(slide.demoTranscript ?? '')])
  );
}

function getSupportedAudioMimeType() {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function getAudioExtension(mimeType) {
  if (mimeType.includes('mp4')) {
    return 'mp4';
  }

  if (mimeType.includes('ogg')) {
    return 'ogg';
  }

  return 'webm';
}

export default BuilderSchema;
