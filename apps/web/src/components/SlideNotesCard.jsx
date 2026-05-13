import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

function SlideNotesCard({
  notes = '',
  onChangeNotes,
  onSaveNotes,
  onGenerateSlideSchema,
  onRefreshGoogleContext,
  canRefreshGoogleContext = true,
  isRefreshingGoogleContext = false,
  canSaveNotes = true,
  isSavingNotes = false,
  hasUnsavedNotes = false,
  isGeneratingSlideSchema = false,
}) {
  const normalizedNotes = String(notes ?? '').trim();
  const refreshDisabled =
    !onRefreshGoogleContext || !canRefreshGoogleContext || isRefreshingGoogleContext;
  const saveDisabled = !onSaveNotes || !canSaveNotes || isSavingNotes || !hasUnsavedNotes;
  const generateDisabled = !onGenerateSlideSchema || isGeneratingSlideSchema;

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
            Slide Notes
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
            {isSavingNotes
              ? 'Saving to Google...'
              : isGeneratingSlideSchema
                ? 'Generating this slide schema...'
              : isRefreshingGoogleContext
              ? 'Refreshing from Google...'
              : 'Speaker notes from Google Slides.'}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
          <Tooltip title="Generate this slide from notes" placement="top" arrow>
            <span>
              <IconButton
                aria-label="generate this slide builder schema from notes"
                onClick={onGenerateSlideSchema}
                disabled={generateDisabled}
                sx={notesIconButtonSx}
              >
                {isGeneratingSlideSchema ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <AutoFixHighOutlinedIcon fontSize="small" />
                )}
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip
            title={hasUnsavedNotes ? 'Save notes to Google' : 'No note changes to save'}
            placement="top"
            arrow
          >
            <span>
              <IconButton
                aria-label="save speaker notes to Google"
                onClick={onSaveNotes}
                disabled={saveDisabled}
                sx={notesIconButtonSx}
              >
                <SaveOutlinedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip
            title={
              canRefreshGoogleContext
                ? 'Refresh Google slide notes'
                : 'Save changes before refreshing Google notes'
            }
            placement="top"
            arrow
          >
            <span>
              <IconButton
                aria-label="refresh Google slide notes"
                onClick={onRefreshGoogleContext}
                disabled={refreshDisabled}
                sx={notesIconButtonSx}
              >
                <RefreshOutlinedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      <TextField
        aria-label="speaker notes"
        value={notes}
        onChange={(event) => onChangeNotes?.(event.target.value)}
        multiline
        minRows={4}
        maxRows={10}
        fullWidth
        placeholder="No speaker notes for this slide."
        helperText={
          normalizedNotes
            ? 'Edit notes here, then save to Google.'
            : 'Add notes here, then save to Google.'
        }
        sx={{
          '& .MuiFormHelperText-root': {
            color: '#ffffff !important',
            mx: 0,
          },
        }}
        FormHelperTextProps={{
          sx: {
            color: '#ffffff !important',
            mx: 0,
          },
        }}
      />
    </Stack>
  );
}

const notesIconButtonSx = {
  flexShrink: 0,
  border: '1px solid var(--interactive-border, #8e72bf)',
  backgroundColor: 'var(--surface, #f7f4fb)',
  color: 'var(--text-h)',
};

export default SlideNotesCard;
