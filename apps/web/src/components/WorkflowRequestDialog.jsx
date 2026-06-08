import { useEffect, useRef, useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PresentationWorkflowService from '../services/PresentationWorkflowService';

const DEFAULT_SLIDES_NAME = 'new-google-slides-request.pptx';

const DIALOG_COPY = {
  folder: {
    title: 'Add Folder',
    nameLabel: 'Folder name',
    helperText: 'Create a new folder inside the selected folder.',
    submitLabel: 'Create Folder',
  },
  slides: {
    title: 'Import Google Slides',
    nameLabel: 'Display name',
    helperText: 'Import a Google Slides deck into the selected folder.',
    submitLabel: 'Import Slides',
  },
};

function extractGooglePresentationId(value) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return '';
  }

  const pathMatch = trimmedValue.match(/\/d\/([A-Za-z0-9_-]+)/);
  if (pathMatch) {
    return pathMatch[1];
  }

  try {
    const url = new URL(trimmedValue);
    const searchParamId =
      url.searchParams.get('id') ??
      url.searchParams.get('presentationId') ??
      url.searchParams.get('deckId');

    if (searchParamId) {
      return searchParamId;
    }
  } catch {
    // Bare Google presentation IDs are handled below.
  }

  if (/^[A-Za-z0-9_-]+$/.test(trimmedValue)) {
    return trimmedValue;
  }

  return '';
}

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
      return DEFAULT_SLIDES_NAME;
    }
    if (mode === 'folder') {
      return 'New Folder';
    }
    return DEFAULT_SLIDES_NAME;
  });
  const [slideDeckUrl, setSlideDeckUrl] = useState('');
  const [deckLookupStatus, setDeckLookupStatus] = useState('idle');
  const nameEditedRef = useRef(false);

  const copy = mode ? DIALOG_COPY[mode] : null;
  const isSlides = mode === 'slides';
  const googlePresentationId = isSlides ? extractGooglePresentationId(slideDeckUrl) : '';
  const hasInvalidSlideDeckUrl = isSlides && slideDeckUrl.trim() !== '' && !googlePresentationId;

  useEffect(() => {
    if (!isSlides || !googlePresentationId) {
      return undefined;
    }

    let isActive = true;

    const timeoutId = window.setTimeout(async () => {
      try {
        const preview = await PresentationWorkflowService.previewGoogleSlidesDeck(
          googlePresentationId
        );

        if (!isActive) {
          return;
        }

        if (preview.title && !nameEditedRef.current) {
          setName(preview.title);
        }
        setDeckLookupStatus('loaded');
      } catch {
        if (isActive) {
          setDeckLookupStatus('error');
        }
      }
    }, 350);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [googlePresentationId, isSlides]);

  if (!mode) {
    return null;
  }

  const slideDeckHelperText = hasInvalidSlideDeckUrl
    ? 'Paste a Google Slides link or a valid presentation ID.'
    : deckLookupStatus === 'loading'
      ? 'Looking up deck info...'
      : deckLookupStatus === 'loaded'
        ? 'Deck info loaded.'
        : deckLookupStatus === 'error'
          ? 'Could not look up deck info yet; the ID can still be used.'
          : googlePresentationId
            ? `Deck ID: ${googlePresentationId}`
            : 'Paste the share URL from Google Slides, or enter the deck ID directly.';

  const handleSubmit = (event) => {
    event.preventDefault();

    if (isSlides && !googlePresentationId) {
      return;
    }

    onSubmit({
      name,
      googlePresentationId,
    });
  };

  const handleSlideDeckUrlChange = (event) => {
    const nextValue = event.target.value;
    const nextGooglePresentationId = extractGooglePresentationId(nextValue);

    setSlideDeckUrl(nextValue);
    setDeckLookupStatus(nextGooglePresentationId ? 'loading' : 'idle');
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
            onChange={(event) => {
              nameEditedRef.current = true;
              setName(event.target.value);
            }}
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
              label="Google Slides URL or deck ID"
              value={slideDeckUrl}
              onChange={handleSlideDeckUrlChange}
              required
              fullWidth
              error={hasInvalidSlideDeckUrl}
              helperText={slideDeckHelperText}
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
                '& .MuiFormHelperText-root': {
                  color: 'var(--text-h, #f5f1ff)',
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
