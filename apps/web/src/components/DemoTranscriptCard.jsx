import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import MicOutlinedIcon from '@mui/icons-material/MicOutlined';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

function DemoTranscriptCard({
  transcript = '',
  onChangeTranscript,
  onStartRecording,
  onStopRecording,
  onClearTranscript,
  isRecording = false,
  isTranscribing = false,
  error = '',
}) {
  const recordingDisabled = isTranscribing || (!isRecording && !onStartRecording);
  const stopDisabled = !isRecording || !onStopRecording;
  const clearDisabled = isRecording || isTranscribing || !transcript.trim();

  return (
    <Stack spacing={1.5}>
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        sx={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '132px minmax(0, 1fr) auto',
        }}
      >
        <Box />

        <Box sx={{ minWidth: 0, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ color: 'var(--text-h)' }}>
            Demo Transcript
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
            {isRecording
              ? 'Recording demo audio...'
              : isTranscribing
                ? 'Transcribing demo audio...'
                : 'Record or edit demo wording before generating goals.'}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
          <Tooltip title={isRecording ? 'Recording demo audio' : 'Record demo audio'} arrow>
            <span>
              <IconButton
                aria-label="record demo transcript"
                onClick={onStartRecording}
                disabled={recordingDisabled || isRecording}
                sx={demoTranscriptIconButtonSx}
              >
                <MicOutlinedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Stop and transcribe demo audio" arrow>
            <span>
              <IconButton
                aria-label="stop demo transcript recording"
                onClick={onStopRecording}
                disabled={stopDisabled}
                sx={demoTranscriptIconButtonSx}
              >
                {isTranscribing ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <StopCircleOutlinedIcon fontSize="small" />
                )}
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Clear demo transcript" arrow>
            <span>
              <IconButton
                aria-label="clear demo transcript"
                onClick={onClearTranscript}
                disabled={clearDisabled}
                sx={demoTranscriptIconButtonSx}
              >
                <DeleteOutlineOutlinedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      <TextField
        aria-label="editable demo transcript"
        value={transcript}
        onChange={(event) => onChangeTranscript?.(event.target.value)}
        multiline
        minRows={4}
        maxRows={10}
        fullWidth
        placeholder="Record a live demo, then edit the Whisper transcription here."
        helperText={error || 'This transcript is included when generating slide goals.'}
        error={Boolean(error)}
        sx={{
          '& .MuiFormHelperText-root': {
            color: error ? undefined : '#ffffff !important',
            mx: 0,
          },
        }}
        FormHelperTextProps={{
          sx: {
            color: error ? undefined : '#ffffff !important',
            mx: 0,
          },
        }}
      />
    </Stack>
  );
}

const demoTranscriptIconButtonSx = {
  flexShrink: 0,
  border: '1px solid var(--interactive-border, #8e72bf)',
  backgroundColor: 'var(--surface, #f7f4fb)',
  color: 'var(--text-h)',
};

export default DemoTranscriptCard;
