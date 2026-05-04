import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

const ACCESSIBILITY_CHECKS = [
  {
    id: 'explain-jargon',
    label: 'Explain jargon',
    severity: 'high',
  },
  {
    id: 'read-quotes',
    label: 'Read quotes aloud',
    severity: 'medium',
  },
  {
    id: 'repeat-questions',
    label: 'Repeat audience questions',
    severity: 'medium',
  },
];

function AccessibilityChecklistEditor({ items = [], onChange }) {
  function isEnabled(checkId) {
    return items.some((item) => item.id === checkId && item.enabled);
  }

  function handleToggle(check, enabled) {
    const existingItem = items.find((item) => item.id === check.id);

    if (existingItem) {
      onChange(
        items.map((item) =>
          item.id === check.id
            ? {
                ...item,
                enabled,
              }
            : item
        )
      );
      return;
    }

    onChange([
      ...items,
      {
        ...check,
        enabled,
      },
    ]);
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="h6" sx={{ color: 'var(--text-h)' }}>
        Accessibility Checks
      </Typography>

      <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
        Choose what the live feedback system should monitor for this slide.
      </Typography>

      <Stack spacing={0.5}>
        {ACCESSIBILITY_CHECKS.map((check) => (
          <FormControlLabel
            key={check.id}
            control={
              <Checkbox
                checked={isEnabled(check.id)}
                onChange={(event) => handleToggle(check, event.target.checked)}
              />
            }
            label={check.label}
          />
        ))}
      </Stack>
    </Stack>
  );
}

export default AccessibilityChecklistEditor;
