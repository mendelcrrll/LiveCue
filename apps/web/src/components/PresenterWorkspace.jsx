import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import CollapsiblePanelRail from './CollapsiblePanelRail';
import PresenterFeedbackPanel from './PresenterFeedbackPanel';
import PresenterSlidePanel from './PresenterSlidePanel';

const PRESENTER_WORKSPACE_SCALE = 0.95;

function PresenterWorkspace({
  activeSlide,
  activeSlideTimingSeconds,
  isTimerPaused,
  isTranscriptionActive,
  nextSlide,
  onResetTimer,
  onResizeKeyDown,
  onResizePointerDown,
  onSelectSlide,
  onShowSlidePanel,
  onTogglePresentation,
  onReviewTranscript,
  onViewPostFeedback,
  panelGridRef,
  previousSlide,
  slidePanelMaxWidth,
  slidePanelMinWidth,
  slidePanelCollapsed,
  slidePanelWidth,
  timerSeconds,
  topOffset = 32,
  transcriptionError,
}) {
  return (
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
        mt: 0,
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
            lg: slidePanelCollapsed
              ? '64px minmax(0, 1fr)'
              : `${slidePanelWidth}px 16px minmax(0, 1fr)`,
          },
          gap: { xs: 2, lg: slidePanelCollapsed ? 2 : 0 },
          alignItems: 'stretch',
          height: {
            lg: `calc((100vh - ${topOffset}px) / ${PRESENTER_WORKSPACE_SCALE})`,
          },
          minHeight: { lg: 0 },
          maxHeight: {
            lg: `calc((100vh - ${topOffset}px) / ${PRESENTER_WORKSPACE_SCALE})`,
          },
          overflow: { lg: 'hidden' },
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
          sx={{ gridColumn: '1 / -1', mb: transcriptionError ? 0 : 1 }}
        >
          <Box sx={{ minWidth: 0 }}>
            {transcriptionError && <Alert severity="error">{transcriptionError}</Alert>}
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ArticleOutlinedIcon />}
              onClick={onReviewTranscript}
            >
              Review transcript
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<RateReviewOutlinedIcon />}
              onClick={onViewPostFeedback}
            >
              Post feedback
            </Button>
          </Stack>
        </Stack>

        {activeSlide ? (
          <>
            {slidePanelCollapsed ? (
              <CollapsiblePanelRail label="Slides" onExpand={onShowSlidePanel} topOffset={0} />
            ) : (
              <>
                <PresenterSlidePanel
                  slide={activeSlide}
                  previousSlide={previousSlide}
                  nextSlide={nextSlide}
                  timerSeconds={timerSeconds}
                  isTimerPaused={isTimerPaused}
                  isRecording={isTranscriptionActive}
                  transcriptionStatus={
                    isTranscriptionActive
                      ? 'Recording and saving 10-second transcript chunks'
                      : 'Press play to start timer and transcription'
                  }
                  onToggleTimer={onTogglePresentation}
                  onResetTimer={() => {
                    onResetTimer(activeSlideTimingSeconds);
                  }}
                  onSelectSlide={onSelectSlide}
                />

                <PresenterResizeHandle
                  maxWidth={slidePanelMaxWidth}
                  minWidth={slidePanelMinWidth}
                  width={slidePanelWidth}
                  onPointerDown={onResizePointerDown}
                  onKeyDown={onResizeKeyDown}
                />
              </>
            )}

            <PresenterFeedbackPanel slide={activeSlide} />
          </>
        ) : (
          <Alert severity="info">Select a slide to view presenter mode.</Alert>
        )}
      </Box>
    </Stack>
  );
}

function PresenterResizeHandle({
  maxWidth,
  minWidth,
  onKeyDown,
  onPointerDown,
  width,
}) {
  return (
    <Box
      role="separator"
      aria-label="Resize presenter panels"
      aria-orientation="vertical"
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
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
  );
}

export default PresenterWorkspace;
