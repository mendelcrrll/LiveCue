import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

function RecordingStatusIndicator({ isRecording }) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        py: 0.5,
        borderRadius: 1,
        border: '1px solid var(--border, #e5e4e7)',
        backgroundColor: isRecording ? 'rgba(211, 47, 47, 0.1)' : 'var(--surface, #f7f4fb)',
        color: isRecording ? 'error.main' : 'var(--text-muted)',
      }}
    >
      <FiberManualRecordIcon
        sx={{
          fontSize: 14,
          animation: isRecording ? 'recordingPulse 1s ease-in-out infinite' : 'none',
          '@keyframes recordingPulse': {
            '0%, 100%': {
              opacity: 1,
              transform: 'scale(1)',
            },
            '50%': {
              opacity: 0.35,
              transform: 'scale(0.78)',
            },
          },
        }}
      />
      <Typography variant="caption" sx={{ fontWeight: 800 }}>
        {isRecording ? 'Recording live' : 'Not recording'}
      </Typography>
    </Box>
  );
}

export default RecordingStatusIndicator;
