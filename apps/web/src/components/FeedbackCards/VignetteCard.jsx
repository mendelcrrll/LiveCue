import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

function VignetteCard({
  vignettes,
  activeVignetteId,
  isLoading,
  savingVignetteId,
  generating,
  onAdd,
  onChange,
  onGenerateFeedback,
  onRemove,
  onSave,
  onSelect,
}) {
  const savedVignetteCount = vignettes.filter(
    (vignette) => !vignette.isDraft && vignette.prompt.trim().length > 0
  ).length;

  const generateButtonSx = {
    width: 42,
    height: 42,
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

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        border: '1px solid var(--border)',
        backgroundColor: 'var(--surface-raised)',
        color: 'var(--text)',
        position: 'relative',
        alignSelf: 'start',
      }}
    >
      <Stack spacing={2}>
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          spacing={1}
          sx={{ width: '100%' }}
        >
          <Box sx={{ minWidth: 0, pr: 7, textAlign: 'left' }}>
            <Typography variant="subtitle1" sx={{ color: 'var(--text-h)', fontWeight: 800 }}>
              Audience Vignettes
            </Typography>
            <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
              {savedVignetteCount > 0
                ? `${savedVignetteCount} saved audience${savedVignetteCount === 1 ? '' : 's'}`
                : 'Save an audience to generate feedback'}
            </Typography>
          </Box>

          <Box sx={{ position: 'absolute', top: 24, right: 24, flexShrink: 0 }}>
            <Tooltip
              title={
                generating
                  ? 'We are generating feedback from saved audiences and the transcript'
                  : 'Generate feedback from saved audiences and the transcript'
              }
            >
              <span>
              <IconButton
                aria-label="generate audience feedback"
                onClick={onGenerateFeedback}
                disabled={generating || savedVignetteCount === 0}
                sx={generateButtonSx}
              >
                {generating ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <AutoFixHighOutlinedIcon fontSize="small" />
                )}
              </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Stack>

        <Stack spacing={1.25}>
          {vignettes.map((vignette, index) => {
            const selected = vignette.id === activeVignetteId;

            return (
              <Box
                key={vignette.id}
                onClick={() => onSelect(vignette.id)}
                sx={{
                  p: 1.25,
                  border: '1px solid',
                  borderColor: selected ? 'var(--interactive-border)' : 'var(--border)',
                  borderRadius: 2,
                  backgroundColor: selected ? 'var(--accent-bg)' : 'var(--surface)',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="subtitle2" sx={{ color: 'var(--text-h)', fontWeight: 800 }}>
                      Vignette {index + 1}
                    </Typography>
                    <Tooltip title="Remove vignette">
                      <span>
                        <IconButton
                          size="small"
                          aria-label={`remove vignette ${index + 1}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onRemove(vignette.id);
                          }}
                          disabled={vignettes.length === 1 && vignette.isDraft}
                          sx={{ color: 'var(--text-muted)' }}
                        >
                          <DeleteOutlineOutlinedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>

                  <TextField
                    value={vignette.prompt}
                    onChange={(event) => onChange(vignette.id, event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    multiline
                    minRows={5}
                    placeholder="Example: A first-year student who is anxious about public speaking and wants practical steps they can use this week."
                    fullWidth
                    size="small"
                    inputProps={{ 'aria-label': `audience vignette ${index + 1}` }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        alignItems: 'start',
                        backgroundColor: 'var(--surface-raised)',
                        color: 'var(--text)',
                      },
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'var(--border)',
                      },
                      '& .MuiInputBase-input::placeholder': {
                        color: 'var(--text-muted)',
                        opacity: 0.8,
                      },
                    }}
                  />
                  <Stack direction="row" justifyContent="flex-end" spacing={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSave(vignette.id);
                      }}
                      disabled={
                        isLoading ||
                        savingVignetteId === vignette.id ||
                        !vignette.isDirty ||
                        !vignette.prompt.trim()
                      }
                      sx={{
                        borderColor: 'var(--interactive-border)',
                        color: 'var(--interactive-text)',
                        textTransform: 'none',
                      }}
                    >
                      {savingVignetteId === vignette.id ? 'Saving...' : 'Save'}
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            );
          })}
        </Stack>

        <Button
          variant="outlined"
          startIcon={<AddOutlinedIcon />}
          onClick={onAdd}
          sx={{
            justifyContent: 'center',
            borderColor: 'var(--interactive-border)',
            color: 'var(--interactive-text)',
            textTransform: 'none',
            '&:hover': {
              borderColor: 'var(--interactive-border)',
              backgroundColor: 'var(--interactive-bg-hover)',
            },
          }}
        >
          Add audience
        </Button>

        {generating && (
          <Typography variant="caption" sx={{ color: 'var(--text-muted)', textAlign: 'left' }}>
            Generating feedback from saved audiences and the transcript.
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}

export default VignetteCard;
