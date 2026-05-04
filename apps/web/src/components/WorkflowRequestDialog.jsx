import { useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

const DIALOG_COPY = {
  folder: {
    title: 'Add Folder',
    nameLabel: 'Folder name',
    helperText: 'Create a new folder inside the selected folder.',
    submitLabel: 'Create Folder',
  },
  file: {
    title: 'Add File',
    nameLabel: 'File name',
    helperText: 'Add a generic file entry to the selected folder.',
    submitLabel: 'Create File',
  },
  slides: {
    title: 'Import Google Slides',
    nameLabel: 'Display name',
    helperText: 'Import a Google Slides deck into the selected folder.',
    submitLabel: 'Import Slides',
  },
};

export default function WorkflowRequestDialog({
  mode,
  open,
  onClose,
  onSubmit,
  submitting = false,
  targetFolderName = '',
}) {
  const [name, setName] = useState(() => {
    if (mode === 'slides') {
      return 'new-google-slides-request.pptx';
    }
    if (mode === 'folder') {
      return 'New Folder';
    }
    return 'new-file.pptx';
  });
  const [googlePresentationId, setGooglePresentationId] = useState('');

  if (!mode) {
    return null;
  }

  const copy = DIALOG_COPY[mode];
  const isSlides = mode === 'slides';

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      name,
      googlePresentationId,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: {
          sx: {
            backgroundColor: 'var(--surface-raised, #16131d)',
            color: 'var(--text-h, #f5f1ff)',
            border: '1px solid var(--border, #322d3a)',
            backgroundImage: 'none',
          },
        },
      }}
    >
      <DialogTitle>{copy.title}</DialogTitle>
      <DialogContent>
        <Stack component="form" spacing={2} sx={{ pt: 1 }} onSubmit={handleSubmit}>
          <Typography variant="body2" sx={{ color: 'var(--text, #c6bfd3)' }}>
            {copy.helperText} Target folder: <strong>{targetFolderName || 'Unknown folder'}</strong>
          </Typography>
          <TextField
            label={copy.nameLabel}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            fullWidth
            autoFocus
            sx={{
              '& .MuiInputBase-root': {
                backgroundColor: 'var(--surface, #201c28)',
                color: 'var(--text-h, #f5f1ff)',
              },
              '& .MuiInputLabel-root': {
                color: 'var(--text-muted, #a69db4)',
              },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'var(--border, #4a4358)',
              },
            }}
          />
          {isSlides && (
            <TextField
              label="Google presentation ID"
              value={googlePresentationId}
              onChange={(event) => setGooglePresentationId(event.target.value)}
              required
              fullWidth
              sx={{
                '& .MuiInputBase-root': {
                  backgroundColor: 'var(--surface, #201c28)',
                  color: 'var(--text-h, #f5f1ff)',
                },
                '& .MuiInputLabel-root': {
                  color: 'var(--text-muted, #a69db4)',
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'var(--border, #4a4358)',
                },
              }}
            />
          )}
          <DialogActions sx={{ px: 0 }}>
            <Button onClick={onClose} disabled={submitting} sx={{ color: 'var(--text, #c6bfd3)' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              sx={{
                backgroundColor: 'var(--primary, #7c5cff)',
                color: 'var(--primary-contrast, #ffffff)',
              }}
            >
              {copy.submitLabel}
            </Button>
          </DialogActions>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
