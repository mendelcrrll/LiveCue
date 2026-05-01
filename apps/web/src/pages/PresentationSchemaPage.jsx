import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import SlideshowOutlinedIcon from '@mui/icons-material/SlideshowOutlined';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import PresentationBuilderService from '../services/PresentationBuilderService';
import PresentationWorkflowService from '../services/PresentationWorkflowService';

function PresentationSchemaPage() {
  const { deckId } = useParams();
  const [presentationData, setPresentationData] = useState(null);
  const [activeSlideId, setActiveSlideId] = useState('');
  const [activeTab, setActiveTab] = useState('feedback');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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
        const slides = [...(data.slides ?? [])].sort((a, b) => a.slideNumber - b.slideNumber);

        setPresentationData({
          ...data,
          slides,
        });
        setActiveSlideId(slides[0]?.slideId ?? '');
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
  }, [deckId]);

  const activeSlide = useMemo(() => {
    return presentationData?.slides.find((slide) => slide.slideId === activeSlideId) ?? null;
  }, [presentationData, activeSlideId]);

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

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        boxSizing: 'border-box',
        px: { xs: 2, md: 4 },
        py: { xs: 3, md: 4 },
        textAlign: 'left',
      }}
    >
      <Stack spacing={3} sx={{ maxWidth: 1280, mx: 'auto' }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" sx={{ color: 'var(--text-muted)', fontWeight: 700 }}>
              Presentation Schema Mockup
            </Typography>
            <Typography variant="h4" component="h1" sx={{ color: 'var(--text-h)', mt: 0.5 }}>
              {presentationData?.deckTitle ?? 'Untitled presentation'}
            </Typography>
          </Box>

          <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 260 } }}>
            <InputLabel id="presentation-schema-slide-label">Current slide</InputLabel>
            <Select
              labelId="presentation-schema-slide-label"
              label="Current slide"
              value={activeSlideId}
              onChange={(event) => setActiveSlideId(event.target.value)}
            >
              {(presentationData?.slides ?? []).map((slide) => (
                <MenuItem key={slide.slideId} value={slide.slideId}>
                  Slide {slide.slideNumber}: {slide.title || 'Untitled slide'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        <Paper
          elevation={0}
          sx={{
            border: '1px solid var(--border, #cbbfda)',
            backgroundColor: 'var(--surface-raised, #ffffff)',
            overflow: 'hidden',
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, nextTab) => setActiveTab(nextTab)}
            variant="fullWidth"
            aria-label="Presentation schema panels"
            sx={{ borderBottom: '1px solid var(--border, #cbbfda)' }}
          >
            <Tab
              icon={<FeedbackOutlinedIcon fontSize="small" />}
              iconPosition="start"
              label="Feedback Tool"
              value="feedback"
            />
            <Tab
              icon={<SlideshowOutlinedIcon fontSize="small" />}
              iconPosition="start"
              label="Current Slide"
              value="slide"
            />
          </Tabs>

          <Box sx={{ p: { xs: 2, md: 3 } }}>
            {activeTab === 'feedback' ? (
              <FeedbackToolPanel slide={activeSlide} />
            ) : (
              <CurrentSlidePanel slide={activeSlide} />
            )}
          </Box>
        </Paper>
      </Stack>
    </Box>
  );
}

function FeedbackToolPanel({ slide }) {
  if (!slide) {
    return <Alert severity="info">Select a slide to view feedback details.</Alert>;
  }

  const timingGoal = slide.buildData?.timingGoal ?? { minutes: 0, seconds: 0 };
  const priorityItems = slide.buildData?.priorityItems ?? [];
  const accessibilityChecks = slide.buildData?.accessibilityChecks ?? [];

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="overline" sx={{ color: 'var(--text-muted)', fontWeight: 700 }}>
          Slide {slide.slideNumber}
        </Typography>
        <Typography variant="h5" sx={{ color: 'var(--text-h)' }}>
          {slide.title || 'Untitled slide'}
        </Typography>
      </Box>

      <InfoSection title="Presenter Feedback">
        <Stack spacing={1}>
          {priorityItems.length > 0 ? (
            priorityItems.map((item) => (
              <Paper
                key={item.id}
                elevation={0}
                sx={{
                  p: 1.5,
                  border: '1px solid var(--border, #cbbfda)',
                  backgroundColor: 'var(--surface, #f7f4fb)',
                }}
              >
                <Typography variant="body2" sx={{ color: 'var(--text-h)', fontWeight: 700 }}>
                  Priority {item.priority}
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--text)' }}>
                  {item.text}
                </Typography>
              </Paper>
            ))
          ) : (
            <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
              No priority feedback has been configured for this slide.
            </Typography>
          )}
        </Stack>
      </InfoSection>

      <InfoSection title="Accessibility Checks">
        <Stack spacing={1}>
          {accessibilityChecks.map((check) => (
            <Stack key={check.id} direction="row" spacing={1} alignItems="center">
              <CheckCircleOutlineOutlinedIcon
                fontSize="small"
                color={check.enabled ? 'success' : 'disabled'}
              />
              <Typography sx={{ color: check.enabled ? 'var(--text)' : 'var(--text-muted)' }}>
                {check.label}
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                {check.severity}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </InfoSection>

      <InfoSection title="Timing Goal">
        <Stack direction="row" spacing={1} alignItems="center">
          <TimerOutlinedIcon fontSize="small" />
          <Typography sx={{ color: 'var(--text)' }}>
            {timingGoal.minutes} min {timingGoal.seconds} sec
          </Typography>
        </Stack>
      </InfoSection>

      <InfoSection title="Speaker Notes">
        <Typography sx={{ color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
          {slide.speakerNotes || 'No speaker notes for this slide.'}
        </Typography>
      </InfoSection>
    </Stack>
  );
}

function CurrentSlidePanel({ slide }) {
  if (!slide) {
    return <Alert severity="info">Select a slide to preview it.</Alert>;
  }

  const slideImage = slide.thumbnailUrl ?? slide.imageUrl;

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          width: '100%',
          aspectRatio: '16 / 9',
          border: '1px solid var(--border, #cbbfda)',
          backgroundColor: 'var(--surface, #f7f4fb)',
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
        }}
      >
        {slideImage ? (
          <Box
            component="img"
            src={slideImage}
            alt={`Slide ${slide.slideNumber}`}
            sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <Stack spacing={1} alignItems="center" sx={{ p: 3, textAlign: 'center' }}>
            <SlideshowOutlinedIcon />
            <Typography sx={{ color: 'var(--text-muted)' }}>
              No slide preview image is available.
            </Typography>
          </Stack>
        )}
      </Box>

      <InfoSection title="Slide Text">
        <Stack spacing={0.75}>
          {(slide.slideText ?? []).length > 0 ? (
            slide.slideText.map((text, index) => (
              <Typography key={`${text}-${index}`} sx={{ color: 'var(--text)' }}>
                {text}
              </Typography>
            ))
          ) : (
            <Typography sx={{ color: 'var(--text-muted)' }}>
              No extracted slide text is available.
            </Typography>
          )}
        </Stack>
      </InfoSection>
    </Stack>
  );
}

function InfoSection({ title, children }) {
  return (
    <Box>
      <Typography variant="h6" sx={{ color: 'var(--text-h)', mb: 1 }}>
        {title}
      </Typography>
      {children}
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

export default PresentationSchemaPage;
