import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import PlayCircleOutlineOutlinedIcon from '@mui/icons-material/PlayCircleOutlineOutlined';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import CollapsiblePanelRail from './CollapsiblePanelRail';
import PresenterFeedbackPanel from './PresenterFeedbackPanel';
import PresenterSlidePanel from './PresenterSlidePanel';

const PRESENTER_WORKSPACE_SCALE = 0.95;
const presenterActionButtonSx = {
  borderColor: 'var(--interactive-border, #8e72bf)',
  color: 'var(--text-h, #1b1325)',
  backgroundColor: 'var(--surface, #f7f4fb)',
  '&:hover': {
    borderColor: 'var(--interactive-border, #8e72bf)',
    backgroundColor: 'var(--interactive-bg-hover, #ddd0f5)',
  },
};
const presenterPrimaryButtonSx = {
  color: 'var(--primary-contrast, #ffffff)',
  backgroundColor: 'var(--primary, #4f2d7f)',
  boxShadow: 'none',
  '&:hover': {
    backgroundColor: 'var(--accent, #6b39b0)',
    boxShadow: 'none',
  },
};

function PresenterWorkspace({
  activeSlide,
  activeSlideTimingSeconds,
  isPresentationSessionActive,
  isTimerPaused,
  isTranscriptionActive,
  nextSlide,
  onResetTimer,
  onResizeKeyDown,
  onResizePointerDown,
  onEndSession,
  onStartSession,
  onSelectSlide,
  onShowSlidePanel,
  onTogglePresentation,
  onReviewTranscript,
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
        width: { xs: '100%', lg: `${100 / PRESENTER_WORKSPACE_SCALE}%` }, 
        maxWidth: { xs: 1440, lg: `calc(1440px / ${PRESENTER_WORKSPACE_SCALE})` },
        mx: 'auto', 
        mt: { xs: 1.5, lg: 2 }, 
        minHeight: 0, 
        transform: { lg: `scale(max(1, min(${PRESENTER_WORKSPACE_SCALE}, 1.5)))` },
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
          useFlexGap
          flexWrap="wrap"
          sx={{
            gridColumn: '1 / -1',
            mb: 1.5,
            p: 1.25,
            border: '1px solid var(--border, #cbbfda)',
            backgroundColor: 'var(--surface-raised, #ffffff)',
            color: 'var(--text, #352b45)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            {transcriptionError && <Alert severity="error">{transcriptionError}</Alert>}
          </Box>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            useFlexGap
            flexWrap="wrap"
            sx={{ flexShrink: 0, ml: 'auto' }}
          >
            <Button
              variant="outlined"
              size="small"
              startIcon={<ArticleOutlinedIcon />}
              onClick={onReviewTranscript}
              sx={presenterActionButtonSx}
            >
              Review transcript
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={
                isPresentationSessionActive ? (
                  <StopCircleOutlinedIcon />
                ) : (
                  <PlayCircleOutlineOutlinedIcon />
                )
              }
              onClick={isPresentationSessionActive ? onEndSession : onStartSession}
              sx={presenterPrimaryButtonSx}
            >
              {isPresentationSessionActive ? 'End session' : 'Start session'}
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
                      : isPresentationSessionActive
                        ? 'Session paused. Resume the timer or end the session.'
                        : 'Press Start session to begin timer and transcription'
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
