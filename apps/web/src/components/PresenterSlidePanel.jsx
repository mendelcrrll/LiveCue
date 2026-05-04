import PauseCircleOutlineOutlinedIcon from '@mui/icons-material/PauseCircleOutlineOutlined';
import PlayCircleOutlineOutlinedIcon from '@mui/icons-material/PlayCircleOutlineOutlined';
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import SlidePreview from './SlidePreview';

function PresenterSlidePanel({
  slide,
  previousSlide,
  nextSlide,
  timerSeconds,
  isTimerPaused,
  onToggleTimer,
  onResetTimer,
  onSelectSlide,
}) {
  const isOverTime = timerSeconds < 0;
  const displaySeconds = Math.abs(timerSeconds);

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.5, md: 2 },
        border: '1px solid var(--border, #e5e4e7)',
        backgroundColor: 'var(--surface-raised, #ffffff)',
        height: '100%',
        minHeight: 0,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          height: '100%',
          minHeight: 0,
          display: 'grid',
          gridTemplateRows: 'auto minmax(0, 1fr) minmax(0, 118px)',
          gap: 1.5,
          overflow: 'hidden',
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          justifyContent="space-between"
          sx={{ minHeight: 42, width: '100%' }}
        >
          <Typography
            variant="h5"
            sx={{
              flex: '1 1 auto',
              color: isOverTime ? 'error.main' : 'var(--text-h)',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 800,
              lineHeight: 1.1,
            }}
          >
            {isOverTime ? '+' : ''}
            {formatTimer(displaySeconds)}
          </Typography>
          <Stack
            direction="row"
            spacing={0.75}
            justifyContent="flex-end"
            sx={{ flex: '0 0 auto', ml: 'auto' }}
          >
            <Tooltip title="Restart timer" placement="bottom" arrow>
              <IconButton
                aria-label="restart timer"
                onClick={onResetTimer}
                sx={timerControlButtonSx}
              >
                <ReplayOutlinedIcon fontSize="medium" />
              </IconButton>
            </Tooltip>
            <Tooltip title={isTimerPaused ? 'Resume timer' : 'Pause timer'} placement="bottom" arrow>
              <IconButton
                aria-label={isTimerPaused ? 'resume timer' : 'pause timer'}
                onClick={onToggleTimer}
                sx={timerControlButtonSx}
              >
                {isTimerPaused ? (
                  <PlayCircleOutlineOutlinedIcon fontSize="medium" />
                ) : (
                  <PauseCircleOutlineOutlinedIcon fontSize="medium" />
              )}
            </IconButton>
          </Tooltip>
          </Stack>
        </Stack>

        <SlidePreview
          slide={slide}
          size="large"
          sx={{
            height: '100%',
            minHeight: 0,
            aspectRatio: 'auto',
          }}
        />

        <Stack
          direction="row"
          spacing={1}
          alignItems="stretch"
          sx={{ height: '100%', minHeight: 0, overflow: 'hidden' }}
        >
          <AdjacentSlideButton
            label="Prev"
            slide={previousSlide}
            onClick={() => previousSlide && onSelectSlide(previousSlide.slideId)}
          />
          <AdjacentSlideButton
            label="Next"
            slide={nextSlide}
            onClick={() => nextSlide && onSelectSlide(nextSlide.slideId)}
          />
        </Stack>
      </Box>
    </Paper>
  );
}

const timerControlButtonSx = {
  width: 38,
  height: 38,
  color: 'var(--text-muted)',
  backgroundColor: 'var(--surface, #f7f4fb)',
  border: '1px solid var(--border, #e5e4e7)',
  '&:hover': {
    color: 'var(--text-h)',
    backgroundColor: 'var(--interactive-bg, #e8def8)',
  },
};

function AdjacentSlideButton({ label, slide, onClick }) {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={!slide}
      sx={{
        flex: 1,
        minWidth: 0,
        alignSelf: 'stretch',
        borderRadius: 1,
        textAlign: 'left',
        opacity: slide ? 1 : 0.5,
        overflow: 'hidden',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          height: '100%',
          minHeight: 0,
          p: 0.75,
          borderRadius: 1,
          border: '1px solid var(--border, #e5e4e7)',
          backgroundColor: 'var(--surface, #f7f4fb)',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            height: '100%',
            minHeight: 0,
            display: 'grid',
            gridTemplateRows: 'auto minmax(0, 1fr)',
            gap: 0.5,
          }}
        >
          <Typography
            variant="caption"
            noWrap
            sx={{ color: 'var(--text-muted)', fontWeight: 800, minWidth: 0 }}
          >
            {label}
          </Typography>
          {slide ? (
            <SlidePreview
              slide={slide}
              size="small"
              sx={{
                height: '100%',
                minHeight: 0,
                aspectRatio: 'auto',
              }}
            />
          ) : (
            <Box
              sx={{
                height: '100%',
                minHeight: 0,
                borderRadius: 1,
                border: '1px dashed var(--border, #e5e4e7)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                None
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>
    </ButtonBase>
  );
}

function formatTimer(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default PresenterSlidePanel;
